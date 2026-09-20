import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import { GameMetaSchema, makeGameMeta, toGameId } from '@/domain'

import { createDb, type ChessKingDb } from './db'
import { CURRENT_DB_VERSION, MIGRATIONS } from './migrations'

/**
 * The migration harness.
 *
 * `createDb(name, 1)` declares only version 1's stores, so the test can write
 * rows exactly as a v1 build would have — missing the fields that gained
 * defaults later, and with none of v2's indexes present. Closing and reopening
 * the same database name with no `upTo` makes Dexie run the real upgrade path,
 * not a simulation of it.
 */
let counter = 0
let open: ChessKingDb | undefined

afterEach(() => {
  open?.close()
  open = undefined
})

function nextName(): string {
  counter += 1
  return `migration-test-${String(counter)}`
}

/** A game row as v1 wrote it: no `mistakeCount`, no `tags`, no `reviewState`. */
function legacyGameRow(id: string): Record<string, unknown> {
  const modern = makeGameMeta({ id: toGameId(id) })
  const {
    mistakeCount: _count,
    tags: _tags,
    reviewState: _state,
    ...legacy
  } = modern as Record<string, unknown> & typeof modern
  return legacy
}

describe('schema versions', () => {
  it('declares versions in ascending order with no gaps', () => {
    const versions = MIGRATIONS.map((migration) => migration.version)
    expect(versions).toEqual(versions.map((_unused, index) => index + 1))
    expect(CURRENT_DB_VERSION).toBe(versions[versions.length - 1])
  })

  it('opens a fresh database straight at the current version', async () => {
    const database = createDb(nextName())
    open = database
    await database.open()
    expect(database.verno).toBe(CURRENT_DB_VERSION)
  })
})

describe('v1 to v2', () => {
  it('backfills the fields that gained defaults after v1 shipped', async () => {
    const name = nextName()

    const v1 = createDb(name, 1)
    await v1.open()
    expect(v1.verno).toBe(1)
    await v1.table('games').put(legacyGameRow('legacy-1'))
    await v1.table('games').put(legacyGameRow('legacy-2'))
    v1.close()

    const v2 = createDb(name)
    open = v2
    await v2.open()
    expect(v2.verno).toBe(2)

    const upgraded = await v2.games.get(toGameId('legacy-1'))
    expect(upgraded?.mistakeCount).toBe(0)
    expect(upgraded?.tags).toEqual([])
    expect(upgraded?.reviewState).toBe('not-reviewed')

    // The point of the backfill: the row now satisfies the current contract.
    expect(GameMetaSchema.safeParse(upgraded).success).toBe(true)
    expect(await v2.games.count()).toBe(2)
  })

  it('leaves a row that already has the fields untouched', async () => {
    const name = nextName()

    const v1 = createDb(name, 1)
    await v1.open()
    await v1
      .table('games')
      .put(makeGameMeta({ id: toGameId('complete'), mistakeCount: 3, tags: ['sharp'] }))
    v1.close()

    const v2 = createDb(name)
    open = v2
    const upgraded = await v2.games.get(toGameId('complete'))
    expect(upgraded?.mistakeCount).toBe(3)
    expect(upgraded?.tags).toEqual(['sharp'])
  })

  it('adds the v2 indexes, so a query that v1 could not answer now works', async () => {
    const name = nextName()

    const v1 = createDb(name, 1)
    await v1.open()
    await expect(
      v1.table('games').where('[source+externalId]').equals(['lichess', 'x']).first(),
    ).rejects.toThrow()
    await v1
      .table('games')
      .put(makeGameMeta({ id: toGameId('g1'), source: 'lichess', externalId: 'x' }))
    v1.close()

    const v2 = createDb(name)
    open = v2
    const found = await v2.games.where('[source+externalId]').equals(['lichess', 'x']).first()
    expect(found?.id).toBe('g1')
  })

  it('keeps the data of every other table across the upgrade', async () => {
    const name = nextName()

    const v1 = createDb(name, 1)
    await v1.open()
    await v1.table('kv').put({ key: 'kept', value: { n: 1 }, updatedAt: 1 })
    v1.close()

    const v2 = createDb(name)
    open = v2
    expect(await v2.kv.get('kept')).toEqual({ key: 'kept', value: { n: 1 }, updatedAt: 1 })
  })
})
