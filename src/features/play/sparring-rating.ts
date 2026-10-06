import type { Color, GameResult } from '@/domain'

/** How far one game can move a rating. Large enough to settle in a handful of games. */
const K_FACTOR = 32
const MIN_RATING = 100
const MAX_RATING = 3500

/** Fewer plies than this is a game abandoned at the start, not a result worth rating. */
export const MIN_RATED_PLIES = 4

/** 1 for a win, 0.5 for a draw, 0 for a loss, `undefined` while the game is still going. */
export function scoreFor(result: GameResult, youPlay: Color): number | undefined {
  if (result === '1/2-1/2') return 0.5
  if (result === '1-0') return youPlay === 'white' ? 1 : 0
  if (result === '0-1') return youPlay === 'black' ? 1 : 0
  return undefined
}

/** Standard Elo: the expected score is what the rating gap predicts, and the change is
 *  proportional to how far the actual result was from it. */
export function eloAfter(rating: number, opponent: number, score: number): number {
  const expected = 1 / (1 + 10 ** ((opponent - rating) / 400))
  const next = Math.round(rating + K_FACTOR * (score - expected))
  return Math.min(Math.max(next, MIN_RATING), MAX_RATING)
}
