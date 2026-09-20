import { describe, expect, it } from 'vitest'

import { DEFAULT_DEVIATION, DEFAULT_RATING, type GlickoRating } from './glicko2'
import {
  applyAttempt,
  attemptScore,
  DEFAULT_RATING_STATE,
  expectedSuccess,
  HINT_CREDIT,
  MAX_STORED_RATING,
  ratingForSuccess,
  toStoredRating,
} from './rating'

const settled: GlickoRating = { rating: 1500, deviation: 60, volatility: 0.06 }

describe('what an attempt is worth', () => {
  it('gives a clean solve full credit and a miss none', () => {
    expect(attemptScore({ puzzleRating: 1400, solved: true, hintUsed: null })).toBe(1)
    expect(attemptScore({ puzzleRating: 1400, solved: false, hintUsed: null })).toBe(0)
  })

  it('charges each hint rung, and takes the last one out of the rating entirely', () => {
    expect(attemptScore({ puzzleRating: 1400, solved: true, hintUsed: 'nudge' })).toBe(
      HINT_CREDIT.nudge,
    )
    expect(attemptScore({ puzzleRating: 1400, solved: true, hintUsed: 'square' })).toBe(
      HINT_CREDIT.square,
    )
    expect(attemptScore({ puzzleRating: 1400, solved: true, hintUsed: 'move' })).toBeNull()
  })

  it('counts a skip as a miss, not as a hole in the history', () => {
    expect(attemptScore({ puzzleRating: 1400, solved: false, hintUsed: null, skipped: true })).toBe(
      0,
    )
  })
})

describe('applying an attempt', () => {
  it('raises the rating on a solve and lowers it on a miss', () => {
    const solved = applyAttempt(settled, { puzzleRating: 1500, solved: true, hintUsed: null })
    const missed = applyAttempt(settled, { puzzleRating: 1500, solved: false, hintUsed: null })

    expect(solved.delta).toBeGreaterThan(0)
    expect(missed.delta).toBeLessThan(0)
    expect(solved.rated).toBe(true)
  })

  it('leaves everything untouched once the move has been shown', () => {
    const revealed = applyAttempt(settled, { puzzleRating: 1500, solved: true, hintUsed: 'move' })

    expect(revealed.rated).toBe(false)
    expect(revealed.delta).toBe(0)
    expect(revealed.after).toEqual(settled)
  })

  it('pays less for a hinted solve than for an unaided one', () => {
    const clean = applyAttempt(settled, { puzzleRating: 1500, solved: true, hintUsed: null })
    const nudged = applyAttempt(settled, { puzzleRating: 1500, solved: true, hintUsed: 'nudge' })

    expect(nudged.delta).toBeLessThan(clean.delta)
    expect(nudged.delta).toBeGreaterThan(0)
  })

  it('moves a brand-new rating further than a settled one', () => {
    const fresh = applyAttempt(DEFAULT_RATING_STATE, {
      puzzleRating: 1500,
      solved: true,
      hintUsed: null,
    })

    expect(fresh.delta).toBeGreaterThan(
      applyAttempt(settled, { puzzleRating: 1500, solved: true, hintUsed: null }).delta,
    )
    expect(DEFAULT_RATING_STATE).toEqual({
      rating: DEFAULT_RATING,
      deviation: DEFAULT_DEVIATION,
      volatility: 0.06,
    })
  })
})

describe('the 75% target', () => {
  it('asks for a puzzle a little below the user, and the maths agrees', () => {
    const target = ratingForSuccess(settled, 0.75)

    expect(target).toBeLessThan(settled.rating)
    expect(settled.rating - target).toBeGreaterThan(150)
    expect(settled.rating - target).toBeLessThan(230)
    expect(expectedSuccess(settled, target)).toBeCloseTo(0.75, 6)
  })

  it('round-trips every success rate the UI can ask for', () => {
    for (const probability of [0.5, 0.6, 0.75, 0.85, 0.9]) {
      expect(expectedSuccess(settled, ratingForSuccess(settled, probability))).toBeCloseTo(
        probability,
        6,
      )
    }
  })

  it('an even match is a coin flip, and a much stronger puzzle is not', () => {
    expect(expectedSuccess(settled, 1500)).toBeCloseTo(0.5, 6)
    expect(expectedSuccess(settled, 2100)).toBeLessThan(0.1)
    expect(expectedSuccess(settled, 900)).toBeGreaterThan(0.9)
  })
})

describe('storing a rating', () => {
  it('rounds and clamps to what the schema accepts', () => {
    expect(toStoredRating(1482.6)).toBe(1483)
    expect(toStoredRating(-40)).toBe(0)
    expect(toStoredRating(99_999)).toBe(MAX_STORED_RATING)
  })
})
