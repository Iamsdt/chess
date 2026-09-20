import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  now as nowTimestamp,
  toTimestamp,
  type HintLevel,
  type Puzzle,
  type PuzzleId,
  type SessionId,
} from '@/domain'

import { hintFor, type RevealedHint } from './hints'
import { closeSession, raiseBests, recordAttempt, saveSession } from './puzzle-store'
import { buildQueue, resumeOrStart, startNewSession } from './queue'
import {
  configFor,
  currentPuzzleId,
  livesLeft,
  progressDots,
  sessionReducer,
  sessionSummary,
  timeLeftMs,
  type ConfigOptions,
  type ProgressDot,
  type PuzzleResult,
  type PuzzleSessionKind,
  type SessionConfig,
  type SessionState,
  type SessionSummary,
} from './session'
import {
  createSolve,
  markMissed,
  playOpponentReply,
  playUserMove,
  withHint,
  type AttemptedMove,
  type SolveState,
} from './solution'

import type { RatingChange } from './rating'

/**
 * The runner behind the solver and the rush screens.
 *
 * It owns three things and delegates the rest: which puzzles are queued (the pure
 * selector), what the session has come to (the pure reducer), and where the user is
 * inside the puzzle in front of them (the pure solve state). What is genuinely *hooky* —
 * the clock, the opponent's reply arriving a beat later, writing the attempt, saving the
 * session after every result — lives here and nowhere else.
 *
 * A session row is written as soon as the set is drawn and updated after every result, so
 * a reload picks it back up. That is the sprint's "sessions resume after reload", and it
 * is a property of those writes rather than of the screen.
 *
 * The attempt in progress is one piece of state keyed by puzzle id, which is what makes
 * "the board resets when the puzzle changes" true by construction rather than by four
 * effects racing each other.
 */

/** How long the board rests on the user's move before the opponent answers. */
export const REPLY_DELAY_MS = 420

/** How long a finished puzzle stays on screen in the timed modes before the next one. */
export const RUSH_ADVANCE_MS = 700

/** Fetch more puzzles once an open-ended run is this close to the end of its queue. */
const TOP_UP_MARGIN = 3

const RUSH_3_MIN_MS = 180_000
const RUSH_5_MIN_MS = 300_000

export type SolveVerdict = 'idle' | 'correct' | 'missed' | 'solved'

export type RunnerStatus = 'loading' | 'running' | 'finished' | 'empty' | 'error'

/** Everything about the puzzle currently on the board. Replaced wholesale, never patched. */
interface ActiveAttempt {
  readonly puzzleId: PuzzleId
  readonly solve: SolveState
  readonly verdict: SolveVerdict
  readonly hint: RevealedHint | null
  readonly ratingChange: RatingChange | null
  readonly settled: boolean
}

export interface PuzzleRunner {
  readonly status: RunnerStatus
  readonly error: string | null
  readonly config: SessionConfig
  readonly state: SessionState | null
  readonly puzzle: Puzzle | null
  readonly solve: SolveState | null
  readonly verdict: SolveVerdict
  readonly hint: RevealedHint | null
  readonly hintUsed: HintLevel | null
  readonly ratingChange: RatingChange | null
  readonly dots: readonly ProgressDot[]
  readonly summary: SessionSummary | null
  readonly timeLeftMs: number | null
  readonly livesLeft: number | null
  /** True while the puzzle is over and the user has not moved on yet. */
  readonly awaitingNext: boolean
  readonly play: (move: AttemptedMove) => void
  readonly takeHint: (level: HintLevel) => void
  readonly skip: () => void
  readonly next: () => void
  readonly retry: () => void
  readonly finish: () => void
}

export interface SessionOptions extends ConfigOptions {
  readonly kind: PuzzleSessionKind
  /** Pick an interrupted session back up instead of starting a new one. */
  readonly resume?: boolean | undefined
  /**
   * Which kinds of interrupted session this screen may pick up.
   *
   * The solver resumes an adaptive set, a theme set or the daily puzzle, because the hub
   * hands a theme set over by opening it and navigating; the rush screen resumes only its
   * own two modes. Defaults to the runner's own kind.
   */
  readonly resumeKinds?: readonly PuzzleSessionKind[] | undefined
}

export function usePuzzleSession(options: SessionOptions): PuzzleRunner {
  const { kind, resume = true, resumeKinds, goal, duration, theme } = options
  const config = useMemo(
    () =>
      configFor(kind, {
        ...(goal === undefined ? {} : { goal }),
        ...(duration === undefined ? {} : { duration }),
        ...(theme === undefined ? {} : { theme }),
      }),
    [kind, goal, duration, theme],
  )

  const kinds = useMemo<readonly PuzzleSessionKind[]>(
    () => resumeKinds ?? [kind],
    [resumeKinds, kind],
  )

  const [booted, setBooted] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<SessionId | null>(null)
  const [state, setState] = useState<SessionState | null>(null)
  const [puzzles, setPuzzles] = useState<ReadonlyMap<PuzzleId, Puzzle>>(() => new Map())
  const [activeIndex, setActiveIndex] = useState(0)
  const [attempt, setAttempt] = useState<ActiveAttempt | null>(null)

  const attemptStartedAt = useRef(0)
  const elapsedBase = useRef(0)
  const runningSince = useRef(0)
  const toppingUp = useRef(false)

  /* ---- boot ---------------------------------------------------------------- */

  useEffect(() => {
    let live = true
    const prepared = resume ? resumeOrStart(config, kinds) : startNewSession(config)
    prepared
      .then((result) => {
        if (!live) return
        elapsedBase.current = result.state.elapsedMs
        runningSince.current = Date.now()
        attemptStartedAt.current = Date.now()
        setSessionId(result.sessionId)
        setState(result.state)
        setPuzzles(result.puzzles)
        setActiveIndex(result.activeIndex)
        setBooted('ready')
      })
      .catch((cause: unknown) => {
        if (!live) return
        setError(cause instanceof Error ? cause.message : 'The puzzles could not be loaded.')
        setBooted('error')
      })
    return () => {
      live = false
    }
  }, [config, resume, kinds])

  /* ---- the puzzle in front of the user ------------------------------------- */

  const activeId = state?.queue[activeIndex] ?? null
  const puzzle = activeId === null ? null : (puzzles.get(activeId) ?? null)

  // Derived, not stored: a fresh solve state for whichever puzzle is showing. The
  // attempt below supersedes it once the user has done anything to this puzzle.
  const opening = useMemo(() => {
    if (puzzle === null) return null
    const created = createSolve(puzzle)
    return created.ok ? created.value : null
  }, [puzzle])

  const live = attempt?.puzzleId === puzzle?.id ? attempt : null
  const solve = live?.solve ?? opening
  const verdict: SolveVerdict = live?.verdict ?? 'idle'

  // The attempt clock starts when a new puzzle appears. A ref, because the value is only
  // ever read when the attempt is written.
  useEffect(() => {
    attemptStartedAt.current = Date.now()
  }, [puzzle])

  /* ---- the clock ----------------------------------------------------------- */

  const running = state?.status === 'running'

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => {
      const elapsed = elapsedBase.current + (Date.now() - runningSince.current)
      setState((current) =>
        current === null
          ? current
          : sessionReducer(current, { type: 'tick', elapsedMs: elapsed, at: nowTimestamp() }),
      )
    }, 250)
    return () => {
      clearInterval(timer)
    }
  }, [running])

  /* ---- keep an open-ended run stocked -------------------------------------- */

  const needsTopUp =
    state?.status === 'running' &&
    state.config.goal === null &&
    state.queue.length - state.index <= TOP_UP_MARGIN

  useEffect(() => {
    if (!needsTopUp || toppingUp.current) return
    toppingUp.current = true
    void buildQueue(config)
      .then((more) => {
        if (more.length === 0) return
        setPuzzles((current) => {
          const next = new Map(current)
          for (const row of more) next.set(row.id, row)
          return next
        })
        setState((current) =>
          current === null
            ? current
            : sessionReducer(current, { type: 'enqueue', ids: more.map((row) => row.id) }),
        )
      })
      .finally(() => {
        toppingUp.current = false
      })
  }, [needsTopUp, config])

  /* ---- finishing one puzzle ------------------------------------------------ */

  const finalize = useCallback(
    (finished: SolveState, solved: boolean, skipped: boolean) => {
      const endedAt = nowTimestamp()
      const durationMs = Math.max(Date.now() - attemptStartedAt.current, 0)
      const startedAt = toTimestamp(Math.max(endedAt - durationMs, 0))
      const firstTry = solved && finished.wrongMoves === 0 && finished.hintUsed === null
      void recordAttempt({
        puzzle: finished.puzzle,
        mode: config.kind,
        ...(sessionId === null ? {} : { sessionId }),
        startedAt:
          durationMs > startedAt ? startedAt : ((startedAt - durationMs) as typeof endedAt),
        endedAt,
        solved,
        firstTry,
        skipped,
        movesPlayed: finished.played,
        hintUsed: finished.hintUsed,
        hintCount: finished.hintCount,
      }).then((written) => {
        const change = written.ok ? written.value.change : null
        setAttempt((current) =>
          current?.puzzleId === finished.puzzle.id
            ? { ...current, ratingChange: change, settled: true }
            : current,
        )
        const result: PuzzleResult = {
          puzzleId: finished.puzzle.id,
          solved,
          firstTry,
          skipped,
          hintUsed: finished.hintUsed,
          durationMs,
          ratingDelta: change?.delta ?? 0,
          theme: finished.puzzle.theme,
          rating: finished.puzzle.rating,
        }
        setState((current) => {
          if (current === null) return current
          const next = sessionReducer(current, { type: 'result', result, at: endedAt })
          if (sessionId !== null) {
            void (next.status === 'finished'
              ? closeSession(sessionId, next)
              : saveSession(sessionId, next))
          }
          if (next.status === 'finished') {
            const summary = sessionSummary(next)
            void raiseBests({
              solveStreak: next.bestStreak,
              ...(next.config.kind === 'puzzle-rush' && next.config.timeLimitMs === RUSH_3_MIN_MS
                ? { rush3: summary.solved }
                : {}),
              ...(next.config.kind === 'puzzle-rush' && next.config.timeLimitMs === RUSH_5_MIN_MS
                ? { rush5: summary.solved }
                : {}),
              ...(next.config.kind === 'puzzle-survival' ? { survival: summary.solved } : {}),
              ...(change === null ? {} : { highestRating: Math.round(change.after.rating) }),
            })
          }
          return next
        })
      })
    },
    [config.kind, sessionId],
  )

  /* ---- the actions a screen offers ---------------------------------------- */

  const play = useCallback(
    (move: AttemptedMove) => {
      if (solve?.status !== 'solving') return
      const outcome = playUserMove(solve, move)
      const base: ActiveAttempt = {
        puzzleId: solve.puzzle.id,
        solve: outcome.state,
        verdict: 'idle',
        hint: live?.hint ?? null,
        ratingChange: live?.ratingChange ?? null,
        settled: false,
      }

      if (outcome.verdict === 'correct') {
        setAttempt({ ...base, verdict: 'correct' })
        setTimeout(() => {
          setAttempt((current) =>
            current?.puzzleId === base.puzzleId
              ? { ...current, solve: playOpponentReply(current.solve), verdict: 'idle' }
              : current,
          )
        }, REPLY_DELAY_MS)
        return
      }

      if (outcome.verdict === 'solved') {
        setAttempt({ ...base, verdict: 'solved' })
        finalize(outcome.state, true, false)
        return
      }

      if (config.strictMoves) {
        const missed = markMissed(outcome.state)
        setAttempt({ ...base, solve: missed, verdict: 'missed' })
        finalize(missed, false, false)
        return
      }
      setAttempt({ ...base, verdict: 'missed' })
    },
    [config.strictMoves, finalize, live, solve],
  )

  const takeHint = useCallback(
    (level: HintLevel) => {
      if (solve === null || solve.status === 'solved') return
      setAttempt({
        puzzleId: solve.puzzle.id,
        solve: withHint(solve, level),
        verdict: 'idle',
        hint: hintFor(solve, level),
        ratingChange: live?.ratingChange ?? null,
        settled: false,
      })
    },
    [live, solve],
  )

  const skip = useCallback(() => {
    if (solve?.status !== 'solving') return
    const missed = markMissed(solve)
    setAttempt({
      puzzleId: solve.puzzle.id,
      solve: missed,
      verdict: 'missed',
      hint: live?.hint ?? null,
      ratingChange: null,
      settled: false,
    })
    finalize(missed, false, true)
  }, [finalize, live, solve])

  const next = useCallback(() => {
    if (state === null) return
    setActiveIndex(state.index)
  }, [state])

  /** Back to the board with the position untouched; the miss is already recorded. */
  const retry = useCallback(() => {
    setAttempt((current) => (current === null ? current : { ...current, verdict: 'idle' }))
  }, [])

  const finish = useCallback(() => {
    setState((current) => {
      if (current === null) return current
      const ended = sessionReducer(current, { type: 'finish', at: nowTimestamp() })
      if (sessionId !== null) void closeSession(sessionId, ended)
      return ended
    })
  }, [sessionId])

  /* ---- timed modes move themselves on -------------------------------------- */

  const autoAdvance = config.strictMoves && live?.settled === true && state?.status === 'running'
  const nextIndex = state?.index ?? 0

  useEffect(() => {
    if (!autoAdvance) return
    const timer = setTimeout(() => {
      setActiveIndex(nextIndex)
    }, RUSH_ADVANCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [autoAdvance, nextIndex])

  const status: RunnerStatus =
    booted === 'error'
      ? 'error'
      : booted === 'loading'
        ? 'loading'
        : state === null || state.queue.length === 0
          ? 'empty'
          : state.status === 'finished'
            ? 'finished'
            : 'running'

  return {
    status,
    error,
    config,
    state,
    puzzle,
    solve,
    verdict,
    hint: live?.hint ?? null,
    hintUsed: solve?.hintUsed ?? null,
    ratingChange: live?.ratingChange ?? null,
    dots: state === null ? [] : progressDots(state),
    summary: state === null ? null : sessionSummary(state),
    timeLeftMs: state === null ? null : timeLeftMs(state),
    livesLeft: state === null ? null : livesLeft(state),
    awaitingNext: live?.settled === true,
    play,
    takeHint,
    skip,
    next,
    retry,
    finish,
  }
}

/** The id of the puzzle a runner is on — the chat context line and the tests want it. */
export function runnerPuzzleId(runner: PuzzleRunner): PuzzleId | null {
  return runner.state === null ? null : currentPuzzleId(runner.state)
}
