import type { HintLevel, ReviewGrade } from '@/domain'

/**
 * Turning one attempt into the grade the scheduler wants.
 *
 * FSRS asks the user to self-rate; a position with one right answer does not need to.
 * Correctness, help and speed say what an honest rating would have been, and it spares
 * the user a four-button decision after every board.
 */

/** Under this, finding the move unaided reads as "easy": it was already in their hands. */
export const EASY_WITHIN_MS = 8_000

/** Over this, an unaided find reads as "hard": right, but it took work. */
export const HARD_AFTER_MS = 40_000

export interface Attempt {
  /** Whether the whole line was played correctly. */
  readonly solved: boolean
  /** How many wrong moves came before it. Any wrong move counts as a miss on a review card. */
  readonly wrongMoves: number
  readonly hintUsed: HintLevel | null
  readonly durationMs: number
  /** True on a card's first sighting; a first success is never rated `easy`. */
  readonly firstSighting?: boolean | undefined
}

/**
 * - A miss, a wrong move, or the move shown to you: `again`.
 * - A nudge or a focus square: `hard`, because help was needed.
 * - Unaided and slow: `hard`. Unaided and quick: `easy`, except on a first sighting, which
 *   would otherwise skip a new card straight to a two-week gap. Otherwise `good`.
 */
export function gradeAttempt(attempt: Attempt): ReviewGrade {
  if (!attempt.solved || attempt.wrongMoves > 0 || attempt.hintUsed === 'move') return 'again'
  if (attempt.hintUsed !== null) return 'hard'
  if (attempt.durationMs >= HARD_AFTER_MS) return 'hard'
  if (attempt.durationMs <= EASY_WITHIN_MS && attempt.firstSighting !== true) return 'easy'
  return 'good'
}
