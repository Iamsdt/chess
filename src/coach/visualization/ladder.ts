import type { BoardView } from '@/domain'

import type { NarrationLevel } from './narrate'

/**
 * The visualization ladder (coach-agent.md §10.3): four dials that adapt to the user.
 * Pure on purpose, so the rules can be tested without a board.
 */

export const LINE_LENGTHS = [2, 4, 6, 8, 10, 12] as const
export const LADDER_VIEWS = [
  'normal',
  'ghost',
  'frozen',
  'partial',
  'blindfold',
] as const satisfies readonly BoardView[]
export const PIECE_BANDS = ['few', 'some', 'full'] as const
export const LADDER_NARRATIONS = [
  'full',
  'piece',
  'san',
] as const satisfies readonly NarrationLevel[]

export type PieceBand = (typeof PIECE_BANDS)[number]

/** Each dial is an index into its own scale; higher is harder. */
export interface Dials {
  readonly length: number
  readonly view: number
  readonly pieces: number
  readonly narration: number
}
export type DialName = keyof Dials

/** The order ties are broken in, and the order a fresh ladder climbs. */
const DIAL_ORDER: readonly DialName[] = ['length', 'view', 'pieces', 'narration']

const MAX: Readonly<Record<DialName, number>> = {
  length: LINE_LENGTHS.length - 1,
  view: LADDER_VIEWS.length - 1,
  pieces: PIECE_BANDS.length - 1,
  narration: LADDER_NARRATIONS.length - 1,
}

export const RAISE_AFTER = 3
export const LOWER_AFTER = 2
/** Accuracy a length needs before it counts towards span. */
export const SPAN_ACCURACY = 0.8

export interface Attempt {
  /** The line length the user was asked to hold. */
  readonly plies: number
  readonly correct: boolean
}

export interface LadderState {
  readonly dials: Dials
  /** Correct answers in a row. */
  readonly streak: number
  /** Misses in a row. */
  readonly misses: number
  /** How many times a dial has been raised; the next raise goes to the next dial in turn. */
  readonly raises: number
  readonly attempts: readonly Attempt[]
}

export interface DialChange {
  readonly dial: DialName
  readonly direction: 'up' | 'down'
  /** One calm sentence that says what changed and why. */
  readonly reason: string
}

export interface LadderStep {
  readonly state: LadderState
  readonly change: DialChange | null
}

export function initialLadder(dials?: Partial<Dials>): LadderState {
  return {
    dials: { length: 1, view: 1, pieces: 1, narration: 0, ...dials },
    streak: 0,
    misses: 0,
    raises: 0,
    attempts: [],
  }
}

export const plies = (dials: Dials): number => LINE_LENGTHS[dials.length] ?? 4
export const viewOf = (dials: Dials): BoardView => LADDER_VIEWS[dials.view] ?? 'frozen'
export const bandOf = (dials: Dials): PieceBand => PIECE_BANDS[dials.pieces] ?? 'some'
export const narrationOf = (dials: Dials): NarrationLevel =>
  LADDER_NARRATIONS[dials.narration] ?? 'full'

const progress = (dials: Dials, name: DialName): number => dials[name] / MAX[name]

function describe(dials: Dials, name: DialName): string {
  switch (name) {
    case 'length':
      return `${String(plies(dials))} plies`
    case 'view':
      return `${viewOf(dials)} view`
    case 'pieces':
      return `${bandOf(dials)} pieces`
    case 'narration':
      return narrationOf(dials) === 'san' ? 'plain notation' : 'moves spoken out'
  }
}

function move(state: LadderState, direction: 'up' | 'down', why: string): LadderStep {
  const open = DIAL_ORDER.filter((name) =>
    direction === 'up' ? state.dials[name] < MAX[name] : state.dials[name] > 0,
  )
  // Raising takes the dials in turn (line length first); lowering relieves the one furthest ahead.
  const pick =
    direction === 'up'
      ? DIAL_ORDER.slice(state.raises % DIAL_ORDER.length)
          .concat(DIAL_ORDER.slice(0, state.raises % DIAL_ORDER.length))
          .find((name) => open.includes(name))
      : open.reduce<DialName | undefined>(
          (best, name) =>
            best === undefined || progress(state.dials, name) > progress(state.dials, best)
              ? name
              : best,
          undefined,
        )
  const reset = { ...state, streak: 0, misses: 0 }
  if (pick === undefined) return { state: reset, change: null }
  const dials: Dials = { ...state.dials, [pick]: state.dials[pick] + (direction === 'up' ? 1 : -1) }
  const lead = direction === 'up' ? 'Next:' : 'Easing off:'
  return {
    state: { ...reset, dials, raises: direction === 'up' ? state.raises + 1 : state.raises },
    change: { dial: pick, direction, reason: `${why} ${lead} ${describe(dials, pick)}.` },
  }
}

/**
 * Records one answer. Three right in a row raises one dial; two misses in a row lower one.
 */
export function recordAnswer(state: LadderState, result: Attempt): LadderStep {
  const next: LadderState = {
    ...state,
    streak: result.correct ? state.streak + 1 : 0,
    misses: result.correct ? 0 : state.misses + 1,
    attempts: [...state.attempts, result],
  }
  if (next.streak >= RAISE_AFTER) return move(next, 'up', 'Three right in a row.')
  if (next.misses >= LOWER_AFTER) return move(next, 'down', 'Two misses in a row.')
  return { state: next, change: null }
}

/** The user asked for something easier: lowers one dial now and says why. */
export function stepDown(state: LadderState): LadderStep {
  return move(state, 'down', 'You asked for a little more help.')
}

/**
 * Visualization span: the longest line followed at 80% or better.
 * Why per length: one lucky answer at a long line should count, but three misses at it
 * with one hit should not.
 */
export function spanOf(attempts: readonly Attempt[]): number {
  const byLength = new Map<number, { right: number; total: number }>()
  for (const attempt of attempts) {
    const row = byLength.get(attempt.plies) ?? { right: 0, total: 0 }
    row.total += 1
    if (attempt.correct) row.right += 1
    byLength.set(attempt.plies, row)
  }
  let best = 0
  for (const [length, row] of byLength) {
    if (row.right / row.total >= SPAN_ACCURACY) best = Math.max(best, length)
  }
  return best
}
