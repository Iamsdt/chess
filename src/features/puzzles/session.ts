import { z } from 'zod'

import {
  HintLevelSchema,
  mapOk,
  parseValid,
  PuzzleIdSchema,
  TimestampSchema,
  type PuzzleId,
  type Result,
  type SessionKind,
  type Timestamp,
} from '@/domain'

/**
 * The session runner: one pure state machine behind all four puzzle modes.
 *
 * Adaptive sets, the daily puzzle, a theme set, Puzzle Rush and Survival differ only in
 * three numbers — how many puzzles, how long, and how many misses are allowed — so they
 * are one reducer with three fields rather than four runners that drift apart. The
 * reducer is pure and its whole state is serialisable, which is what makes "a session
 * survives a reload" a property of the data rather than a feature of the screen.
 *
 * Nothing here knows about chess or about the board; it counts results.
 */

/** The `SessionKind`s this feature runs. `SessionKind` itself also covers lessons and drills. */
export const PUZZLE_SESSION_KINDS = [
  'adaptive-puzzles',
  'daily-puzzle',
  'theme-puzzles',
  'puzzle-rush',
  'puzzle-survival',
] as const satisfies readonly SessionKind[]
export type PuzzleSessionKind = (typeof PUZZLE_SESSION_KINDS)[number]

/** The two clocks Puzzle Rush offers, as the prototype's mode picker shows them. */
export const RUSH_DURATIONS_MS = { '3min': 180_000, '5min': 300_000 } as const
export type RushDuration = keyof typeof RUSH_DURATIONS_MS

/** Three strikes, in both timed modes. */
export const RUSH_LIVES = 3

export interface SessionConfig {
  readonly kind: PuzzleSessionKind
  /** How many puzzles the set holds, or `null` for "as many as you can". */
  readonly goal: number | null
  readonly timeLimitMs: number | null
  readonly lives: number | null
  /** In timed modes the first wrong move ends the puzzle; in adaptive sets it does not. */
  readonly strictMoves: boolean
  readonly theme?: string | undefined
}

export interface ConfigOptions {
  readonly goal?: number | undefined
  readonly duration?: RushDuration | undefined
  readonly theme?: string | undefined
}

/** The three numbers that make a mode. Everything else about the modes is copy. */
export function configFor(kind: PuzzleSessionKind, options: ConfigOptions = {}): SessionConfig {
  switch (kind) {
    case 'puzzle-rush':
      return {
        kind,
        goal: null,
        timeLimitMs: RUSH_DURATIONS_MS[options.duration ?? '3min'],
        lives: RUSH_LIVES,
        strictMoves: true,
      }
    case 'puzzle-survival':
      return { kind, goal: null, timeLimitMs: null, lives: RUSH_LIVES, strictMoves: true }
    case 'daily-puzzle':
      return { kind, goal: 1, timeLimitMs: null, lives: null, strictMoves: false }
    case 'theme-puzzles':
      return {
        kind,
        goal: options.goal ?? 10,
        timeLimitMs: null,
        lives: null,
        strictMoves: false,
        ...(options.theme === undefined ? {} : { theme: options.theme }),
      }
    default:
      return { kind, goal: options.goal ?? 10, timeLimitMs: null, lives: null, strictMoves: false }
  }
}

/** What one puzzle in the session came to. */
export const PuzzleResultSchema = z.object({
  puzzleId: PuzzleIdSchema,
  solved: z.boolean(),
  /** Solved with no wrong move and no hint — what the summary calls "first try". */
  firstTry: z.boolean(),
  skipped: z.boolean(),
  hintUsed: HintLevelSchema.nullable(),
  durationMs: z.number().int().min(0),
  /** Rating points the attempt moved; 0 when the attempt was unrated. */
  ratingDelta: z.number().int(),
  theme: z.string(),
  rating: z.number().int(),
})
export type PuzzleResult = z.infer<typeof PuzzleResultSchema>

export type SessionStatus = 'running' | 'finished'

export const SessionConfigSchema = z.object({
  kind: z.enum(PUZZLE_SESSION_KINDS),
  goal: z.number().int().min(1).nullable(),
  timeLimitMs: z.number().int().min(0).nullable(),
  lives: z.number().int().min(1).nullable(),
  strictMoves: z.boolean(),
  theme: z.string().optional(),
})

/**
 * The whole runner state.
 *
 * The queue is puzzle *ids*, not puzzles: the rows live in IndexedDB and a resumed
 * session refetches them, so the stored session stays small and can never disagree with
 * the catalogue.
 */
export const SessionStateSchema = z.object({
  config: SessionConfigSchema,
  queue: z.array(PuzzleIdSchema),
  index: z.number().int().min(0),
  results: z.array(PuzzleResultSchema),
  streak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
  strikes: z.number().int().min(0),
  status: z.enum(['running', 'finished']),
  startedAt: TimestampSchema,
  elapsedMs: z.number().int().min(0),
  endedAt: TimestampSchema.nullable(),
})
export type SessionState = z.infer<typeof SessionStateSchema>

export type SessionAction =
  | { readonly type: 'result'; readonly result: PuzzleResult; readonly at: Timestamp }
  | { readonly type: 'tick'; readonly elapsedMs: number; readonly at: Timestamp }
  | { readonly type: 'enqueue'; readonly ids: readonly PuzzleId[] }
  | { readonly type: 'finish'; readonly at: Timestamp }

export function startSession(
  config: SessionConfig,
  queue: readonly PuzzleId[],
  startedAt: Timestamp,
): SessionState {
  return {
    config,
    queue: [...queue],
    index: 0,
    results: [],
    streak: 0,
    bestStreak: 0,
    strikes: 0,
    status: 'running',
    startedAt,
    elapsedMs: 0,
    endedAt: null,
  }
}

/** The puzzle the runner is on, or `null` when the queue is spent. */
export function currentPuzzleId(state: SessionState): PuzzleId | null {
  return state.queue[state.index] ?? null
}

/** Milliseconds left on the clock, or `null` in the untimed modes. */
export function timeLeftMs(state: SessionState): number | null {
  if (state.config.timeLimitMs === null) return null
  return Math.max(state.config.timeLimitMs - state.elapsedMs, 0)
}

/** Strikes remaining, or `null` where misses do not end the session. */
export function livesLeft(state: SessionState): number | null {
  if (state.config.lives === null) return null
  return Math.max(state.config.lives - state.strikes, 0)
}

/** Whether anything about the state says this session is over. */
function shouldFinish(state: SessionState): boolean {
  if (state.config.lives !== null && state.strikes >= state.config.lives) return true
  if (state.config.timeLimitMs !== null && state.elapsedMs >= state.config.timeLimitMs) return true
  if (state.config.goal !== null && state.results.length >= state.config.goal) return true
  return state.index >= state.queue.length
}

function settle(state: SessionState, at: Timestamp): SessionState {
  if (state.status === 'finished') return state
  return shouldFinish(state) ? { ...state, status: 'finished', endedAt: at } : state
}

/** Why a reducer: every transition is a value, so a resumed session is the same object. */
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'result': {
      if (state.status === 'finished') return state
      const solved = action.result.solved
      const streak = solved ? state.streak + 1 : 0
      const next: SessionState = {
        ...state,
        results: [...state.results, action.result],
        index: state.index + 1,
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
        strikes: solved ? state.strikes : state.strikes + 1,
      }
      return settle(next, action.at)
    }
    case 'tick': {
      if (state.status === 'finished') return state
      return settle({ ...state, elapsedMs: Math.max(action.elapsedMs, state.elapsedMs) }, action.at)
    }
    case 'enqueue': {
      if (state.status === 'finished') return state
      const known = new Set(state.queue)
      const added = action.ids.filter((id) => !known.has(id))
      return added.length === 0 ? state : { ...state, queue: [...state.queue, ...added] }
    }
    case 'finish':
      return state.status === 'finished'
        ? state
        : { ...state, status: 'finished', endedAt: action.at }
  }
}

/** What the header's dots show: one per puzzle, plus the one being solved. */
export type ProgressDot = 'solved' | 'missed' | 'current' | 'todo'

export function progressDots(state: SessionState): ProgressDot[] {
  const planned = state.config.goal ?? Math.max(state.queue.length, state.results.length + 1)
  const dots: ProgressDot[] = state.results.map((result) => (result.solved ? 'solved' : 'missed'))
  if (state.status === 'running' && dots.length < planned) dots.push('current')
  while (dots.length < planned) dots.push('todo')
  return dots
}

export interface SessionSummary {
  readonly attempted: number
  readonly solved: number
  readonly missed: number
  /** Solved with no wrong move and no hint. */
  readonly firstTry: number
  /** 0–1, or `null` before anything was attempted. */
  readonly accuracy: number | null
  readonly hintsUsed: number
  readonly ratingDelta: number
  readonly bestStreak: number
  readonly durationMs: number
  /** The fastest unaided solve — the "best moment" the summary screen leads with. */
  readonly bestMoment: PuzzleResult | null
}

export function sessionSummary(state: SessionState): SessionSummary {
  const solved = state.results.filter((result) => result.solved)
  const firstTry = solved.filter((result) => result.firstTry)
  const bestMoment = firstTry.reduce<PuzzleResult | null>(
    (best, result) => (best === null || result.durationMs < best.durationMs ? result : best),
    null,
  )
  return {
    attempted: state.results.length,
    solved: solved.length,
    missed: state.results.length - solved.length,
    firstTry: firstTry.length,
    accuracy: state.results.length === 0 ? null : solved.length / state.results.length,
    hintsUsed: state.results.filter((result) => result.hintUsed !== null).length,
    ratingDelta: state.results.reduce((total, result) => total + result.ratingDelta, 0),
    bestStreak: state.bestStreak,
    durationMs: state.elapsedMs,
    bestMoment,
  }
}

/**
 * The session as it goes into `PracticeSession.resumeState`, and back out again.
 *
 * S05 keeps that field an opaque record on purpose — every runner resumes differently —
 * so this is the schema that makes it trustworthy again on the way back. A stored session
 * written by an older build simply fails to parse and the runner starts fresh, which is
 * the only safe answer.
 */
export function toResumeState(state: SessionState): Record<string, unknown> {
  return { version: RESUME_VERSION, session: state }
}

/** Bumped when the shape changes; an older record is dropped rather than guessed at. */
export const RESUME_VERSION = 1

const ResumeEnvelopeSchema = z.object({
  version: z.literal(RESUME_VERSION),
  session: SessionStateSchema,
})

export function fromResumeState(value: unknown): Result<SessionState> {
  const parsed = parseValid(ResumeEnvelopeSchema, value, 'puzzle session resumeState')
  return mapOk(parsed, (envelope) => envelope.session)
}
