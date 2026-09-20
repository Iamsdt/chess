import { describe, expect, it } from 'vitest'

import { makePuzzle, toLocalDate, toPuzzleId, type Puzzle, type PuzzleBand } from '@/domain'

import { expectedSuccess } from './rating'
import { seededRng } from './rng'
import {
  candidateWeight,
  curriculumRung,
  dailyPuzzleIndex,
  dailySeed,
  expectedSetSuccess,
  pickSession,
  ratingWindow,
  RUNGS_PER_BAND,
  selectionLadder,
  SESSION_SIZE,
  SOLVES_PER_RUNG,
  TARGET_SUCCESS,
  themeWeights,
  WINDOW_SLICES,
} from './selection'

import type { GlickoRating } from './glicko2'
import type { ThemeMastery } from './mastery'

const player: GlickoRating = { rating: 1500, deviation: 60, volatility: 0.06 }

const THEMES = ['fork', 'pin', 'skewer', 'mateIn2'] as const

/** A stand-in catalogue with the real dataset's rating spread and four themes. */
function catalogue(size = 400): Puzzle[] {
  return Array.from({ length: size }, (_unused, index) =>
    makePuzzle({
      id: toPuzzleId(`p${String(index)}`),
      rating: 800 + ((index * 37) % 1400),
      theme: THEMES[index % THEMES.length] ?? 'fork',
      band: 'rook',
      subLevel: (index % RUNGS_PER_BAND) + 1,
    }),
  )
}

const mastery = (theme: string, value: number): ThemeMastery => ({
  theme,
  attempted: 20,
  solved: Math.round(20 * value),
  mastery: value,
  tone: value < 0.5 ? 'needs-love' : value >= 0.75 ? 'strong' : 'steady',
  delta: null,
  lastAttemptedAt: null,
})

describe('the band curriculum', () => {
  it('starts a new player on the first rung of the pawn band', () => {
    expect(curriculumRung({})).toMatchObject({ band: 'pawn', subLevel: 1, complete: false })
  })

  it('climbs a rung every few solves and never goes backwards on a miss', () => {
    expect(curriculumRung({ pawn: SOLVES_PER_RUNG - 1 }).subLevel).toBe(1)
    expect(curriculumRung({ pawn: SOLVES_PER_RUNG }).subLevel).toBe(2)
    expect(curriculumRung({ pawn: SOLVES_PER_RUNG * 3 + 2 }).subLevel).toBe(4)
  })

  it('moves to the next band once the last rung is done', () => {
    const full = SOLVES_PER_RUNG * RUNGS_PER_BAND
    expect(curriculumRung({ pawn: full })).toMatchObject({ band: 'knight', subLevel: 1 })
    expect(curriculumRung({ pawn: full, knight: full })).toMatchObject({ band: 'bishop' })
  })

  it('reports the curriculum finished once every band is worked through', () => {
    const full = SOLVES_PER_RUNG * RUNGS_PER_BAND
    const bands: Partial<Record<PuzzleBand, number>> = {
      pawn: full,
      knight: full,
      bishop: full,
      rook: full,
      queen: full,
      king: full,
    }
    expect(curriculumRung(bands)).toMatchObject({ band: 'king', complete: true })
  })
})

describe('the rating window', () => {
  it('centres on the rating this user solves three times in four', () => {
    const window = ratingWindow(player)

    expect(expectedSuccess(player, window.target)).toBeCloseTo(TARGET_SUCCESS, 6)
    expect(window.min).toBeLessThan(window.target)
    expect(window.max).toBeGreaterThan(window.target)
  })
})

describe('the query ladder', () => {
  const rung = curriculumRung({ rook: 20 })

  it('asks for the featured theme first when the hub named one', () => {
    const ladder = selectionLadder({ player, rung, theme: 'fork' })

    expect(ladder[0]?.queries.every((query) => query.theme === 'fork')).toBe(true)
    expect(ladder[1]?.queries[0]).toMatchObject({ band: rung.band, subLevel: rung.subLevel })
  })

  it('widens band, then rung, then rating, and ends with no window at all', () => {
    const ladder = selectionLadder({ player, rung })

    expect(ladder[0]?.queries[0]).toMatchObject({ band: rung.band, subLevel: rung.subLevel })
    expect(ladder[1]?.queries[0]).toMatchObject({ band: rung.band })
    expect(ladder[1]?.queries[0]?.subLevel).toBeUndefined()
    const last = ladder[ladder.length - 1]?.queries[0]
    expect(last?.minRating).toBeUndefined()
    expect(last?.maxRating).toBeUndefined()
  })

  it('slices each rating window so the pool is not just its easy end', () => {
    const ladder = selectionLadder({ player, rung })
    const window = ratingWindow(player)
    const slices = ladder[0]?.queries ?? []

    expect(slices).toHaveLength(WINDOW_SLICES)
    expect(slices[0]?.minRating).toBe(window.min)
    expect(slices[slices.length - 1]?.maxRating).toBe(window.max)
    for (let index = 1; index < slices.length; index += 1) {
      expect(slices[index]?.minRating).toBe(slices[index - 1]?.maxRating)
    }
  })

  it('carries the exclusions through every query of every rung', () => {
    const excludeIds = [toPuzzleId('p1')]
    for (const rungStep of selectionLadder({ player, rung, excludeIds })) {
      for (const query of rungStep.queries) {
        expect(query.excludeIds).toEqual(excludeIds)
      }
    }
  })

  it('drops the band filter once the curriculum is finished', () => {
    const complete = curriculumRung({
      pawn: 999,
      knight: 999,
      bishop: 999,
      rook: 999,
      queen: 999,
      king: 999,
    })
    const ladder = selectionLadder({ player, rung: complete })

    expect(ladder.every((step) => step.queries.every((query) => query.band === undefined))).toBe(
      true,
    )
  })

  it('labels every rung, so the hub can say why a puzzle was offered', () => {
    for (const step of selectionLadder({ player, rung, theme: 'fork' })) {
      expect(step.label.length).toBeGreaterThan(0)
    }
  })
})

describe('picking a set', () => {
  const pool = catalogue()

  it('lands on about a 75% expected solve rate across many seeds', () => {
    const rates: number[] = []
    for (let seed = 1; seed <= 60; seed += 1) {
      const set = pickSession(pool, { player, rng: seededRng(seed), count: SESSION_SIZE })
      expect(set).toHaveLength(SESSION_SIZE)
      const rate = expectedSetSuccess(player, set)
      expect(rate).not.toBeNull()
      rates.push(rate ?? 0)
    }
    const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length

    // The band is deliberately wide: the draw is weighted, not deterministic, and a
    // selector that hit 0.75 exactly every time would be serving one rating of puzzle.
    expect(mean).toBeGreaterThan(0.68)
    expect(mean).toBeLessThan(0.82)
    expect(Math.min(...rates)).toBeGreaterThan(0.55)
    expect(Math.max(...rates)).toBeLessThan(0.92)
  })

  it('warms up: a set is ordered easiest first', () => {
    const set = pickSession(pool, { player, rng: seededRng(7), count: SESSION_SIZE })
    const ratings = set.map((puzzle) => puzzle.rating)

    expect([...ratings].sort((left, right) => left - right)).toEqual(ratings)
  })

  it('never offers the same puzzle twice, or an inactive one', () => {
    const withInactive = [
      ...pool,
      makePuzzle({ id: toPuzzleId('dead'), rating: 1300, active: false }),
      ...pool.slice(0, 20),
    ]
    const set = pickSession(withInactive, { player, rng: seededRng(11), count: SESSION_SIZE })

    expect(new Set(set.map((puzzle) => puzzle.id)).size).toBe(set.length)
    expect(set.some((puzzle) => puzzle.id === 'dead')).toBe(false)
  })

  it('leans toward the themes the user is weakest at', () => {
    const weights = themeWeights([mastery('fork', 0.3), mastery('pin', 0.9)])
    const counts = { fork: 0, pin: 0 }
    for (let seed = 1; seed <= 120; seed += 1) {
      for (const puzzle of pickSession(pool, {
        player,
        rng: seededRng(seed),
        count: SESSION_SIZE,
        weights,
      })) {
        if (puzzle.theme === 'fork') counts.fork += 1
        if (puzzle.theme === 'pin') counts.pin += 1
      }
    }

    expect(counts.fork).toBeGreaterThan(counts.pin * 1.5)
  })

  it('weights a well-fitting puzzle above a wildly mismatched one', () => {
    const fit = makePuzzle({
      id: toPuzzleId('fit'),
      rating: Math.round(ratingWindow(player).target),
    })
    const tooHard = makePuzzle({ id: toPuzzleId('hard'), rating: 2200 })

    expect(candidateWeight(fit, { player, rng: seededRng(1) })).toBeGreaterThan(
      candidateWeight(tooHard, { player, rng: seededRng(1) }),
    )
  })

  it('returns what it can when the pool is smaller than the set', () => {
    const tiny = pool.slice(0, 3)
    expect(pickSession(tiny, { player, rng: seededRng(3), count: SESSION_SIZE })).toHaveLength(3)
  })
})

describe('the daily puzzle', () => {
  it('is the same puzzle for a date however often it is asked', () => {
    const day = toLocalDate('2026-09-20')
    expect(dailyPuzzleIndex(day, 10_000)).toBe(dailyPuzzleIndex(day, 10_000))
    expect(dailySeed(day)).toBe(dailySeed(day))
  })

  it('stays inside the catalogue and moves around it over a year', () => {
    const seen = new Set<number>()
    for (let day = 1; day <= 28; day += 1) {
      const date = toLocalDate(`2026-09-${String(day).padStart(2, '0')}`)
      const index = dailyPuzzleIndex(date, 10_000)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(10_000)
      seen.add(index)
    }

    expect(seen.size).toBe(28)
  })

  it('is index 0 when there is nothing to index into', () => {
    expect(dailyPuzzleIndex(toLocalDate('2026-09-20'), 0)).toBe(0)
  })
})
