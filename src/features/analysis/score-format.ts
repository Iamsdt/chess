import { scoreToWhiteCentipawns, type Color, type EngineScore } from '@/domain'

/**
 * Turning an engine score into words, in one place.
 *
 * The eval bar prints it, the line list prints it and the live region speaks it,
 * and all three have to agree — a bar reading `+0.2` beside a line reading `+0.22`
 * is the kind of small contradiction that makes a player stop trusting the screen.
 */

/** Beyond this the exact number stops meaning anything to a human. */
export const MAX_DISPLAY_PAWNS = 10
export const MIN_DISPLAY_PAWNS = -10

/** Centipawns at which the eval bar's curve is about 73% — roughly "clearly better". */
export const SQUASH_CP = 400

function mateIsForWhite(moves: number, sideToMove: Color): boolean {
  return moves >= 0 === (sideToMove === 'white')
}

/** White's share of the bar, squashed so +1 and +2 stay distinguishable and +8 and +9 do not. */
export function whiteShare(score: EngineScore, sideToMove: Color): number {
  if (score.kind === 'mate') return mateIsForWhite(score.moves, sideToMove) ? 1 : 0
  return 1 / (1 + Math.exp(-scoreToWhiteCentipawns(score, sideToMove) / SQUASH_CP))
}

/** White's score in pawns, clamped to what the bar can show. */
export function displayPawns(score: EngineScore, sideToMove: Color): number {
  if (score.kind === 'mate') {
    return mateIsForWhite(score.moves, sideToMove) ? MAX_DISPLAY_PAWNS : MIN_DISPLAY_PAWNS
  }
  const pawns = scoreToWhiteCentipawns(score, sideToMove) / 100
  return Math.max(MIN_DISPLAY_PAWNS, Math.min(MAX_DISPLAY_PAWNS, pawns))
}

/** The short label: `+0.22`, `-1.40`, `M4`, `-M3`. Always from White's point of view. */
export function formatScore(score: EngineScore, sideToMove: Color): string {
  if (score.kind === 'mate') {
    const prefix = mateIsForWhite(score.moves, sideToMove) ? '' : '-'
    return `${prefix}M${String(Math.abs(score.moves))}`
  }
  const pawns = displayPawns(score, sideToMove)
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`
}

/** Plain words, for the meter's `aria-valuetext`. */
export function describeScore(score: EngineScore, sideToMove: Color): string {
  if (score.kind === 'mate') {
    const forWhite = mateIsForWhite(score.moves, sideToMove)
    return `mate in ${String(Math.abs(score.moves))} for ${forWhite ? 'White' : 'Black'}`
  }
  const pawns = scoreToWhiteCentipawns(score, sideToMove) / 100
  if (Math.abs(pawns) < 0.3) return 'about equal'
  const leader = pawns > 0 ? 'White' : 'Black'
  if (Math.abs(pawns) < 1) return `${leader} is slightly better`
  if (Math.abs(pawns) < 3) return `${leader} is clearly better`
  return `${leader} is winning`
}
