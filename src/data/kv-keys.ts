import { parseValid, StreakStateSchema, TimestampSchema, type Result } from '@/domain'

import type { z } from 'zod'

/**
 * Typed keys for the `kv` table.
 *
 * Why a key object rather than a bare string: the value comes back from
 * IndexedDB as `unknown`, so the only safe read is one that knows which schema
 * to check it against. Pairing the two here means a caller cannot read a key
 * without validating it, and cannot validate it with the wrong schema.
 */
export interface KvKey<T> {
  readonly name: string
  /**
   * Validates a value on its way out of, or into, storage.
   *
   * Why a closure rather than the schema itself: the key is generic over the
   * value it holds, and a zod schema's input type is not, so carrying the schema
   * on the interface would force every call site to restate it.
   */
  readonly parse: (value: unknown, where: string) => Result<T>
}

/**
 * Key material lives under this namespace and is structurally excluded from
 * every backup. S21 stores the encrypted BYOK vault here.
 */
export const VAULT_KV_PREFIX = 'vault:'

/** A second reserved namespace, for anything else that must never leave the device. */
export const SECRET_KV_PREFIX = 'secret:'

const RESERVED_PREFIXES = [VAULT_KV_PREFIX, SECRET_KV_PREFIX] as const

/**
 * Whether a key may be written to a backup file.
 *
 * Why an allow-by-prefix rule rather than a field scan: a scan can only reject
 * the shapes it was taught about, while a namespace makes "this never leaves the
 * device" a property of where the data is stored.
 */
export function isBackupSafeKvKey(name: string): boolean {
  return !RESERVED_PREFIXES.some((prefix) => name.startsWith(prefix))
}

/** Why: every sprint defines its own keys; this is the one place the pair is built. */
export function defineKvKey<Schema extends z.ZodType>(
  name: string,
  schema: Schema,
): KvKey<z.infer<Schema>> {
  return { name, parse: (value, where) => parseValid(schema, value, where) }
}

/** The keys this layer owns. Feature sprints add their own with `defineKvKey`. */
export const KV_KEYS = {
  /** S24's streak, freeze and today's progress. One row, rewritten daily. */
  streak: defineKvKey('streak', StreakStateSchema),
  /** When the dev seed last ran, so a reseed can be made idempotent. */
  seededAt: defineKvKey('seeded-at', TimestampSchema),
  /** When the user last exported a backup; S23 nudges when it gets stale. */
  lastBackupAt: defineKvKey('last-backup-at', TimestampSchema),
}
