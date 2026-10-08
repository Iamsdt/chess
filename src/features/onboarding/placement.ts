import { STARTING_RATINGS, type Puzzle, type SkillLevel } from '@/domain'
import {
  applyAttempt,
  DEFAULT_DEVIATION,
  DEFAULT_VOLATILITY,
  toStoredRating,
  type GlickoRating,
} from '@/features/puzzles'

/** Five puzzles is the promise made on the setup screen: short enough to feel optional. */
export const PLACEMENT_COUNT = 5

/** One placement puzzle as the user left it. */
export interface PlacementOutcome {
  readonly puzzleRating: number
  readonly solved: boolean
}

/**
 * Where placement starts: the self-described level, with the full deviation.
 *
 * Why the deviation stays at its maximum: the level answer is a guess, and the first
 * results should be able to overrule it quickly.
 */
export function placementSeed(level: SkillLevel): GlickoRating {
  return {
    rating: STARTING_RATINGS[level],
    deviation: DEFAULT_DEVIATION,
    volatility: DEFAULT_VOLATILITY,
  }
}

/**
 * The Glicko-2 state after the outcomes, played one rating period each.
 *
 * Reusing `applyAttempt` rather than a placement-only formula means a seeded rating moves
 * the way every later puzzle will move it, so the first real session carries no jolt.
 */
export function placementRating(
  seed: GlickoRating,
  outcomes: readonly PlacementOutcome[],
): GlickoRating {
  let current = seed
  for (const outcome of outcomes) {
    current = applyAttempt(current, {
      puzzleRating: outcome.puzzleRating,
      solved: outcome.solved,
      hintUsed: null,
    }).after
  }
  return { ...current, rating: toStoredRating(current.rating) }
}

/**
 * The puzzle closest to the current estimate, skipping any already asked.
 *
 * Why closest and not "a bit easier": placement is measuring, not teaching, and a puzzle
 * at the estimate is the one whose result tells the most.
 */
export function pickPlacementPuzzle(
  candidates: readonly Puzzle[],
  target: number,
  askedIds: ReadonlySet<string>,
): Puzzle | undefined {
  let best: Puzzle | undefined
  for (const puzzle of candidates) {
    if (askedIds.has(puzzle.id)) continue
    if (best === undefined || Math.abs(puzzle.rating - target) < Math.abs(best.rating - target)) {
      best = puzzle
    }
  }
  return best
}
