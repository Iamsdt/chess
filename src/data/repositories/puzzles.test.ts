import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import {
  FIXTURE_NOW,
  makePuzzle,
  makePuzzleAttempt,
  toAttemptId,
  toPuzzleId,
  toTimestamp,
  type Puzzle,
} from '@/domain'

import { createDb, type ChessKingDb } from '../db'

import { createAttemptsRepository } from './attempts'
import { createPuzzlesRepository } from './puzzles'

let counter = 0
let db: ChessKingDb | undefined

afterEach(() => {
  db?.close()
  db = undefined
})

function setup(): {
  puzzles: ReturnType<typeof createPuzzlesRepository>
  attempts: ReturnType<typeof createAttemptsRepository>
} {
  counter += 1
  db = createDb(`puzzles-test-${String(counter)}`)
  return { puzzles: createPuzzlesRepository(db), attempts: createAttemptsRepository(db) }
}

/** A small stand-in for the shipped bands: two bands, two rungs, a rating spread. */
const CATALOGUE: Puzzle[] = [
  makePuzzle({ id: toPuzzleId('p1'), band: 'pawn', subLevel: 1, rating: 900, theme: 'fork' }),
  makePuzzle({ id: toPuzzleId('p2'), band: 'pawn', subLevel: 1, rating: 1200, theme: 'pin' }),
  makePuzzle({ id: toPuzzleId('p3'), band: 'pawn', subLevel: 2, rating: 1500, theme: 'fork' }),
  makePuzzle({
    id: toPuzzleId('p4'),
    band: 'rook',
    subLevel: 3,
    rating: 1800,
    theme: 'mateIn2',
    difficulty: 'advanced',
  }),
  makePuzzle({ id: toPuzzleId('p5'), band: 'rook', subLevel: 3, rating: 2100, active: false }),
]

describe('puzzles repository', () => {
  it('selects by band, by rung and by rating window', async () => {
    const { puzzles } = setup()
    await puzzles.bulkUpsert(CATALOGUE)

    expect((await puzzles.select({ band: 'pawn' })).map((row) => row.id)).toEqual([
      'p1',
      'p2',
      'p3',
    ])
    expect((await puzzles.select({ band: 'pawn', subLevel: 1 })).map((row) => row.id)).toEqual([
      'p1',
      'p2',
    ])
    const window = await puzzles.select({ band: 'pawn', minRating: 1000, maxRating: 1400 })
    expect(window.map((row) => row.id)).toEqual(['p2'])
  })

  it('selects by theme and by difficulty inside a rating window', async () => {
    const { puzzles } = setup()
    await puzzles.bulkUpsert(CATALOGUE)

    expect((await puzzles.select({ theme: 'fork' })).map((row) => row.id)).toEqual(['p1', 'p3'])
    expect((await puzzles.select({ difficulty: 'advanced' })).map((row) => row.id)).toEqual(['p4'])
    expect((await puzzles.select({ theme: 'fork', minRating: 1000 })).map((row) => row.id)).toEqual(
      ['p3'],
    )
  })

  it('never offers an inactive puzzle unless it is asked to', async () => {
    const { puzzles } = setup()
    await puzzles.bulkUpsert(CATALOGUE)

    expect((await puzzles.select({ band: 'rook' })).map((row) => row.id)).toEqual(['p4'])
    expect(
      (await puzzles.select({ band: 'rook', includeInactive: true })).map((row) => row.id),
    ).toEqual(['p4', 'p5'])
  })

  it('excludes ids the session has already used', async () => {
    const { puzzles } = setup()
    await puzzles.bulkUpsert(CATALOGUE)
    const remaining = await puzzles.select({ band: 'pawn', excludeIds: [toPuzzleId('p2')] })
    expect(remaining.map((row) => row.id)).toEqual(['p1', 'p3'])
  })

  it('is idempotent: re-importing updates and never duplicates', async () => {
    const { puzzles } = setup()
    const first = await puzzles.bulkUpsert(CATALOGUE)
    expect(first.ok && first.value).toEqual({ inserted: 5, updated: 0 })

    const changed = CATALOGUE.map((puzzle) =>
      puzzle.id === 'p1' ? { ...puzzle, rating: 950 } : puzzle,
    )
    const second = await puzzles.bulkUpsert(changed)
    expect(second.ok && second.value).toEqual({ inserted: 0, updated: 5 })

    expect(await puzzles.count({ includeInactive: true })).toBe(5)
    expect((await puzzles.get(toPuzzleId('p1')))?.rating).toBe(950)
  })

  it('refuses a bad row and writes nothing', async () => {
    const { puzzles } = setup()
    const broken = [...CATALOGUE, { ...CATALOGUE[0], id: 'p9', band: 'elephant' }]

    const result = await puzzles.bulkUpsert(broken)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.code).toBe('validation')
    expect(!result.ok && result.error.details?.[0]).toContain('band')
    expect(await puzzles.count({ includeInactive: true })).toBe(0)
  })

  it('reports the stats the hub and the importer show', async () => {
    const { puzzles } = setup()
    await puzzles.bulkUpsert(CATALOGUE)

    const stats = await puzzles.stats()
    expect(stats.total).toBe(5)
    expect(stats.byBand.pawn).toBe(3)
    expect(stats.byBand.rook).toBe(2)
    expect(stats.byBand.queen).toBe(0)
    expect(stats.ratingRange).toEqual({ min: 900, max: 2100 })

    const themes = await puzzles.listThemes()
    // p5 keeps the fixture's default theme, so three of the five are forks.
    expect(themes[0]).toEqual({ theme: 'fork', count: 3 })
  })

  it('reports an empty rating range rather than an infinite one', async () => {
    const { puzzles } = setup()
    const stats = await puzzles.stats()
    expect(stats.total).toBe(0)
    expect(stats.ratingRange).toBeNull()
  })

  it('indexes into a stable order, which is what the daily puzzle needs', async () => {
    const { puzzles } = setup()
    await puzzles.bulkUpsert(CATALOGUE)
    const third = await puzzles.getByIndex(2)
    expect(third?.id).toBe('p3')
    expect(await puzzles.getByIndex(99)).toBeUndefined()
  })
})

describe('attempts repository', () => {
  const attemptAt = (id: string, puzzleId: string, minutesAgo: number, rated = true) =>
    makePuzzleAttempt({
      id: toAttemptId(id),
      puzzleId: toPuzzleId(puzzleId),
      startedAt: toTimestamp(FIXTURE_NOW - minutesAgo * 60_000),
      endedAt: toTimestamp(FIXTURE_NOW - minutesAgo * 60_000 + 10_000),
      rated,
    })

  it('records attempts and lists them per puzzle and by recency', async () => {
    const { attempts } = setup()
    await attempts.add(attemptAt('a1', 'p1', 30))
    await attempts.add(attemptAt('a2', 'p1', 10))
    await attempts.add(attemptAt('a3', 'p2', 5))

    expect((await attempts.listForPuzzle(toPuzzleId('p1'))).map((row) => row.id)).toEqual([
      'a1',
      'a2',
    ])
    expect((await attempts.listRecent(2)).map((row) => row.id)).toEqual(['a3', 'a2'])
    expect(await attempts.count()).toBe(3)
  })

  it('finds the puzzles seen since a cutoff, which S14 must not offer again', async () => {
    const { attempts } = setup()
    await attempts.addMany([attemptAt('a1', 'p1', 600), attemptAt('a2', 'p2', 5)])
    const recent = await attempts.recentPuzzleIds(toTimestamp(FIXTURE_NOW - 60 * 60_000))
    expect(recent).toEqual(['p2'])
  })

  it('finds the last rated attempt, skipping the hinted ones', async () => {
    const { attempts } = setup()
    await attempts.addMany([attemptAt('a1', 'p1', 30, true), attemptAt('a2', 'p2', 5, false)])
    expect((await attempts.lastRated())?.id).toBe('a1')
  })

  it('windows by date and by mode for the rating chart', async () => {
    const { attempts } = setup()
    await attempts.addMany([
      attemptAt('a1', 'p1', 600),
      { ...attemptAt('a2', 'p2', 5), mode: 'puzzle-rush' as const },
    ])

    const recent = await attempts.listByDate({ from: toTimestamp(FIXTURE_NOW - 60 * 60_000) })
    expect(recent.map((row) => row.id)).toEqual(['a2'])
    expect((await attempts.listByMode('puzzle-rush')).map((row) => row.id)).toEqual(['a2'])
    expect((await attempts.listByMode('adaptive-puzzles')).map((row) => row.id)).toEqual(['a1'])
  })

  it('refuses an attempt that does not validate', async () => {
    const { attempts } = setup()
    const invalid = { ...attemptAt('a1', 'p1', 0), hintCount: 9 }
    const result = await attempts.add(invalid)
    expect(result.ok).toBe(false)
    expect(await attempts.count()).toBe(0)
  })
})
