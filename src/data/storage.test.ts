import { afterEach, describe, expect, it } from 'vitest'

import {
  estimateStorage,
  QUOTA_CRITICAL_RATIO,
  QUOTA_WARN_RATIO,
  quotaLevel,
  requestPersistentStorage,
} from './storage'

/**
 * `navigator.storage` is typed as always present and is not, which is the whole
 * reason these functions return a `Result`. The tests install and remove a stand-in.
 */
const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'storage')

function installStorageManager(fake: Partial<StorageManager> | undefined): void {
  Object.defineProperty(globalThis.navigator, 'storage', {
    value: fake,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  if (originalDescriptor === undefined) {
    Reflect.deleteProperty(globalThis.navigator, 'storage')
  } else {
    Object.defineProperty(globalThis.navigator, 'storage', originalDescriptor)
  }
})

describe('quotaLevel', () => {
  it('turns amber and then red at the documented thresholds', () => {
    expect(quotaLevel(0)).toBe('ok')
    expect(quotaLevel(QUOTA_WARN_RATIO - 0.01)).toBe('ok')
    expect(quotaLevel(QUOTA_WARN_RATIO)).toBe('warn')
    expect(quotaLevel(QUOTA_CRITICAL_RATIO - 0.01)).toBe('warn')
    expect(quotaLevel(QUOTA_CRITICAL_RATIO)).toBe('critical')
    expect(quotaLevel(1)).toBe('critical')
  })
})

describe('estimateStorage', () => {
  it('reports usage, quota and the level the meter paints', async () => {
    installStorageManager({
      estimate: () => Promise.resolve({ usage: 850, quota: 1000 }),
      persisted: () => Promise.resolve(true),
    })

    const result = await estimateStorage()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.usageBytes).toBe(850)
    expect(result.value.quotaBytes).toBe(1000)
    expect(result.value.usedRatio).toBeCloseTo(0.85)
    expect(result.value.level).toBe('warn')
    expect(result.value.persisted).toBe(true)
  })

  it('never divides by a quota of zero', async () => {
    installStorageManager({
      estimate: () => Promise.resolve({}),
      persisted: () => Promise.resolve(false),
    })

    const result = await estimateStorage()
    expect(result.ok && result.value.usedRatio).toBe(0)
    expect(result.ok && result.value.level).toBe('ok')
  })

  it('says so as a value when the browser has no storage manager', async () => {
    installStorageManager(undefined)

    const result = await estimateStorage()
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.code).toBe('unsupported')
  })

  it('turns a thrown estimate into an io failure', async () => {
    installStorageManager({
      estimate: () => Promise.reject(new Error('denied')),
    })

    const result = await estimateStorage()
    expect(!result.ok && result.error.code).toBe('io')
  })
})

describe('requestPersistentStorage', () => {
  it('returns whether the browser granted it', async () => {
    installStorageManager({ persist: () => Promise.resolve(false) })
    expect(await requestPersistentStorage()).toEqual({ ok: true, value: false })

    installStorageManager({ persist: () => Promise.resolve(true) })
    expect(await requestPersistentStorage()).toEqual({ ok: true, value: true })
  })

  it('is unsupported rather than false when the browser cannot do it', async () => {
    installStorageManager({})
    const result = await requestPersistentStorage()
    expect(!result.ok && result.error.code).toBe('unsupported')
  })
})
