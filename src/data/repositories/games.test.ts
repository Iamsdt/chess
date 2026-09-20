import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import {
  FIXTURE_NOW,
  makeGame,
  makeGameMeta,
  makeMoveRecord,
  toGameId,
  toTimestamp,
  type Game,
} from '@/domain'

import { createDb, type ChessKingDb } from '../db'

import { createGamesRepository } from './games'
import { createMovesRepository } from './moves'

/**
 * Each test gets its own database so nothing leaks between them, and so a
 * failure names one table rather than a shared fixture.
 */
let counter = 0
const open = (): ChessKingDb => {
  counter += 1
  return createDb(`games-test-${String(counter)}`)
}

let db: ChessKingDb | undefined

afterEach(() => {
  db?.close()
  db = undefined
})

function setup(): {
  games: ReturnType<typeof createGamesRepository>
  moves: ReturnType<typeof createMovesRepository>
} {
  db = open()
  return { games: createGamesRepository(db), moves: createMovesRepository(db) }
}

const gameAt = (id: string, minutesAgo: number, overrides: Partial<Game['meta']> = {}): Game =>
  makeGame({
    meta: makeGameMeta({
      id: toGameId(id),
      startedAt: toTimestamp(FIXTURE_NOW - minutesAgo * 60_000),
      ...overrides,
    }),
    moves: [
      makeMoveRecord({ gameId: toGameId(id), ply: 0, quality: 'best' }),
      makeMoveRecord({ gameId: toGameId(id), ply: 1, quality: 'blunder' }),
      makeMoveRecord({ gameId: toGameId(id), ply: 2, quality: 'good' }),
    ],
  })

describe('games repository', () => {
  it('saves a game and reads it back with its moves in ply order', async () => {
    const { games } = setup()
    const saved = await games.save(gameAt('g1', 0))
    expect(saved.ok).toBe(true)

    const loaded = await games.getWithMoves(toGameId('g1'))
    expect(loaded?.meta.id).toBe('g1')
    expect(loaded?.moves.map((move) => move.ply)).toEqual([0, 1, 2])
    expect(loaded?.pgn).toContain('[Event')
  })

  it('keeps the move list out of the header read', async () => {
    const { games } = setup()
    await games.save(gameAt('g1', 0))
    const header = await games.get(toGameId('g1'))
    expect(header).toBeDefined()
    expect(header).not.toHaveProperty('moves')
  })

  it('lists newest first and pages', async () => {
    const { games } = setup()
    await games.save(gameAt('old', 120))
    await games.save(gameAt('mid', 60))
    await games.save(gameAt('new', 0))

    expect((await games.list()).map((row) => row.id)).toEqual(['new', 'mid', 'old'])
    expect((await games.list({}, { limit: 2 })).map((row) => row.id)).toEqual(['new', 'mid'])
    expect((await games.list({}, { offset: 1, limit: 1 })).map((row) => row.id)).toEqual(['mid'])
  })

  it('filters on every library facet', async () => {
    const { games } = setup()
    await games.save(gameAt('a', 10, { source: 'lichess', result: '1-0', reviewState: 'reviewed' }))
    await games.save(
      gameAt('b', 5, { source: 'sparring', result: '0-1', reviewState: 'not-reviewed' }),
    )
    await games.save(
      gameAt('c', 1, {
        source: 'sparring',
        result: '1-0',
        reviewState: 'not-reviewed',
        tags: ['x'],
      }),
    )

    expect((await games.list({ source: 'sparring' })).map((row) => row.id)).toEqual(['c', 'b'])
    expect((await games.list({ result: '1-0' })).map((row) => row.id)).toEqual(['c', 'a'])
    expect((await games.list({ reviewState: 'reviewed' })).map((row) => row.id)).toEqual(['a'])
    expect((await games.list({ tag: 'x' })).map((row) => row.id)).toEqual(['c'])
    expect((await games.list({ eco: 'C54' })).length).toBe(3)
    expect(await games.count({ source: 'sparring' })).toBe(2)
  })

  it('filters on a time window and on your own accuracy', async () => {
    const { games } = setup()
    await games.save(gameAt('a', 10, { accuracy: { white: 90, black: 50 } }))
    await games.save(gameAt('b', 5, { accuracy: { white: 40, black: 95 } }))

    const accurate = await games.list({ minAccuracy: 80 })
    expect(accurate.map((row) => row.id)).toEqual(['a'])

    const window = await games.list({ from: toTimestamp(FIXTURE_NOW - 7 * 60_000) })
    expect(window.map((row) => row.id)).toEqual(['b'])
  })

  it('updates a header and refuses an id that is not there', async () => {
    const { games } = setup()
    await games.save(gameAt('g1', 0))

    const updated = await games.setReviewState(toGameId('g1'), 'queued')
    expect(updated.ok && updated.value.reviewState).toBe('queued')

    const missing = await games.update(toGameId('nope'), { reviewState: 'queued' })
    expect(missing.ok).toBe(false)
    expect(!missing.ok && missing.error.code).toBe('not-found')
  })

  it('rejects a write that does not match the schema', async () => {
    const { games } = setup()
    const broken = { ...gameAt('g1', 0) }
    const invalid = { ...broken, meta: { ...broken.meta, result: 'draw?' } } as unknown as Game

    const saved = await games.save(invalid)
    expect(saved.ok).toBe(false)
    expect(!saved.ok && saved.error.code).toBe('validation')
    expect(await games.count()).toBe(0)
  })

  it('imports idempotently on (source, externalId)', async () => {
    const { games } = setup()
    const imported = gameAt('remote-1', 0, { source: 'lichess', externalId: 'abc123' })

    const first = await games.importGame(imported)
    expect(first.ok && first.value.duplicate).toBe(false)

    const again = await games.importGame(
      gameAt('remote-1-again', 0, { source: 'lichess', externalId: 'abc123' }),
    )
    expect(again.ok && again.value.duplicate).toBe(true)
    expect(await games.count()).toBe(1)

    const found = await games.findByExternalId('lichess', 'abc123')
    expect(found?.id).toBe('remote-1')
  })

  it('treats the same external id from another provider as a different game', async () => {
    const { games } = setup()
    await games.importGame(gameAt('l1', 0, { source: 'lichess', externalId: 'shared' }))
    await games.importGame(gameAt('c1', 0, { source: 'chesscom', externalId: 'shared' }))
    expect(await games.count()).toBe(2)
  })

  it('deletes a game together with its moves', async () => {
    const { games, moves } = setup()
    await games.save(gameAt('g1', 0))
    await games.remove(toGameId('g1'))

    expect(await games.get(toGameId('g1'))).toBeUndefined()
    expect(await moves.countForGame(toGameId('g1'))).toBe(0)
  })

  it('replaces the move list rather than appending on a re-save', async () => {
    const { games, moves } = setup()
    await games.save(gameAt('g1', 0))
    await games.save({
      ...gameAt('g1', 0),
      moves: [makeMoveRecord({ gameId: toGameId('g1'), ply: 0 })],
    })
    expect(await moves.countForGame(toGameId('g1'))).toBe(1)
  })
})

describe('moves repository', () => {
  it('reads one ply and writes one ply, as a resumable review does', async () => {
    const { games, moves } = setup()
    await games.save(gameAt('g1', 0))

    const before = await moves.get(toGameId('g1'), 1)
    expect(before?.quality).toBe('blunder')

    const written = await moves.put(
      makeMoveRecord({ gameId: toGameId('g1'), ply: 1, quality: 'mistake' }),
    )
    expect(written.ok).toBe(true)
    expect((await moves.get(toGameId('g1'), 1))?.quality).toBe('mistake')
    expect(await moves.countForGame(toGameId('g1'))).toBe(3)
  })

  it('selects only the plies with a given quality', async () => {
    const { games, moves } = setup()
    await games.save(gameAt('g1', 0))
    const bad = await moves.listByQuality(toGameId('g1'), ['blunder', 'mistake'])
    expect(bad.map((move) => move.ply)).toEqual([1])
    expect(await moves.listByQuality(toGameId('g1'), [])).toEqual([])
  })

  it('keeps one game of moves apart from another', async () => {
    const { games, moves } = setup()
    await games.save(gameAt('g1', 0))
    await games.save(gameAt('g2', 0))
    expect(await moves.countForGame(toGameId('g1'))).toBe(3)
    await moves.removeForGame(toGameId('g1'))
    expect(await moves.countForGame(toGameId('g1'))).toBe(0)
    expect(await moves.countForGame(toGameId('g2'))).toBe(3)
  })
})
