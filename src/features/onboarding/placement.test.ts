import { describe, expect, it } from 'vitest'

import { makePuzzle, type Puzzle } from '@/domain'

import { PLACEMENT_COUNT, pickPlacementPuzzle, placementRating, placementSeed } from './placement'

function withRating(base: Puzzle, id: string, rating: number): Puzzle {
  return { ...base, id: id as Puzzle['id'], rating }
}

describe('placementRating', () => {
  const seed = placementSeed('club')

  it('starts from the level with the widest deviation', () => {
    expect(seed.rating).toBe(1200)
    expect(seed.deviation).toBe(350)
  })

  it('raises the rating when every puzzle is solved', () => {
    const outcomes = Array.from({ length: PLACEMENT_COUNT }, () => ({
      puzzleRating: 1200,
      solved: true,
    }))
    const result = placementRating(seed, outcomes)
    expect(result.rating).toBeGreaterThan(1400)
    expect(result.deviation).toBeLessThan(seed.deviation)
  })

  it('lowers the rating when every puzzle is missed', () => {
    const outcomes = Array.from({ length: PLACEMENT_COUNT }, () => ({
      puzzleRating: 1200,
      solved: false,
    }))
    expect(placementRating(seed, outcomes).rating).toBeLessThan(1000)
  })

  it('lets a strong result overrule a modest self-described level', () => {
    const outcomes = [1000, 1400, 1700, 1900, 2000].map((puzzleRating) => ({
      puzzleRating,
      solved: true,
    }))
    expect(placementRating(placementSeed('beginner'), outcomes).rating).toBeGreaterThan(1700)
  })

  it('leaves the seed alone with no outcomes', () => {
    expect(placementRating(seed, []).rating).toBe(1200)
  })

  it('is order-sensitive but stays within the stored rating range', () => {
    const outcomes = Array.from({ length: 40 }, () => ({ puzzleRating: 3000, solved: true }))
    const result = placementRating(seed, outcomes)
    expect(result.rating).toBeLessThanOrEqual(4000)
    expect(result.rating).toBeGreaterThanOrEqual(0)
  })
})

describe('pickPlacementPuzzle', () => {
  const base = makePuzzle()
  const pool = [
    withRating(base, 'a', 900),
    withRating(base, 'b', 1180),
    withRating(base, 'c', 1250),
  ]

  it('takes the puzzle closest to the target', () => {
    expect(pickPlacementPuzzle(pool, 1200, new Set())?.id).toBe('b')
  })

  it('skips puzzles already asked', () => {
    expect(pickPlacementPuzzle(pool, 1200, new Set(['b']))?.id).toBe('c')
  })

  it('returns undefined when nothing is left', () => {
    expect(pickPlacementPuzzle(pool, 1200, new Set(['a', 'b', 'c']))).toBeUndefined()
    expect(pickPlacementPuzzle([], 1200, new Set())).toBeUndefined()
  })
})
