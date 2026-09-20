import { domainError, err, ok, type Result } from '@/domain'

/**
 * How much room is left.
 *
 * Why it matters here and not in a settings screen: everything this app knows
 * lives in IndexedDB, and a browser that evicts it takes the user's games,
 * ratings and repertoire with it. The estimate drives both the storage meter in
 * S23 and the warning that asks for persistence before it is too late.
 */

export const QUOTA_LEVELS = ['ok', 'warn', 'critical'] as const
export type QuotaLevel = (typeof QUOTA_LEVELS)[number]

/** Above this share of the quota the meter turns amber, above the second, red. */
export const QUOTA_WARN_RATIO = 0.8
export const QUOTA_CRITICAL_RATIO = 0.95

export interface StorageEstimateInfo {
  /** Bytes in use, as the browser reports them — coarse and padded on purpose. */
  usageBytes: number
  quotaBytes: number
  /** 0–1. `0` when the browser reports no quota, so callers never divide by zero. */
  usedRatio: number
  level: QuotaLevel
  /** Whether the origin's storage is exempt from eviction under pressure. */
  persisted: boolean
}

/** Why a function: the thresholds are product decisions and get tested directly. */
export function quotaLevel(usedRatio: number): QuotaLevel {
  if (usedRatio >= QUOTA_CRITICAL_RATIO) return 'critical'
  if (usedRatio >= QUOTA_WARN_RATIO) return 'warn'
  return 'ok'
}

/**
 * Why the widened return type: the DOM types declare `navigator.storage` as
 * always present, and Firefox in private mode and some embedded webviews
 * disagree. Narrowing the lie here keeps the `undefined` branch reachable.
 */
function storageManager(): StorageManager | undefined {
  return globalThis.navigator.storage
}

/**
 * Reads the origin's storage estimate.
 *
 * Fails as a value rather than throwing, because Firefox in private mode and
 * some embedded webviews have no `navigator.storage` at all and the settings
 * screen has to render something sensible either way.
 */
export async function estimateStorage(): Promise<Result<StorageEstimateInfo>> {
  try {
    const storage = storageManager()
    if (storage === undefined || typeof storage.estimate !== 'function') {
      return err(
        domainError('unsupported', 'This browser does not report a storage estimate', {
          where: 'storage.estimateStorage',
        }),
      )
    }
    const estimate = await storage.estimate()
    const usageBytes = estimate.usage ?? 0
    const quotaBytes = estimate.quota ?? 0
    const usedRatio = quotaBytes > 0 ? usageBytes / quotaBytes : 0
    const persisted = typeof storage.persisted === 'function' ? await storage.persisted() : false
    return ok({ usageBytes, quotaBytes, usedRatio, level: quotaLevel(usedRatio), persisted })
  } catch (error: unknown) {
    return err(
      domainError('io', 'Could not read the storage estimate', {
        where: 'storage.estimateStorage',
        cause: error,
      }),
    )
  }
}

/**
 * Asks the browser to exempt this origin from eviction.
 *
 * Why it returns the answer instead of assuming it: Chrome grants it silently
 * on an engaged origin and refuses otherwise, and the settings screen says which
 * happened rather than claiming the data is safe.
 */
export async function requestPersistentStorage(): Promise<Result<boolean>> {
  try {
    const storage = storageManager()
    if (storage === undefined || typeof storage.persist !== 'function') {
      return err(
        domainError('unsupported', 'This browser cannot make storage persistent', {
          where: 'storage.requestPersistentStorage',
        }),
      )
    }
    return ok(await storage.persist())
  } catch (error: unknown) {
    return err(
      domainError('io', 'Could not request persistent storage', {
        where: 'storage.requestPersistentStorage',
        cause: error,
      }),
    )
  }
}
