import {
  timestampFromDate,
  type HintLevel,
  type MistakeEntry,
  type ReviewGrade,
  type SrsCard,
  type SrsCardId,
  type SrsState,
  type Timestamp,
} from '@/domain'
import { hintFor, type RevealedHint } from '@/features/puzzles/hints'
import {
  createSolve,
  markMissed,
  playOpponentReply,
  playUserMove,
  withHint,
  type AttemptedMove,
  type SolveState,
} from '@/features/puzzles/solution'

import { reviewCard } from './fsrs'
import { gradeAttempt } from './grade'
import { puzzleFromMistake } from './puzzle-view'

/**
 * The review session as a pure state machine.
 *
 * The board, the hint ladder and move checking all come from the puzzle solver
 * (`createSolve` and friends); this file only decides what a finished attempt means for
 * the card and which card is next. Time arrives as an argument, so a test can run a whole
 * session without a clock, and writing to storage is the hook's job, not the reducer's.
 */

export interface ReviewItem {
  readonly card: SrsCard
  readonly mistake: MistakeEntry
}

export type ReviewPhase = 'solving' | 'recap' | 'done'

/** What one finished attempt came to. */
export interface AttemptOutcome {
  readonly grade: ReviewGrade
  readonly solved: boolean
  readonly durationMs: number
  /** The card as the scheduler leaves it; the hook writes this. */
  readonly card: SrsCard
  readonly stateBefore: SrsState
}

export interface ReviewSessionState {
  /** The queue, with any card that was missed appended once for a second look. */
  readonly items: readonly ReviewItem[]
  readonly index: number
  readonly phase: ReviewPhase
  readonly solve: SolveState | null
  readonly hint: RevealedHint | null
  readonly startedAtMs: number
  readonly outcome: AttemptOutcome | null
  readonly results: readonly AttemptOutcome[]
  /** Cards already given their second look, so a stubborn one cannot loop forever. */
  readonly requeued: readonly SrsCardId[]
}

export type ReviewAction =
  | { readonly type: 'play'; readonly move: AttemptedMove; readonly at: number }
  | { readonly type: 'reply'; readonly at: number }
  | { readonly type: 'hint'; readonly level: HintLevel }
  | { readonly type: 'give-up'; readonly at: number }
  | { readonly type: 'next'; readonly at: number }

/** Opens the solve for the first item that can be played, skipping any that cannot. */
function openFrom(
  items: readonly ReviewItem[],
  from: number,
): { index: number; solve: SolveState } | null {
  for (let index = from; index < items.length; index += 1) {
    const item = items[index]
    if (item === undefined) continue
    const puzzle = puzzleFromMistake(item.mistake)
    if (!puzzle.ok) continue
    const solve = createSolve(puzzle.value)
    if (solve.ok) return { index, solve: solve.value }
  }
  return null
}

export function startSession(items: readonly ReviewItem[], at: number): ReviewSessionState {
  const opened = openFrom(items, 0)
  return {
    items,
    index: opened?.index ?? 0,
    phase: opened === null ? 'done' : 'solving',
    solve: opened?.solve ?? null,
    hint: null,
    startedAtMs: at,
    outcome: null,
    results: [],
    requeued: [],
  }
}

export function currentItem(state: ReviewSessionState): ReviewItem | null {
  return state.items[state.index] ?? null
}

/** Closes the attempt: grade it, schedule the card, and show the recap. */
function finish(
  state: ReviewSessionState,
  solve: SolveState,
  solved: boolean,
  at: number,
): ReviewSessionState {
  const item = currentItem(state)
  if (item === null) return state
  const durationMs = Math.max(at - state.startedAtMs, 0)
  const grade = gradeAttempt({
    solved,
    wrongMoves: solve.wrongMoves,
    hintUsed: solve.hintUsed,
    durationMs,
    firstSighting: item.card.state === 'new',
  })
  const outcome: AttemptOutcome = {
    grade,
    solved,
    durationMs,
    card: reviewCard(item.card, grade, new Date(at)),
    stateBefore: item.card.state,
  }
  const again = grade === 'again' && !state.requeued.includes(item.card.id)
  return {
    ...state,
    phase: 'recap',
    solve,
    outcome,
    results: [...state.results, outcome],
    items: again ? [...state.items, { card: outcome.card, mistake: item.mistake }] : state.items,
    requeued: again ? [...state.requeued, item.card.id] : state.requeued,
  }
}

export function reduceSession(state: ReviewSessionState, action: ReviewAction): ReviewSessionState {
  switch (action.type) {
    case 'play': {
      if (state.phase !== 'solving' || state.solve?.status !== 'solving') return state
      const moved = playUserMove(state.solve, action.move)
      if (moved.verdict === 'correct') return { ...state, solve: moved.state, hint: null }
      if (moved.verdict === 'solved') return finish(state, moved.state, true, action.at)
      return finish(state, markMissed(moved.state), false, action.at)
    }
    case 'reply': {
      if (state.phase !== 'solving' || state.solve === null) return state
      const replied = playOpponentReply(state.solve)
      return replied.status === 'solved'
        ? finish(state, replied, true, action.at)
        : { ...state, solve: replied }
    }
    case 'hint': {
      if (state.phase !== 'solving' || state.solve === null) return state
      return {
        ...state,
        solve: withHint(state.solve, action.level),
        hint: hintFor(state.solve, action.level),
      }
    }
    case 'give-up': {
      if (state.phase !== 'solving' || state.solve === null) return state
      return finish(state, markMissed(state.solve), false, action.at)
    }
    case 'next': {
      if (state.phase !== 'recap') return state
      const opened = openFrom(state.items, state.index + 1)
      if (opened === null)
        return { ...state, phase: 'done', solve: null, hint: null, outcome: null }
      return {
        ...state,
        index: opened.index,
        phase: 'solving',
        solve: opened.solve,
        hint: null,
        startedAtMs: action.at,
        outcome: null,
      }
    }
  }
}

export interface SessionSummary {
  readonly attempted: number
  readonly recalled: number
  readonly toRevisit: number
  readonly newlyMastered: number
  /** The soonest a card from this session comes back, or `null` if none were scheduled. */
  readonly nextDue: Timestamp | null
}

export function summarise(state: ReviewSessionState): SessionSummary {
  const recalled = state.results.filter((result) => result.solved).length
  const dues = state.results.map((result) => result.card.due)
  return {
    attempted: state.results.length,
    recalled,
    toRevisit: state.results.length - recalled,
    newlyMastered: state.results.filter(
      (result) => result.card.state === 'mastered' && result.stateBefore !== 'mastered',
    ).length,
    nextDue: dues.length === 0 ? null : timestampFromDate(new Date(Math.min(...dues))),
  }
}

/** Distinct cards in play, for "3 of 7" — a card shown twice is still one card. */
export function totalCards(state: ReviewSessionState): number {
  return new Set(state.items.map((item) => item.card.id)).size
}

export function cardsDone(state: ReviewSessionState): number {
  return new Set(state.results.map((result) => result.card.id)).size
}

export type ReviewDot = 'solved' | 'missed' | 'current' | 'todo'

/** One dot per queued attempt, in order; the same shape the puzzle solver's header uses. */
export function progressDots(state: ReviewSessionState): ReviewDot[] {
  return state.items.map((_, index) => {
    const result = state.results[index]
    if (result !== undefined) return result.solved ? 'solved' : 'missed'
    return index === state.index && state.phase === 'solving' ? 'current' : 'todo'
  })
}
