import type { HintLevel } from '@/domain'

import {
  DEFAULT_DEVIATION,
  DEFAULT_RATING,
  DEFAULT_VOLATILITY,
  expectedScore,
  GLICKO2_SCALE,
  updateRating,
  type GlickoRating,
} from './glicko2'

/**
 * What a puzzle attempt does to the user's rating.
 *
 * Glicko-2 is the arithmetic (`glicko2.ts`); this file is the policy — how much a hint
 * costs, when an attempt stops counting, and which puzzle rating gives the user the
 * three-in-four success rate the sprint is aiming at. It is separate from the arithmetic
 * so the policy can be argued about and changed without anyone re-deriving the maths.
 */

/**
 * The deviation the dataset's puzzle ratings are treated as having.
 *
 * The Lichess ratings come from tens of thousands of attempts each, so they are far more
 * settled than the user's; 75 keeps a single surprising puzzle from moving the user much
 * while still letting a run of them move it plenty.
 */
export const PUZZLE_DEVIATION = 75

/** Ratings are stored through `RatingSchema`, which is an integer 0–4000. */
export const MIN_STORED_RATING = 0
export const MAX_STORED_RATING = 4000

/**
 * What each rung of the hint ladder leaves a solve worth.
 *
 * A nudge still asks the user to find the move, so it keeps most of the credit. A circled
 * square has done the seeing for them, so it keeps half. Being shown the move keeps
 * nothing — that attempt is unrated, which is what the solver tells the user *before*
 * they open it.
 */
export const HINT_CREDIT: Record<HintLevel, number> = {
  nudge: 0.75,
  square: 0.5,
  move: 0,
}

/** The state a rated attempt starts from when the app has never rated anything. */
export const DEFAULT_RATING_STATE: GlickoRating = {
  rating: DEFAULT_RATING,
  deviation: DEFAULT_DEVIATION,
  volatility: DEFAULT_VOLATILITY,
}

/** What the solver knows about an attempt by the time it is over. */
export interface AttemptOutcome {
  readonly puzzleRating: number
  readonly solved: boolean
  /** The highest rung reached, or `null` when the user took no hint. */
  readonly hintUsed: HintLevel | null
  /** A skipped puzzle is a miss the user chose; it counts, but never as a solve. */
  readonly skipped?: boolean | undefined
}

/**
 * The score Glicko-2 sees for an attempt, or `null` when the attempt is unrated.
 *
 * Why a partial score rather than a rating discount: a hinted solve is genuinely
 * somewhere between solving and not solving, and saying so in the score keeps one
 * number — the score — carrying the whole story into the maths.
 */
export function attemptScore(outcome: AttemptOutcome): number | null {
  if (outcome.hintUsed === 'move') return null
  if (outcome.skipped === true) return 0
  if (!outcome.solved) return 0
  return outcome.hintUsed === null ? 1 : HINT_CREDIT[outcome.hintUsed]
}

export interface RatingChange {
  readonly before: GlickoRating
  readonly after: GlickoRating
  /** Rounded the way the UI shows it: `+9`, `−4`, or `0` for an unrated attempt. */
  readonly delta: number
  /** False when a revealed move (or a puzzle with no rating) took the attempt out. */
  readonly rated: boolean
}

/**
 * One attempt, one rating period.
 *
 * Why a period of one: the app has no schedule to batch attempts into, and a user who
 * solves three puzzles and closes the tab must still see the rating they earned. The cost
 * is that Glicko-2's deviation shrinks a little faster than it would with true periods,
 * which is why {@link PUZZLE_DEVIATION} is generous and the deviation has a floor.
 */
export function applyAttempt(
  before: GlickoRating,
  outcome: AttemptOutcome,
  options?: { readonly tau?: number | undefined },
): RatingChange {
  const score = attemptScore(outcome)
  if (score === null) {
    return { before, after: before, delta: 0, rated: false }
  }
  const after = updateRating(
    before,
    [{ rating: outcome.puzzleRating, deviation: PUZZLE_DEVIATION, score }],
    options === undefined ? undefined : { tau: options.tau },
  )
  return {
    before,
    after,
    delta: Math.round(after.rating) - Math.round(before.rating),
    rated: true,
  }
}

/** How often this user should solve a puzzle of this rating, under the model. */
export function expectedSuccess(player: GlickoRating, puzzleRating: number): number {
  return expectedScore(player, { rating: puzzleRating, deviation: PUZZLE_DEVIATION })
}

/**
 * The puzzle rating at which this user is expected to succeed `probability` of the time.
 *
 * This is {@link expectedSuccess} solved for the puzzle's rating, and it is the whole of
 * "difficulty tuned so you solve about 75%": ask for 0.75 and the answer is a rating
 * roughly 190 points below the user's own.
 */
export function ratingForSuccess(player: GlickoRating, probability: number): number {
  const bounded = Math.min(Math.max(probability, 0.01), 0.99)
  const playerMu = (player.rating - DEFAULT_RATING) / GLICKO2_SCALE
  const puzzlePhi = PUZZLE_DEVIATION / GLICKO2_SCALE
  const gPhi = 1 / Math.sqrt(1 + (3 * puzzlePhi * puzzlePhi) / (Math.PI * Math.PI))
  const puzzleMu = playerMu - Math.log(bounded / (1 - bounded)) / gPhi
  return puzzleMu * GLICKO2_SCALE + DEFAULT_RATING
}

/** Why: `RatingSchema` takes an integer in 0–4000 and a write must never fail on a float. */
export function toStoredRating(rating: number): number {
  return Math.min(Math.max(Math.round(rating), MIN_STORED_RATING), MAX_STORED_RATING)
}
