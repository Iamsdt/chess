import { z } from 'zod'

import {
  attemptsRepo,
  defineKvKey,
  kvRepo,
  newAttemptId,
  newSessionId,
  profileRepo,
  puzzlesRepo,
  sessionsRepo,
  type PracticeSession,
} from '@/data'
import {
  localDateOf,
  now as nowTimestamp,
  ok,
  RatingSchema,
  toTimestamp,
  type HintLevel,
  type LocalDate,
  type Puzzle,
  type PuzzleAttempt,
  type PuzzleBand,
  type PuzzleId,
  type Result,
  type SessionId,
  type SessionKind,
  type Timestamp,
  type Uci,
} from '@/domain'

import { DEFAULT_DEVIATION, DEFAULT_RATING, type GlickoRating } from './glicko2'
import { type ThemeAttemptRecord } from './mastery'
import { applyAttempt, DEFAULT_RATING_STATE, toStoredRating, type RatingChange } from './rating'
import { dailyPuzzleIndex, type LadderRung } from './selection'
import { fromResumeState, toResumeState, type SessionState } from './session'

/**
 * Everything the puzzle feature asks of storage, in one file.
 *
 * The screens and hooks above this line never see a repository, and no repository below
 * it knows what a hint costs. That split is what lets the rating and the selector be
 * tested as pure functions while the session that uses them still survives a reload.
 *
 * Reads return plain values and writes return `Result`, following the same convention as
 * `@/data` itself, because a caller has to be able to see a quota failure.
 */

/** Glicko-2 needs all three numbers; a rating without its deviation cannot be updated. */
const RatingStateSchema = z.object({
  rating: RatingSchema,
  deviation: z.number().min(0),
  volatility: z.number().min(0),
})

/**
 * The rating's home before onboarding has written a profile.
 *
 * Why two homes: `Profile` owns the puzzle rating (S03 says so, and the backup carries
 * it), but the app is playable before onboarding runs and those attempts must count.
 * Reads prefer the profile and fall back to this key; writes update whichever exists.
 */
const ratingStateKey = defineKvKey('puzzle-rating', RatingStateSchema)

const BestsSchema = z.object({
  rush3: z.number().int().min(0).default(0),
  rush5: z.number().int().min(0).default(0),
  survival: z.number().int().min(0).default(0),
  solveStreak: z.number().int().min(0).default(0),
  highestRating: RatingSchema.default(DEFAULT_RATING),
})
export type PuzzleBests = z.infer<typeof BestsSchema>

/** Personal bests, which are the only scores in this app and are never compared to anyone. */
const bestsKey = defineKvKey('puzzle-bests', BestsSchema)

export const EMPTY_BESTS: PuzzleBests = {
  rush3: 0,
  rush5: 0,
  survival: 0,
  solveStreak: 0,
  highestRating: DEFAULT_RATING,
}

/** How far back "do not show me that one again yet" reaches. */
export const REPEAT_COOLDOWN_DAYS = 30

/** How many past attempts the hub's mastery and curriculum numbers are built from. */
export const HISTORY_DEPTH = 500

const DAY_MS = 86_400_000

/**
 * The user's current Glicko-2 state.
 *
 * The fallback chain is profile → pre-onboarding key → the last rated attempt → defaults.
 * The attempt is third because it stores the rating and deviation but not the volatility,
 * so it can restore a rating a lost profile took with it, but not perfectly.
 */
export async function readRatingState(): Promise<GlickoRating> {
  const profile = await profileRepo.get()
  if (profile !== undefined) {
    return {
      rating: profile.puzzleRating,
      deviation: profile.puzzleRatingDeviation,
      volatility: profile.puzzleRatingVolatility,
    }
  }
  const stored = await kvRepo.get(ratingStateKey)
  if (stored !== undefined) return stored

  const last = await attemptsRepo.lastRated()
  if (last === undefined) return DEFAULT_RATING_STATE
  return {
    rating: last.ratingAfter,
    deviation: last.ratingDeviationAfter,
    volatility: DEFAULT_RATING_STATE.volatility,
  }
}

async function writeRatingState(state: GlickoRating): Promise<Result<void>> {
  const profile = await profileRepo.get()
  if (profile !== undefined) {
    const saved = await profileRepo.update({
      puzzleRating: toStoredRating(state.rating),
      puzzleRatingDeviation: state.deviation,
      puzzleRatingVolatility: state.volatility,
    })
    return saved.ok ? ok(undefined) : saved
  }
  const saved = await kvRepo.set(ratingStateKey, {
    rating: toStoredRating(state.rating),
    deviation: state.deviation,
    volatility: state.volatility,
  })
  return saved.ok ? ok(undefined) : saved
}

/** One attempt, joined to the puzzle it was at — the shape mastery and the curriculum want. */
export interface AttemptHistoryEntry {
  readonly attempt: PuzzleAttempt
  readonly puzzle: Puzzle | undefined
}

/** Recent attempts with their puzzles, newest first. */
export async function loadAttemptHistory(limit = HISTORY_DEPTH): Promise<AttemptHistoryEntry[]> {
  const attempts = await attemptsRepo.listRecent(limit)
  const puzzles = await puzzlesRepo.getMany([
    ...new Set(attempts.map((attempt) => attempt.puzzleId)),
  ])
  const byId = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]))
  return attempts.map((attempt) => ({ attempt, puzzle: byId.get(attempt.puzzleId) }))
}

/** Mastery input: every attempt whose puzzle is still in the catalogue. */
export function toThemeRecords(history: readonly AttemptHistoryEntry[]): ThemeAttemptRecord[] {
  return history.flatMap(({ attempt, puzzle }) =>
    puzzle === undefined
      ? []
      : [
          {
            theme: puzzle.theme,
            solved: attempt.solved,
            hintUsed: attempt.hintUsed,
            endedAt: attempt.endedAt,
          },
        ],
  )
}

/** Solves per band, which is where the user stands in the curriculum. */
export function toSolvedByBand(
  history: readonly AttemptHistoryEntry[],
): Partial<Record<PuzzleBand, number>> {
  const counts: Partial<Record<PuzzleBand, number>> = {}
  for (const { attempt, puzzle } of history) {
    if (puzzle === undefined || !attempt.solved) continue
    counts[puzzle.band] = (counts[puzzle.band] ?? 0) + 1
  }
  return counts
}

/** Puzzles the user has met lately, so a set does not serve them straight back. */
export async function loadRecentPuzzleIds(days = REPEAT_COOLDOWN_DAYS): Promise<PuzzleId[]> {
  const since = toTimestamp(Math.max(nowTimestamp() - days * DAY_MS, 0))
  return attemptsRepo.recentPuzzleIds(since)
}

/** What the ladder found, and which rung found it — the hub says so in a sentence. */
export interface CandidatePool {
  readonly puzzles: readonly Puzzle[]
  readonly label: string
}

/**
 * Walk the ladder until a rung fills the pool.
 *
 * Why it stops at the first rung with anything in it rather than merging them all: the
 * rungs are ordered by how well they fit the user, so merging would dilute a good answer
 * with a worse one.
 */
export async function loadCandidates(
  ladder: readonly LadderRung[],
  minimum: number,
): Promise<CandidatePool> {
  let best: CandidatePool = { puzzles: [], label: ladder[0]?.label ?? 'your level' }
  for (const rung of ladder) {
    const results = await Promise.all(rung.queries.map((query) => puzzlesRepo.select(query)))
    const merged = new Map<PuzzleId, Puzzle>()
    for (const puzzles of results) {
      for (const puzzle of puzzles) merged.set(puzzle.id, puzzle)
    }
    if (merged.size > best.puzzles.length) {
      best = { puzzles: [...merged.values()], label: rung.label }
    }
    if (merged.size >= minimum) break
  }
  return best
}

/** The day's puzzle: the same one on every device, because the index is a hash of the date. */
export async function loadDailyPuzzle(day: LocalDate): Promise<Puzzle | undefined> {
  const total = await puzzlesRepo.count()
  if (total === 0) return undefined
  return puzzlesRepo.getByIndex(dailyPuzzleIndex(day, total))
}

export interface RecordAttemptInput {
  readonly puzzle: Puzzle
  readonly mode: SessionKind
  readonly sessionId?: SessionId | undefined
  readonly startedAt: Timestamp
  readonly endedAt: Timestamp
  readonly solved: boolean
  readonly firstTry: boolean
  readonly skipped: boolean
  readonly movesPlayed: readonly Uci[]
  readonly hintUsed: HintLevel | null
  readonly hintCount: number
}

export interface RecordedAttempt {
  readonly attempt: PuzzleAttempt
  readonly change: RatingChange
}

/**
 * Write the attempt and move the rating, in that order.
 *
 * The attempt carries both rating snapshots because a stored delta cannot be re-derived —
 * S03's schema says so, and it is what lets the growth chart be rebuilt from history
 * alone if the profile is ever lost.
 */
export async function recordAttempt(input: RecordAttemptInput): Promise<Result<RecordedAttempt>> {
  const before = await readRatingState()
  const change = applyAttempt(before, {
    puzzleRating: input.puzzle.rating,
    solved: input.solved,
    hintUsed: input.hintUsed,
    skipped: input.skipped,
  })

  const attempt: PuzzleAttempt = {
    id: newAttemptId(),
    puzzleId: input.puzzle.id,
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    mode: input.mode,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(input.endedAt - input.startedAt, 0),
    solved: input.solved,
    firstTry: input.firstTry,
    skipped: input.skipped,
    movesPlayed: [...input.movesPlayed],
    hintUsed: input.hintUsed,
    hintCount: input.hintCount,
    puzzleRating: input.puzzle.rating,
    ratingBefore: toStoredRating(change.before.rating),
    ratingAfter: toStoredRating(change.after.rating),
    ratingDeviationBefore: change.before.deviation,
    ratingDeviationAfter: change.after.deviation,
    rated: change.rated,
  }

  const written = await attemptsRepo.add(attempt)
  if (!written.ok) return written
  if (change.rated) {
    const saved = await writeRatingState(change.after)
    if (!saved.ok) return saved
  }
  return ok({ attempt: written.value, change })
}

/** The user's own records. Nothing here is compared with anybody else's. */
export async function readBests(): Promise<PuzzleBests> {
  return kvRepo.getOr(bestsKey, EMPTY_BESTS)
}

/** Raise a personal best, never lower one: a bad run does not delete a good day. */
export async function raiseBests(candidate: Partial<PuzzleBests>): Promise<Result<PuzzleBests>> {
  return kvRepo.update(bestsKey, (current) => {
    const base = current ?? EMPTY_BESTS
    return {
      rush3: Math.max(base.rush3, candidate.rush3 ?? 0),
      rush5: Math.max(base.rush5, candidate.rush5 ?? 0),
      survival: Math.max(base.survival, candidate.survival ?? 0),
      solveStreak: Math.max(base.solveStreak, candidate.solveStreak ?? 0),
      highestRating: Math.max(base.highestRating, candidate.highestRating ?? 0),
    }
  })
}

/** The calendar day a session belongs to, in the user's own zone. */
export async function currentDay(): Promise<LocalDate> {
  const profile = await profileRepo.get()
  const zone = profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  return localDateOf(nowTimestamp(), zone)
}

/** A session the runner can pick back up, with its state already validated. */
export interface ResumableSession {
  readonly session: PracticeSession
  readonly state: SessionState
}

/** How far back a resume looks. A session older than the last twenty is not "interrupted". */
const RESUME_SEARCH_DEPTH = 20

/**
 * The session a reload interrupted.
 *
 * A stored session whose `resumeState` no longer parses is abandoned rather than
 * resurrected: a half-understood session is worse than a fresh one, and leaving it
 * `active` would make every later visit try again.
 */
export async function findResumableSession(
  kinds?: readonly SessionKind[],
): Promise<ResumableSession | null> {
  const recent = await sessionsRepo.listRecent(RESUME_SEARCH_DEPTH)
  const session = recent.find(
    (row) => row.state === 'active' && (kinds === undefined || kinds.includes(row.kind)),
  )
  if (session === undefined) return null
  const state = fromResumeState(session.resumeState)
  if (!state.ok) {
    await sessionsRepo.finish(session.id, 'abandoned')
    return null
  }
  return { session, state: state.value }
}

/** Open a session row for a run that has just started. */
export async function openSession(state: SessionState): Promise<Result<PracticeSession>> {
  const day = await currentDay()
  const started = nowTimestamp()
  return sessionsRepo.start({
    id: newSessionId(),
    kind: state.config.kind,
    state: 'active',
    day,
    startedAt: started,
    updatedAt: started,
    endedAt: null,
    durationMs: 0,
    itemsAttempted: 0,
    itemsCorrect: 0,
    resumeState: toResumeState(state),
  })
}

/** Save the runner's state after every result, which is what makes a reload survivable. */
export async function saveSession(
  id: SessionId,
  state: SessionState,
): Promise<Result<PracticeSession>> {
  return sessionsRepo.update(id, {
    durationMs: state.elapsedMs,
    itemsAttempted: state.results.length,
    itemsCorrect: state.results.filter((result) => result.solved).length,
    resumeState: toResumeState(state),
  })
}

/** Close a session, keeping its final state for the summary screen. */
export async function closeSession(
  id: SessionId,
  state: SessionState,
  outcome: 'completed' | 'abandoned' = 'completed',
): Promise<Result<PracticeSession>> {
  const saved = await saveSession(id, state)
  if (!saved.ok) return saved
  return sessionsRepo.finish(id, outcome)
}

/** The most recently finished session, which is what the summary screen opens with. */
export async function lastFinishedSession(): Promise<ResumableSession | null> {
  const recent = await sessionsRepo.listRecent(10)
  for (const session of recent) {
    if (session.state === 'active') continue
    const state = fromResumeState(session.resumeState)
    if (state.ok) return { session, state: state.value }
  }
  return null
}

/** Defaults exported for the hub's empty state, which shows a rating before any exist. */
export const STARTING_RATING = { rating: DEFAULT_RATING, deviation: DEFAULT_DEVIATION }
