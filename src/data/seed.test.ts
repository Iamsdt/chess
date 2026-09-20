import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import { toGameId } from '@/domain'

import { createDb, type ChessKingDb } from './db'
import { createRepositories } from './repositories'
import { seedDatabase } from './seed'

let counter = 0
let db: ChessKingDb | undefined

afterEach(() => {
  db?.close()
  db = undefined
})

function open(): ChessKingDb {
  counter += 1
  db = createDb(`seed-test-${String(counter)}`)
  return db
}

describe('dev seed', () => {
  it('fills every table the app reads on boot', async () => {
    const database = open()
    const summary = await seedDatabase(database)
    expect(summary.ok).toBe(true)
    if (!summary.ok) return

    const repositories = createRepositories(database)
    expect(summary.value.games).toBe(6)
    expect(await repositories.games.count()).toBe(6)
    expect(await repositories.moves.countForGame(toGameId('game-seed-0'))).toBe(4)
    expect(await repositories.puzzles.count({ includeInactive: true })).toBe(24)
    expect(await repositories.attempts.count()).toBe(18)
    expect(await repositories.mistakes.count()).toBe(8)
    expect(await repositories.packs.count()).toBe(1)
    expect((await repositories.lessonsProgress.list()).length).toBe(1)
    expect(await repositories.repertoire.count()).toBe(2)
    expect((await repositories.jobs.listActive()).length).toBe(1)
    expect(await repositories.profile.get()).toBeDefined()
  })

  it('is stable: seeding twice leaves the same rows, not twice as many', async () => {
    const database = open()
    await seedDatabase(database)
    const repositories = createRepositories(database)
    const before = await repositories.games.count()

    await seedDatabase(database)
    expect(await repositories.games.count()).toBe(before)
    expect(await repositories.attempts.count()).toBe(18)
  })

  it('honours the requested sizes', async () => {
    const database = open()
    const summary = await seedDatabase(database, { games: 2, puzzles: 3, mistakes: 1 })
    expect(summary.ok && summary.value.games).toBe(2)

    const repositories = createRepositories(database)
    expect(await repositories.puzzles.count({ includeInactive: true })).toBe(3)
    expect(await repositories.mistakes.count()).toBe(1)
  })

  it('produces data that validates, which is what the backup test relies on', async () => {
    const database = open()
    await seedDatabase(database)
    const repositories = createRepositories(database)

    // Every row went in through a repository, so a re-save of one must succeed.
    const [first] = await repositories.games.list({}, { limit: 1 })
    if (first === undefined) throw new Error('seed produced no games')
    expect((await repositories.games.saveMeta(first)).ok).toBe(true)
  })
})
