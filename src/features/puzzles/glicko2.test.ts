import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DEVIATION,
  DEFAULT_RATING,
  DEFAULT_VOLATILITY,
  decayDeviation,
  expectedScore,
  GLICKO2_SCALE,
  MIN_DEVIATION,
  ratingInterval,
  updateRating,
  type GlickoRating,
} from './glicko2'

/**
 * The reference values come from Mark Glickman's "Example of the Glicko-2 system"
 * (glicko.net/glicko/glicko2.pdf, the worked example on pages 2–4): a player rated
 * 1500 with RD 200 and volatility 0.06, τ = 0.5, who beats 1400/30 and then loses to
 * 1550/100 and 1700/300 inside one rating period.
 *
 * The paper reports the answer on the Glicko-2 scale — µ' = −0.2069, φ' = 0.8722,
 * σ' = 0.05999 — and converts it back to r' = 1464.06, RD' = 151.52. Both are asserted
 * below, because a sign error in the conversion is exactly the kind of bug that leaves
 * the maths right and the app wrong.
 */
const PAPER_PLAYER: GlickoRating = { rating: 1500, deviation: 200, volatility: 0.06 }
const PAPER_RESULTS = [
  { rating: 1400, deviation: 30, score: 1 },
  { rating: 1550, deviation: 100, score: 0 },
  { rating: 1700, deviation: 300, score: 0 },
] as const

describe('Glicko-2 against the published worked example', () => {
  it("reproduces the paper's new rating, deviation and volatility", () => {
    const updated = updateRating(PAPER_PLAYER, PAPER_RESULTS, { tau: 0.5 })

    expect(updated.rating).toBeCloseTo(1464.06, 1)
    expect(updated.deviation).toBeCloseTo(151.52, 1)
    // The paper prints σ' to five places (0.05999); the unrounded value is 0.0599960.
    expect(updated.volatility).toBeCloseTo(0.05999, 4)
  })

  it('lands on the same numbers on the Glicko-2 scale the paper works in', () => {
    const updated = updateRating(PAPER_PLAYER, PAPER_RESULTS, { tau: 0.5 })

    expect((updated.rating - DEFAULT_RATING) / GLICKO2_SCALE).toBeCloseTo(-0.2069, 4)
    expect(updated.deviation / GLICKO2_SCALE).toBeCloseTo(0.8722, 4)
  })

  it('reproduces the expected scores the paper computes in step 3', () => {
    // E against 1400/30, 1550/100 and 1700/300 for a 1500/200 player: .639, .432, .303.
    const expectations = PAPER_RESULTS.map((result) => expectedScore(PAPER_PLAYER, result))

    expect(expectations[0]).toBeCloseTo(0.639, 3)
    expect(expectations[1]).toBeCloseTo(0.432, 3)
    expect(expectations[2]).toBeCloseTo(0.303, 3)
  })
})

describe('Glicko-2 behaviour the app depends on', () => {
  const settled: GlickoRating = { rating: 1500, deviation: 60, volatility: 0.06 }

  it('leaves the rating alone and widens the deviation when nothing was played', () => {
    const idle = updateRating(settled, [])

    expect(idle.rating).toBe(settled.rating)
    expect(idle.deviation).toBeGreaterThan(settled.deviation)
    expect(idle.volatility).toBe(settled.volatility)
  })

  it('grows the deviation with idle days and never past the 350 ceiling', () => {
    expect(decayDeviation(settled, 0)).toEqual(settled)
    expect(decayDeviation(settled, 30).deviation).toBeGreaterThan(
      decayDeviation(settled, 5).deviation,
    )
    expect(decayDeviation(settled, 100_000).deviation).toBe(DEFAULT_DEVIATION)
  })

  it('moves an uncertain rating further than a settled one on the same result', () => {
    const fresh: GlickoRating = {
      rating: DEFAULT_RATING,
      deviation: DEFAULT_DEVIATION,
      volatility: DEFAULT_VOLATILITY,
    }
    const win = { rating: 1500, deviation: 80, score: 1 } as const

    const freshGain = updateRating(fresh, [win]).rating - fresh.rating
    const settledGain = updateRating(settled, [win]).rating - settled.rating

    expect(freshGain).toBeGreaterThan(settledGain)
    expect(settledGain).toBeGreaterThan(0)
  })

  it('rewards a win over a stronger opponent more than one over a weaker opponent', () => {
    const overStronger = updateRating(settled, [{ rating: 1800, deviation: 80, score: 1 }])
    const overWeaker = updateRating(settled, [{ rating: 1200, deviation: 80, score: 1 }])

    expect(overStronger.rating - settled.rating).toBeGreaterThan(overWeaker.rating - settled.rating)
  })

  it('keeps the deviation above the floor no matter how much is played', () => {
    let player = settled
    for (let round = 0; round < 500; round += 1) {
      player = updateRating(player, [{ rating: 1500, deviation: 60, score: round % 2 }])
    }

    expect(player.deviation).toBeGreaterThanOrEqual(MIN_DEVIATION)
  })

  it('scores an even match at one half and reports a symmetric interval', () => {
    expect(expectedScore(settled, { rating: 1500, deviation: 60 })).toBeCloseTo(0.5, 6)
    expect(ratingInterval(settled)).toEqual({ low: 1380, high: 1620 })
  })
})
