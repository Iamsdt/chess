import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import { makeSettings, toTimestamp, type Settings } from '@/domain'

import {
  assertNoKeyMaterial,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  exportBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  type BackupFile,
} from './backup'
import { createDb, type ChessKingDb } from './db'
import { VAULT_KV_PREFIX } from './kv-keys'
import { createRepositories } from './repositories'
import { seedDatabase } from './seed'

let counter = 0
const openDatabases: ChessKingDb[] = []

function open(): ChessKingDb {
  counter += 1
  const database = createDb(`backup-test-${String(counter)}`)
  openDatabases.push(database)
  return database
}

afterEach(() => {
  while (openDatabases.length > 0) openDatabases.pop()?.close()
})

/**
 * A deterministic generator, so the property test explores many shapes and still
 * fails the same way twice. `fast-check` is not a dependency of this project, so
 * the generator is the smallest one that does the job.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

async function unwrapExport(database: ChessKingDb): Promise<BackupFile> {
  const exported = await exportBackup(database)
  if (!exported.ok) throw new Error(exported.error.message)
  return exported.value.file
}

describe('backup export', () => {
  it('describes itself and counts what it carried', async () => {
    const database = open()
    await seedDatabase(database, { games: 3, puzzles: 5, attempts: 4 })

    const exported = await exportBackup(database)
    expect(exported.ok).toBe(true)
    if (!exported.ok) return

    expect(exported.value.file.format).toBe(BACKUP_FORMAT)
    expect(exported.value.file.formatVersion).toBe(BACKUP_FORMAT_VERSION)
    expect(exported.value.file.dbVersion).toBe(2)
    expect(exported.value.report.counts.games).toBe(3)
    expect(exported.value.report.counts.moves).toBe(12)
    expect(exported.value.report.hasSettings).toBe(true)
    expect(exported.value.report.hasProfile).toBe(true)
    expect(exported.value.report.skipped).toEqual([])
  })

  it('leaves out the puzzle catalogue and the job queue on purpose', async () => {
    const database = open()
    await seedDatabase(database, { puzzles: 9 })

    const file = await unwrapExport(database)
    expect(Object.keys(file.data)).not.toContain('puzzles')
    expect(Object.keys(file.data)).not.toContain('jobs')
    expect(await database.puzzles.count()).toBe(9)
  })

  it('skips a corrupt row and names it rather than failing the whole export', async () => {
    const database = open()
    await seedDatabase(database, { games: 2 })
    // A row an older build could have left behind: no `result` at all.
    const rows = await database.games.toArray()
    const [first] = rows
    if (first === undefined) throw new Error('seed produced no games')
    const { result: _dropped, ...broken } = first
    await database.games.put(broken as typeof first)

    const exported = await exportBackup(database)
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    expect(exported.value.report.skipped.length).toBe(1)
    expect(exported.value.report.skipped[0]).toMatch(/^games\[\d+\]$/)
    expect(exported.value.file.data.games.length).toBe(1)
  })
})

describe('backup round trip', () => {
  it('restores a seeded database into an empty one', async () => {
    const source = open()
    await seedDatabase(source)
    const file = await unwrapExport(source)

    const target = open()
    const restored = await restoreBackup(file, {}, target)
    expect(restored.ok).toBe(true)

    const repositories = createRepositories(target)
    expect(await repositories.games.count()).toBe(6)
    expect(await repositories.mistakes.count()).toBe(8)
    expect((await repositories.profile.get())?.displayName).toBe('Shudipto')
    expect((await repositories.settings.get()).dailyGoalMinutes).toBe(15)
    expect((await repositories.sessions.findActive())?.id).toBe('session-seed-1')
  })

  it('round-trips through its own JSON form', async () => {
    const source = open()
    await seedDatabase(source, { games: 2, mistakes: 2 })
    const file = await unwrapExport(source)

    const parsed = parseBackup(serializeBackup(file))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.data).toEqual(file.data)
  })

  it('rejects a file that is not a backup', () => {
    expect(parseBackup('{ not json').ok).toBe(false)
    expect(parseBackup({ format: 'something-else' }).ok).toBe(false)
    expect(parseBackup(null).ok).toBe(false)
  })

  it('replaces by default and merges when asked', async () => {
    const source = open()
    await seedDatabase(source, { games: 2 })
    const file = await unwrapExport(source)

    const target = open()
    await seedDatabase(target, { games: 5 })

    await restoreBackup(file, { mode: 'merge' }, target)
    expect(await createRepositories(target).games.count()).toBe(5)

    await restoreBackup(file, { mode: 'replace' }, target)
    expect(await createRepositories(target).games.count()).toBe(2)
  })

  /**
   * The property: exporting, restoring and exporting again must produce the same
   * data. Anything the layer drops, reorders or re-defaults on the way through
   * shows up here rather than as a missing game a month later.
   */
  it('is idempotent across randomly sized databases', async () => {
    const random = makeRandom(20_260_920)

    for (let round = 0; round < 12; round += 1) {
      const size = (max: number): number => 1 + Math.floor(random() * max)
      const source = open()
      await seedDatabase(source, {
        games: size(5),
        puzzles: size(8),
        attempts: size(9),
        srsCards: size(7),
        mistakes: size(6),
      })

      const first = await unwrapExport(source)
      const target = open()
      const restored = await restoreBackup(first, {}, target)
      expect(restored.ok).toBe(true)
      const second = await unwrapExport(target)

      expect(second.data).toEqual(first.data)
    }
  })
})

describe('backup and key material', () => {
  it('never carries a vault row, even though the vault lives in the same table', async () => {
    const database = open()
    await seedDatabase(database, { games: 1 })
    await database.kv.put({
      key: `${VAULT_KV_PREFIX}coach-key`,
      value: { ciphertext: 'ZmFrZS1zZWNyZXQ', iv: 'AAECAwQ' },
      updatedAt: toTimestamp(1),
    })

    const file = await unwrapExport(database)
    const json = serializeBackup(file)

    expect(file.data.kv.map((row) => row.key)).not.toContain(`${VAULT_KV_PREFIX}coach-key`)
    expect(json).not.toContain('ZmFrZS1zZWNyZXQ')
    expect(json).not.toContain(VAULT_KV_PREFIX)
  })

  it('strips a key smuggled onto the settings row', async () => {
    const database = open()
    await seedDatabase(database, { games: 1 })
    // Written under the repository, as a future build with a bug might.
    const smuggled: Settings & { apiKey: string } = {
      ...makeSettings(),
      apiKey: 'sk-live-must-not-leak',
    }
    await database.settings.put({ id: 'settings', value: smuggled })

    const file = await unwrapExport(database)
    const json = serializeBackup(file)

    expect(file.data.settings).not.toHaveProperty('apiKey')
    expect(json).not.toContain('sk-live-must-not-leak')
    expect(file.data.settings?.coach.hasKey).toBe(false)
  })

  it('refuses to hand over a file that still contains key material', () => {
    const clean = assertNoKeyMaterial({ data: { settings: { theme: 'dark' } } })
    expect(clean.ok).toBe(true)

    const dirty = assertNoKeyMaterial({ data: { settings: { apiKey: 'sk-live' } } })
    expect(dirty.ok).toBe(false)
    expect(!dirty.ok && dirty.error.details).toEqual(['$.data.settings.apiKey'])

    const nested = assertNoKeyMaterial({ rows: [{ vault: { ciphertext: 'x' } }] })
    expect(nested.ok).toBe(false)
  })

  it('refuses to restore a file that smuggles vault rows back in', async () => {
    const file = await unwrapExport(open())
    const tampered: BackupFile = {
      ...file,
      data: {
        ...file.data,
        kv: [
          {
            key: `${VAULT_KV_PREFIX}coach-key`,
            value: { ciphertext: 'x' },
            updatedAt: toTimestamp(1),
          },
        ],
      },
    }

    const restored = await restoreBackup(tampered, {}, open())
    expect(restored.ok).toBe(false)
    expect(!restored.ok && restored.error.code).toBe('validation')
  })

  it('leaves the local vault alone when a backup replaces everything else', async () => {
    const database = open()
    await seedDatabase(database, { games: 1 })
    await database.kv.put({
      key: `${VAULT_KV_PREFIX}coach-key`,
      value: { ciphertext: 'mine' },
      updatedAt: toTimestamp(1),
    })

    const other = open()
    await seedDatabase(other, { games: 2 })
    const file = await unwrapExport(other)

    await restoreBackup(file, { mode: 'replace' }, database)
    expect(await database.kv.get(`${VAULT_KV_PREFIX}coach-key`)).toBeDefined()
  })
})
