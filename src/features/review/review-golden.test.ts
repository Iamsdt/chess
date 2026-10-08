import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { reviewGame, type GameReview } from './analyse'
import { RECORDED_GAMES, recordedEngine, recordedGame } from './recorded-engine'

/**
 * Golden-file review of three games.
 *
 * The engine side is recorded (Lichess's published Stockfish scores for three real games),
 * so what is compared here is everything the review makes of them: accuracy, verdict counts,
 * every move's verdict and explanation, the turning points and the bank candidates. A change
 * to any threshold or sentence shows up as a diff in `review-golden.json`; if the change is
 * intended, regenerate with `UPDATE_GOLDEN=1 npx vitest run src/features/review/review-golden`
 * and read the diff before committing it.
 */

const GOLDEN_PATH = join(process.cwd(), 'src/features/review/review-golden.json')

/** What is worth pinning, flattened so a diff reads like the game. */
function summarise(review: GameReview) {
  return {
    accuracy: review.accuracy,
    counts: review.counts,
    moves: review.moves.map(
      (move) => `${String(move.ply)} ${move.san} ${move.quality ?? '-'}: ${move.explanation ?? ''}`,
    ),
    keyMoments: review.keyMoments.map(
      (moment) => `${String(moment.ply)} ${moment.san} ${moment.quality}`,
    ),
    bank: review.mistakes.map(
      (draft) => `${String(draft.ply)} ${draft.playedSan} ${draft.quality}`,
    ),
  }
}

async function reviewAll() {
  const out: Record<string, ReturnType<typeof summarise>> = {}
  for (const recorded of RECORDED_GAMES) {
    const review = await reviewGame(recordedGame(recorded), recordedEngine(recorded).evaluate)
    if (!review.ok) throw new Error(review.error.message)
    out[recorded.id] = summarise(review.value)
  }
  return out
}

describe('review golden file', () => {
  it('covers three games', () => {
    expect(RECORDED_GAMES).toHaveLength(3)
  })

  it('reviews all three exactly as the committed golden file says', async () => {
    const actual = await reviewAll()
    if (process.env.UPDATE_GOLDEN === '1') {
      writeFileSync(GOLDEN_PATH, `${JSON.stringify(actual, null, 2)}\n`)
    }
    const expected: unknown = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'))
    expect(actual).toEqual(expected)
  })

  it('stays close to the accuracy Lichess published for the same evaluations', async () => {
    const actual = await reviewAll()
    for (const recorded of RECORDED_GAMES) {
      const lichess = recorded.lichess
      const ours = actual[recorded.id]?.accuracy
      expect(ours?.white).toBeCloseTo(lichess.accuracy.white, 0)
      expect(ours?.black).toBeCloseTo(lichess.accuracy.black, 0)
    }
  })
})
