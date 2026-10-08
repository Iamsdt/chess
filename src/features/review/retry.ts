import { INACCURACY_LOSS, winPercentFromScore } from '@/chess'
import {
  oppositeColor,
  type Color,
  type EngineScore,
  type MoveQuality,
  type MoveRecord,
  type Uci,
} from '@/domain'

/**
 * S13 · "Retry this position": judging a second attempt at a move the user got wrong.
 *
 * Pure so the dialog only lays things out. The first two verdicts need nothing but the
 * stored review; only a move the review never saw needs the engine, and for that this
 * module just turns the engine's score into a verdict.
 */

/** The verdicts worth retrying: the moves that cost winning chances. */
const RETRYABLE: ReadonlySet<MoveQuality> = new Set(['inaccuracy', 'mistake', 'miss', 'blunder'])

/** A move can be retried when the review kept both what was better and where it stood. */
export function canRetry(move: MoveRecord, youPlay: Color): boolean {
  return (
    move.color === youPlay &&
    move.quality !== undefined &&
    RETRYABLE.has(move.quality) &&
    move.bestMove !== undefined &&
    move.evalBefore !== undefined
  )
}

export type RetryVerdict =
  /** The engine's own choice. */
  | 'best'
  /** Not the engine's choice, but it keeps the position. */
  | 'good'
  /** Still gives away winning chances. */
  | 'worse'
  /** The move already played in the game. */
  | 'repeat'

/** What can be said about an attempt without asking the engine. */
export function judgeKnownAttempt(
  tried: Uci,
  move: Pick<MoveRecord, 'uci' | 'bestMove'>,
): 'best' | 'repeat' | 'unknown' {
  if (tried === move.bestMove) return 'best'
  if (tried === move.uci) return 'repeat'
  return 'unknown'
}

/**
 * Win percentage the alternative gives away, by the mover's own count.
 *
 * `scoreAfter` is the engine's score for the position after the alternative, which it
 * reports from the opponent's side because the opponent is to move there.
 */
export function alternativeLoss(move: MoveRecord, scoreAfter: EngineScore): number | undefined {
  if (move.evalBefore === undefined) return undefined
  const before = winPercentFromScore(move.evalBefore, move.color, move.color)
  const after = winPercentFromScore(scoreAfter, oppositeColor(move.color), move.color)
  return Math.max(0, before - after)
}

/** Within an inaccuracy's worth of the original position counts as holding it. */
export function verdictForLoss(loss: number): 'good' | 'worse' {
  return loss < INACCURACY_LOSS ? 'good' : 'worse'
}

/** What to tell the user; the engine's move is named only where the engine agrees. */
export function retryMessage(verdict: RetryVerdict, bestSan: string | undefined): string {
  const engineMove = bestSan ?? 'the engine’s move'
  switch (verdict) {
    case 'best':
      return `Yes, ${engineMove} is what the engine chose.`
    case 'good':
      return `That holds the position too. The engine’s first choice was ${engineMove}.`
    case 'worse':
      return 'That still gives away winning chances. Try another move, or show the answer.'
    case 'repeat':
      return 'That is the move you played in the game. Look for something else.'
  }
}
