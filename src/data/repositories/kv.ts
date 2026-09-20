import { domainError, err, now, ok, type Result } from '@/domain'

import { runWrite } from '../internal'
import { isBackupSafeKvKey, type KvKey } from '../kv-keys'

import type { ChessKingDb } from '../db'
import type { KvRow } from '../schema'

/**
 * Small singletons that do not deserve a table: the streak, a "last seen"
 * marker, the encrypted coach vault.
 *
 * Every read goes through the key's own schema, because a value that has been
 * round-tripped through IndexedDB and possibly written by an older build is
 * exactly the untrusted data `parseValid` exists for.
 */
export interface KvRepository {
  /** `undefined` when the key is unset *or* when the stored value no longer validates. */
  get: <T>(key: KvKey<T>) => Promise<T | undefined>
  getOr: <T>(key: KvKey<T>, fallback: T) => Promise<T>
  set: <T>(key: KvKey<T>, value: T) => Promise<Result<T>>
  /** Read-modify-write for counters and accumulating state. */
  update: <T>(key: KvKey<T>, change: (current: T | undefined) => T) => Promise<Result<T>>
  remove: <T>(key: KvKey<T>) => Promise<Result<void>>
  has: <T>(key: KvKey<T>) => Promise<boolean>
  /**
   * Raw rows, for the backup only — and only the ones outside the reserved
   * `vault:`/`secret:` namespaces.
   */
  listBackupSafe: () => Promise<KvRow[]>
  /** Restores raw rows. Reserved namespaces are refused, not silently dropped. */
  putRaw: (rows: readonly KvRow[]) => Promise<Result<number>>
  clear: () => Promise<Result<void>>
}

export function createKvRepository(db: ChessKingDb): KvRepository {
  async function read<T>(key: KvKey<T>): Promise<T | undefined> {
    const row = await db.kv.get(key.name)
    if (row === undefined) return undefined
    const parsed = key.parse(row.value, `kv.get(${key.name})`)
    return parsed.ok ? parsed.value : undefined
  }

  async function write<T>(key: KvKey<T>, value: T): Promise<Result<T>> {
    const parsed = key.parse(value, `kv.set(${key.name})`)
    if (!parsed.ok) return parsed
    const written = await runWrite(`kv.set(${key.name})`, () =>
      db.kv.put({ key: key.name, value: parsed.value, updatedAt: now() }),
    )
    return written.ok ? ok(parsed.value) : written
  }

  return {
    get: read,

    getOr: async (key, fallback) => (await read(key)) ?? fallback,

    set: write,

    update: async (key, change) => write(key, change(await read(key))),

    remove: (key) =>
      runWrite(`kv.remove(${key.name})`, async () => {
        await db.kv.delete(key.name)
      }),

    has: async (key) => (await db.kv.get(key.name)) !== undefined,

    listBackupSafe: () => db.kv.filter((row) => isBackupSafeKvKey(row.key)).toArray(),

    putRaw: async (rows) => {
      const reserved = rows.filter((row) => !isBackupSafeKvKey(row.key))
      // A restore carrying vault rows is a corrupted or tampered file: the export
      // cannot produce them. Refusing beats silently importing key material.
      if (reserved.length > 0) {
        return err(
          domainError('validation', 'Backup contains reserved key-material rows', {
            where: 'kv.putRaw',
            details: reserved.map((row) => `${row.key} — reserved namespace`),
          }),
        )
      }
      return runWrite('kv.putRaw', async () => {
        await db.kv.bulkPut([...rows])
        return rows.length
      })
    },

    clear: () => runWrite('kv.clear', () => db.kv.clear()),
  }
}
