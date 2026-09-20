import { describe, expect, it } from 'vitest'

import { createGame } from '@/chess'
import { toFen, toUci } from '@/domain'
import { MAX_UCI_ELO, MIN_STRENGTH_ELO } from '@/engine'

import {
  chooseOpponentMove,
  expectedScore,
  OPPONENT_RATING_MAX,
  OPPONENT_RATING_MIN,
  planStrength,
  respondToDrawOffer,
  strengthBand,
  STRENGTH_ANCHORS,
} from './strength'

/** A sequence, so "the opponent blunders" is a fact of the test and not a chance. */
function scriptedRandom(values: readonly number[]): () => number {
  let index = 0
  return () => values[index++ % values.length] ?? 0
}

describe('the rating → engine mapping', () => {
  it('reproduces each anchor exactly', () => {
    for (const anchor of STRENGTH_ANCHORS) {
      const plan = planStrength(anchor.rating)
      expect(plan.elo).toBe(anchor.elo)
      expect(plan.movetimeMs).toBe(anchor.movetimeMs)
      expect(plan.inaccuracyChance).toBeCloseTo(anchor.inaccuracyChance, 4)
      expect(plan.inaccuracyCeilingCp).toBe(anchor.inaccuracyCeilingCp)
    }
  })

  it('interpolates between anchors and never runs backwards', () => {
    const half = planStrength(1000)
    expect(half.elo).toBe(1000)
    expect(half.movetimeMs).toBe(250)
    expect(half.inaccuracyChance).toBeCloseTo(0.14, 3)

    let previous = planStrength(OPPONENT_RATING_MIN)
    for (let rating = OPPONENT_RATING_MIN + 50; rating <= OPPONENT_RATING_MAX; rating += 50) {
      const plan = planStrength(rating)
      expect(plan.elo).toBeGreaterThanOrEqual(previous.elo)
      expect(plan.movetimeMs).toBeGreaterThanOrEqual(previous.movetimeMs)
      expect(plan.inaccuracyChance).toBeLessThanOrEqual(previous.inaccuracyChance + 1e-9)
      previous = plan
    }
  })

  it('clamps to the slider and to what the engine accepts', () => {
    expect(planStrength(-500).rating).toBe(OPPONENT_RATING_MIN)
    expect(planStrength(9000).rating).toBe(OPPONENT_RATING_MAX)
    for (const rating of [OPPONENT_RATING_MIN, 1200, OPPONENT_RATING_MAX]) {
      const plan = planStrength(rating)
      expect(plan.elo).toBeGreaterThanOrEqual(MIN_STRENGTH_ELO)
      expect(plan.elo).toBeLessThanOrEqual(MAX_UCI_ELO)
    }
  })

  it('hands the engine the rating itself once the limiter can take it', () => {
    for (const rating of [1200, 1400, 1600, 2000, 2400]) {
      expect(planStrength(rating).elo).toBe(rating)
    }
  })

  it('names the band the setup screen prints', () => {
    expect(strengthBand(400)).toBe('gentle')
    expect(strengthBand(1000)).toBe('learning')
    expect(strengthBand(1200)).toBe('club')
    expect(strengthBand(1800)).toBe('strong')
    expect(strengthBand(2400)).toBe('expert')
  })
})

describe('human-like inaccuracy', () => {
  const position = createGame()
  const game = position.ok ? position.value : null

  it('plays the engine move when the roll says so', () => {
    expect(game).not.toBeNull()
    if (game === null) return
    const choice = chooseOpponentMove(
      game,
      toUci('e2e4'),
      planStrength(1200),
      scriptedRandom([0.99]),
    )
    expect(choice).toEqual({ uci: toUci('e2e4'), deliberateInaccuracy: false })
  })

  it('plays something else when it does not', () => {
    expect(game).not.toBeNull()
    if (game === null) return
    const choice = chooseOpponentMove(
      game,
      toUci('e2e4'),
      planStrength(400),
      scriptedRandom([0, 0]),
    )
    expect(choice.deliberateInaccuracy).toBe(true)
    expect(choice.uci).not.toBe(toUci('e2e4'))
  })

  it('never turns the dial at full strength', () => {
    expect(game).not.toBeNull()
    if (game === null) return
    const choice = chooseOpponentMove(game, toUci('e2e4'), planStrength(2400), () => 0)
    expect(choice.deliberateInaccuracy).toBe(false)
  })

  it('keeps the inaccuracy inside the band`s ceiling', () => {
    // White to move with a queen that can be taken from several squares: a 2000
    // may misplace a pawn, but must not be allowed to drop the queen.
    const loose = createGame(toFen('4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1'))
    expect(loose.ok).toBe(true)
    if (!loose.ok) return
    for (let roll = 0; roll < 1; roll += 0.05) {
      const choice = chooseOpponentMove(
        loose.value,
        toUci('d1d5'),
        planStrength(2000),
        scriptedRandom([0, roll]),
      )
      expect(choice.uci).not.toBe(toUci('d1d4'))
    }
  })
})

describe('expected score and draw offers', () => {
  it('is the standard Elo logistic', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 6)
    expect(expectedScore(1600, 1200)).toBeCloseTo(0.909, 3)
    expect(expectedScore(1200, 1600)).toBeCloseTo(0.091, 3)
  })

  it('accepts a draw when the engine is worse, declines when it is better', () => {
    expect(respondToDrawOffer(-150, 20)).toBe(true)
    expect(respondToDrawOffer(150, 20)).toBe(false)
    expect(respondToDrawOffer(null, 200)).toBe(false)
  })

  it('accepts a dead-level long game', () => {
    expect(respondToDrawOffer(10, 80)).toBe(true)
    expect(respondToDrawOffer(10, 20)).toBe(false)
  })
})
