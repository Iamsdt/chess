import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import { createKvRepository } from '@/data'
import { createDb, type ChessKingDb } from '@/data/db'

import { isCoachError } from '../port'

import { assertUnderCap, monthKey, readMonthUsage, recordUsage, usageKvKey } from './usage'

let counter = 0
const dbs: ChessKingDb[] = []
function open() {
  counter += 1
  const db = createDb(`usage-test-${String(counter)}`)
  dbs.push(db)
  return createKvRepository(db)
}
afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close()
})

describe('usage meter', () => {
  it('formats the month in local time', () => {
    expect(monthKey(new Date(2026, 0, 31))).toBe('2026-01')
    expect(monthKey(new Date(2026, 11, 1))).toBe('2026-12')
  })

  it('accumulates per month and keeps months apart', async () => {
    const kv = open()
    const june = new Date(2026, 5, 10)
    const july = new Date(2026, 6, 1)
    await recordUsage({ promptTokens: 100, completionTokens: 20 }, kv, june)
    await recordUsage({ promptTokens: 50, completionTokens: 5 }, kv, june)
    await recordUsage({ promptTokens: 7, completionTokens: 1 }, kv, july)
    expect(await readMonthUsage(kv, june)).toEqual({
      promptTokens: 150,
      completionTokens: 25,
      requests: 2,
    })
    expect((await readMonthUsage(kv, july)).requests).toBe(1)
    expect(usageKvKey('2026-06').name).toBe('coach-usage:2026-06')
  })

  it('throws a non-retryable CoachError at the cap and never for cap 0', () => {
    const usage = { promptTokens: 400, completionTokens: 100, requests: 3 }
    expect(() => {
      assertUnderCap(usage, 500)
    }).toThrow(/Raise the cap in Settings/)
    try {
      assertUnderCap(usage, 500)
    } catch (error) {
      expect(isCoachError(error) && error.retryable).toBe(false)
    }
    expect(() => {
      assertUnderCap(usage, 501)
    }).not.toThrow()
    expect(() => {
      assertUnderCap(usage, 0)
    }).not.toThrow()
  })
})
