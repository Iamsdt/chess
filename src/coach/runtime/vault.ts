import { z } from 'zod'

import { defineKvKey, kvRepo, type KvKey, type KvRepository } from '@/data'
import { COACH_PROVIDERS, type CoachProvider } from '@/domain'

/**
 * S21 · The BYOK key vault.
 *
 * What it promises, and what it cannot: a key at rest is AES-GCM ciphertext, and the key that
 * encrypts it is a non-extractable `CryptoKey` — page script can ask the browser to use it but can
 * never read its bytes out, so a copied IndexedDB dump is useless without this browser profile.
 * An optional passphrase adds a second layer (PBKDF2-SHA-256, 310k iterations) so the ciphertext
 * is also useless without something the user remembers. It does NOT defend against script running
 * inside the page while the vault is unlocked; Settings says so out loud.
 *
 * Why everything lives under `vault:`: the backup exports `kv` rows by prefix, and
 * `isBackupSafeKvKey` drops this whole namespace, so "never in backups" is a property of where
 * the data is stored rather than of anyone remembering to filter it.
 *
 * Why the provider is bound in as AES-GCM additional data: swapping one provider's record into
 * another's slot fails authentication instead of sending OpenAI's key to Anthropic's endpoint.
 *
 * Nothing here logs, and no error message contains key text.
 */

/** Strong enough to slow a guess, cheap enough to unlock in well under a second on a phone. */
export const PBKDF2_ITERATIONS = 310_000
export const MIN_PASSPHRASE_LENGTH = 8
const AES_IV_BYTES = 12
const SALT_BYTES = 16
const CHECK_PLAINTEXT = 'chess-king-vault-check'

/** The stored key was protected by a passphrase and the session has not unlocked it yet. */
export class VaultLockedError extends Error {
  override readonly name = 'VaultLockedError'
  constructor() {
    super('The key vault is locked. Enter your passphrase in Settings to unlock it.')
  }
}

/** A passphrase that failed to unlock, or that is too short to accept. */
export class VaultPassphraseError extends Error {
  override readonly name = 'VaultPassphraseError'
  readonly reason: 'wrong' | 'short' | 'not-set'
  constructor(reason: 'wrong' | 'short' | 'not-set') {
    super(
      reason === 'wrong'
        ? 'That passphrase is not right.'
        : reason === 'short'
          ? `Use at least ${String(MIN_PASSPHRASE_LENGTH)} characters for the passphrase.`
          : 'No passphrase is set.',
    )
    this.reason = reason
  }
}

/** The ciphertext no longer decrypts (a cleared profile key, a damaged row). */
export class VaultCorruptError extends Error {
  override readonly name = 'VaultCorruptError'
  constructor() {
    super('The stored key could not be read. Remove it and paste it again.')
  }
}

export function isVaultLockedError(value: unknown): value is VaultLockedError {
  return value instanceof Error && value.name === 'VaultLockedError'
}

const Base64Schema = z.string().min(1)
const SealedSchema = z.object({ iv: Base64Schema, ct: Base64Schema })

/** Why a duck-type check: `CryptoKey` is a different global in jsdom than in Node and the browser. */
const DeviceKeySchema = z.custom<CryptoKey>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'algorithm' in value &&
    'extractable' in value &&
    (value as { extractable: unknown }).extractable === false,
  'Expected a non-extractable CryptoKey',
)

const PassphraseMetaSchema = z.object({
  v: z.literal(1),
  salt: Base64Schema,
  iterations: z.number().int().min(100_000),
  check: SealedSchema,
})
type PassphraseMeta = z.infer<typeof PassphraseMetaSchema>

const KeyRecordSchema = z.object({
  v: z.literal(1),
  /** The device-key layer. */
  iv: Base64Schema,
  ct: Base64Schema,
  /** Present when the passphrase layer wraps `ct`. */
  wrap: z.object({ iv: Base64Schema }).optional(),
  /** Last four characters, so Settings can say which key is stored without decrypting it. */
  hint: z.string().max(4),
})
type KeyRecord = z.infer<typeof KeyRecordSchema>

const DEVICE_KEY = defineKvKey('vault:device-key', DeviceKeySchema)
const PASSPHRASE_META = defineKvKey('vault:passphrase', PassphraseMetaSchema)

const keyRecordKeys = new Map<CoachProvider, KvKey<KeyRecord>>()
function recordKey(provider: CoachProvider): KvKey<KeyRecord> {
  let key = keyRecordKeys.get(provider)
  if (key === undefined) {
    key = defineKvKey(`vault:key:${provider}`, KeyRecordSchema)
    keyRecordKeys.set(provider, key)
  }
  return key
}

/* ---------- Web Crypto helpers ---------- */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

async function seal(
  key: CryptoKey,
  plaintext: Uint8Array<ArrayBuffer>,
  aad: string,
): Promise<{ iv: string; ct: string }> {
  const iv = randomBytes(AES_IV_BYTES)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) },
    key,
    plaintext,
  )
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) }
}

async function open(
  key: CryptoKey,
  sealed: { iv: string; ct: string },
  aad: string,
): Promise<Uint8Array<ArrayBuffer> | undefined> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: encoder.encode(aad) },
      key,
      fromBase64(sealed.ct),
    )
    return new Uint8Array(plain)
  } catch {
    // Wrong key and damaged data are indistinguishable by design. Say nothing more.
    return undefined
  }
}

async function derivePassphraseKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/* ---------- The vault ---------- */

export interface VaultStatus {
  /** A passphrase layer exists. */
  readonly passphraseSet: boolean
  /** A passphrase layer exists and this session has not unlocked it. */
  readonly locked: boolean
}

export interface Vault {
  saveKey: (provider: CoachProvider, apiKey: string) => Promise<void>
  hasKey: (provider: CoachProvider) => Promise<boolean>
  /** `undefined` when nothing is stored; throws {@link VaultLockedError} when locked. */
  loadKey: (provider: CoachProvider) => Promise<string | undefined>
  /** `…abcd`, readable while locked. `undefined` when no key is stored. */
  keyHint: (provider: CoachProvider) => Promise<string | undefined>
  removeKey: (provider: CoachProvider) => Promise<void>
  setPassphrase: (passphrase: string) => Promise<void>
  clearPassphrase: () => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  /** Forget the derived key; the next read needs the passphrase again. */
  lock: () => Promise<void>
  isLocked: () => Promise<boolean>
  status: () => Promise<VaultStatus>
  /** Called after any change, so a status hook can re-read. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void
}

export function createVault(kv: KvRepository): Vault {
  /** In memory only: never written anywhere, gone when the tab closes. */
  let passphraseKey: CryptoKey | null = null
  let deviceKeyPromise: Promise<CryptoKey> | undefined
  const listeners = new Set<() => void>()

  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  async function written(result: Promise<{ ok: boolean }>): Promise<void> {
    const outcome = await result
    // Deliberately generic: the underlying error can name the key's row, never its value.
    if (!outcome.ok) throw new Error('The key vault could not be written to this browser.')
  }

  function deviceKey(): Promise<CryptoKey> {
    deviceKeyPromise ??= (async () => {
      const existing = await kv.get(DEVICE_KEY)
      if (existing !== undefined) return existing
      const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
      ])
      await written(kv.set(DEVICE_KEY, created))
      return created
    })().catch((error: unknown) => {
      deviceKeyPromise = undefined
      throw error
    })
    return deviceKeyPromise
  }

  async function status(): Promise<VaultStatus> {
    const meta = await kv.get(PASSPHRASE_META)
    return {
      passphraseSet: meta !== undefined,
      locked: meta !== undefined && passphraseKey === null,
    }
  }

  /** The inner (device-key) ciphertext of a record, unwrapping the passphrase layer if present. */
  async function innerOf(provider: CoachProvider, record: KeyRecord): Promise<string> {
    if (record.wrap === undefined) return record.ct
    if (passphraseKey === null) throw new VaultLockedError()
    const inner = await open(passphraseKey, { iv: record.wrap.iv, ct: record.ct }, provider)
    if (inner === undefined) throw new VaultCorruptError()
    return decoder.decode(inner)
  }

  async function decryptRecord(provider: CoachProvider, record: KeyRecord): Promise<string> {
    const inner = await innerOf(provider, record)
    const plain = await open(await deviceKey(), { iv: record.iv, ct: inner }, provider)
    if (plain === undefined) throw new VaultCorruptError()
    return decoder.decode(plain)
  }

  /** Wraps an inner ciphertext (a base64 string) in the current passphrase layer. */
  async function wrapInner(
    provider: CoachProvider,
    record: KeyRecord,
    inner: string,
    wrapKey: CryptoKey | null,
  ): Promise<KeyRecord> {
    const plain: KeyRecord = { v: 1, iv: record.iv, ct: inner, hint: record.hint }
    if (wrapKey === null) return plain
    const sealed = await seal(wrapKey, encoder.encode(inner), provider)
    return { ...plain, ct: sealed.ct, wrap: { iv: sealed.iv } }
  }

  /** Re-protects every stored record with `next` (or none), reading them with the current layer. */
  async function rewrapAll(next: CryptoKey | null): Promise<void> {
    for (const provider of COACH_PROVIDERS) {
      const record = await kv.get(recordKey(provider))
      if (record === undefined) continue
      const inner = await innerOf(provider, record)
      await written(kv.set(recordKey(provider), await wrapInner(provider, record, inner, next)))
    }
  }

  return {
    async saveKey(provider, apiKey) {
      const trimmed = apiKey.trim()
      if (trimmed === '') throw new Error('Paste a key first.')
      const meta = await kv.get(PASSPHRASE_META)
      if (meta !== undefined && passphraseKey === null) throw new VaultLockedError()
      const sealed = await seal(await deviceKey(), encoder.encode(trimmed), provider)
      const base: KeyRecord = {
        v: 1,
        iv: sealed.iv,
        ct: sealed.ct,
        hint: trimmed.length >= 12 ? trimmed.slice(-4) : '',
      }
      const record =
        meta === undefined ? base : await wrapInner(provider, base, sealed.ct, passphraseKey)
      await written(kv.set(recordKey(provider), record))
      notify()
    },

    hasKey: (provider) => kv.has(recordKey(provider)),

    async loadKey(provider) {
      const record = await kv.get(recordKey(provider))
      if (record === undefined) return undefined
      return decryptRecord(provider, record)
    },

    async keyHint(provider) {
      const record = await kv.get(recordKey(provider))
      return record === undefined ? undefined : record.hint
    },

    async removeKey(provider) {
      await written(kv.remove(recordKey(provider)))
      notify()
    },

    async setPassphrase(passphrase) {
      if (passphrase.length < MIN_PASSPHRASE_LENGTH) throw new VaultPassphraseError('short')
      const existing = await kv.get(PASSPHRASE_META)
      if (existing !== undefined && passphraseKey === null) throw new VaultLockedError()
      const salt = randomBytes(SALT_BYTES)
      const next = await derivePassphraseKey(passphrase, salt, PBKDF2_ITERATIONS)
      const check = await seal(next, encoder.encode(CHECK_PLAINTEXT), 'check')
      await rewrapAll(next)
      const meta: PassphraseMeta = {
        v: 1,
        salt: toBase64(salt),
        iterations: PBKDF2_ITERATIONS,
        check,
      }
      await written(kv.set(PASSPHRASE_META, meta))
      passphraseKey = next
      notify()
    },

    async clearPassphrase() {
      const meta = await kv.get(PASSPHRASE_META)
      if (meta === undefined) return
      if (passphraseKey === null) throw new VaultLockedError()
      await rewrapAll(null)
      await written(kv.remove(PASSPHRASE_META))
      passphraseKey = null
      notify()
    },

    async unlock(passphrase) {
      const meta = await kv.get(PASSPHRASE_META)
      if (meta === undefined) throw new VaultPassphraseError('not-set')
      const candidate = await derivePassphraseKey(
        passphrase,
        fromBase64(meta.salt),
        meta.iterations,
      )
      const check = await open(candidate, meta.check, 'check')
      if (check === undefined || decoder.decode(check) !== CHECK_PLAINTEXT) {
        throw new VaultPassphraseError('wrong')
      }
      passphraseKey = candidate
      notify()
    },

    lock() {
      passphraseKey = null
      notify()
      return Promise.resolve()
    },

    async isLocked() {
      return (await status()).locked
    },

    status,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** The app's vault, bound to the real database. Tests build their own with {@link createVault}. */
export const vault: Vault = createVault(kvRepo)
