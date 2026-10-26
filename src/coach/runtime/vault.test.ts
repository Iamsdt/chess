import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import { assertNoKeyMaterial, createKvRepository, exportBackup, isBackupSafeKvKey } from '@/data'
import { createDb, type ChessKingDb } from '@/data/db'

import {
  createVault,
  isVaultLockedError,
  PBKDF2_ITERATIONS,
  VaultLockedError,
  VaultPassphraseError,
} from './vault'

let counter = 0
const dbs: ChessKingDb[] = []
function setup() {
  counter += 1
  const db = createDb(`vault-test-${String(counter)}`)
  dbs.push(db)
  const kv = createKvRepository(db)
  return { db, kv, vault: createVault(kv) }
}
afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close()
})

const KEY = 'sk-live-ABCDEFGHIJKLMNOP-wxyz'
const PASS = 'correct horse battery'

async function rawRows(db: ChessKingDb): Promise<string> {
  return JSON.stringify(await db.kv.toArray())
}

describe('key vault', () => {
  it('round-trips a key, hints only the last four characters and never stores plaintext', async () => {
    const { db, vault } = setup()
    expect(await vault.hasKey('openai')).toBe(false)
    await vault.saveKey('openai', `  ${KEY}  `)
    expect(await vault.hasKey('openai')).toBe(true)
    expect(await vault.loadKey('openai')).toBe(KEY)
    expect(await vault.keyHint('openai')).toBe('wxyz')
    expect(await rawRows(db)).not.toContain('ABCDEFGHIJ')
    expect(await vault.loadKey('anthropic')).toBeUndefined()
  })

  it('keeps providers apart and removes one key at a time', async () => {
    const { vault } = setup()
    await vault.saveKey('openai', KEY)
    await vault.saveKey('anthropic', 'sk-ant-other-key-0000')
    await vault.removeKey('openai')
    expect(await vault.hasKey('openai')).toBe(false)
    expect(await vault.loadKey('anthropic')).toBe('sk-ant-other-key-0000')
  })

  it('creates a non-extractable device key that is reused', async () => {
    const { db, vault } = setup()
    await vault.saveKey('openai', KEY)
    await vault.saveKey('gemini', 'AIza-another-key-1234')
    const row = await db.kv.get('vault:device-key')
    const deviceKey = row?.value as CryptoKey
    expect(deviceKey.extractable).toBe(false)
    expect(deviceKey.algorithm).toMatchObject({ name: 'AES-GCM' })
    expect((await db.kv.filter((r) => r.key === 'vault:device-key').toArray()).length).toBe(1)
  })

  it('rejects a record moved to another provider (bound as additional data)', async () => {
    const { db, vault } = setup()
    await vault.saveKey('openai', KEY)
    const row = await db.kv.get('vault:key:openai')
    await db.kv.put({ ...row!, key: 'vault:key:anthropic' })
    await expect(vault.loadKey('anthropic')).rejects.toThrow(/could not be read/)
  })

  it('locks behind a passphrase, and unlocks only with the right one', async () => {
    const { db, vault } = setup()
    await vault.saveKey('openai', KEY)
    await vault.setPassphrase(PASS)
    expect(await vault.isLocked()).toBe(false)
    expect(await vault.loadKey('openai')).toBe(KEY)

    // A new session: same database, fresh in-memory state.
    const session = createVault(createKvRepository(db))
    expect(await session.isLocked()).toBe(true)
    await expect(session.loadKey('openai')).rejects.toBeInstanceOf(VaultLockedError)
    await expect(session.saveKey('openai', 'new-key-value-123456')).rejects.toSatisfy(
      isVaultLockedError,
    )
    expect(await session.hasKey('openai')).toBe(true)
    expect(await session.keyHint('openai')).toBe('wxyz')

    await expect(session.unlock('wrong passphrase!')).rejects.toMatchObject({ reason: 'wrong' })
    expect(await session.isLocked()).toBe(true)
    await session.unlock(PASS)
    expect(await session.isLocked()).toBe(false)
    expect(await session.loadKey('openai')).toBe(KEY)

    await session.lock()
    expect(await session.isLocked()).toBe(true)
  })

  it('wraps keys saved after the passphrase was set, and uses strong PBKDF2', async () => {
    const { db, vault } = setup()
    await vault.setPassphrase(PASS)
    await vault.saveKey('groq', 'gsk_abcdefghijklmnop')
    const row = await db.kv.get('vault:key:groq')
    expect((row?.value as { wrap?: unknown }).wrap).toBeDefined()
    const meta = (await db.kv.get('vault:passphrase'))?.value as { iterations: number }
    expect(meta.iterations).toBe(PBKDF2_ITERATIONS)
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(210_000)
    expect(await vault.loadKey('groq')).toBe('gsk_abcdefghijklmnop')
  })

  it('clears the passphrase layer and keeps the keys readable', async () => {
    const { db, vault } = setup()
    await vault.saveKey('openai', KEY)
    await vault.setPassphrase(PASS)
    await vault.clearPassphrase()
    expect(await db.kv.get('vault:passphrase')).toBeUndefined()
    const fresh = createVault(createKvRepository(db))
    expect(await fresh.isLocked()).toBe(false)
    expect(await fresh.loadKey('openai')).toBe(KEY)
  })

  it('refuses short passphrases and an unlock when none is set', async () => {
    const { vault } = setup()
    await expect(vault.setPassphrase('short')).rejects.toBeInstanceOf(VaultPassphraseError)
    await expect(vault.unlock('anything long')).rejects.toMatchObject({ reason: 'not-set' })
    await expect(vault.saveKey('openai', '   ')).rejects.toThrow()
  })

  it('notifies subscribers when state changes', async () => {
    const { vault } = setup()
    let calls = 0
    const stop = vault.subscribe(() => {
      calls += 1
    })
    await vault.saveKey('openai', KEY)
    await vault.removeKey('openai')
    stop()
    await vault.saveKey('openai', KEY)
    expect(calls).toBe(2)
  })

  it('keeps every vault row out of a backup', async () => {
    const { db, kv, vault } = setup()
    await vault.saveKey('openai', KEY)
    await vault.setPassphrase(PASS)
    const exported = await exportBackup(db)
    if (!exported.ok) throw new Error(exported.error.message)

    const text = JSON.stringify(exported.value.file)
    expect(text).not.toContain(KEY)
    expect(text).not.toContain('ABCDEFGHIJ')
    expect(text).not.toContain('vault:')
    expect(assertNoKeyMaterial(exported.value.file).ok).toBe(true)
    expect(exported.value.file.data.kv.every((row) => isBackupSafeKvKey(row.key))).toBe(true)

    // The rows exist locally; they are simply unreachable by the export.
    expect(await db.kv.get('vault:device-key')).toBeDefined()
    expect(await kv.listBackupSafe()).toEqual([])
  })
})
