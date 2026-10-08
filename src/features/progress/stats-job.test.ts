import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { attemptsRepo, clearAllData, kvRepo, profileRepo, puzzlesRepo, sessionsRepo } from '@/data'
import {
  createProfile,
  makePuzzle,
  makePuzzleAttempt,
  toAttemptId,
  toLocalDate,
  toPuzzleId,
  toSessionId,
  toTimestamp,
} from '@/domain'
import type { JobHandler, JobsApi } from '@/jobs'

import {
  buildStatsSnapshot,
  createStatsHandler,
  registerStatsHandler,
  requestStatsRebuild,
  STATS_DEDUPE_KEY,
} from './stats-job'
import { modelFromSnapshot, STATS_SNAPSHOT_KEY, StatsSnapshotSchema } from './stats-snapshot'

const NOW = Date.UTC(2026, 5, 15, 12)
const DAY = 86_400_000

beforeEach(async () => {
  await clearAllData()
})

async function seedHistory(): Promise<void> {
  const profile = createProfile({ displayName: 'Tester', skillLevel: 'club', timeZone: 'UTC' })
  await profileRepo.save({ ...profile, puzzleRating: 1500 })
  const puzzle = makePuzzle({ id: toPuzzleId('p1'), theme: 'fork' })
  await puzzlesRepo.bulkUpsert([puzzle])
  for (let i = 0; i < 4; i += 1) {
    await attemptsRepo.add(
      makePuzzleAttempt({
        id: toAttemptId(`a${String(i)}`),
        puzzleId: puzzle.id,
        rated: true,
        endedAt: toTimestamp(NOW - (4 - i) * DAY),
        ratingAfter: 1450 + i * 10,
      }),
    )
  }
  await sessionsRepo.start({
    id: toSessionId('s1'),
    kind: 'adaptive-puzzles',
    state: 'completed',
    day: toLocalDate('2026-06-14'),
    startedAt: toTimestamp(NOW - DAY),
    updatedAt: toTimestamp(NOW - DAY),
    endedAt: toTimestamp(NOW - DAY + 600_000),
    durationMs: 600_000,
    itemsAttempted: 4,
    itemsCorrect: 3,
    resumeState: {},
  })
}

describe('rebuild-stats', () => {
  it('writes a snapshot that validates and covers every range', async () => {
    await seedHistory()
    const handler = createStatsHandler()
    const report = vi.fn()
    await handler({}, { signal: new AbortController().signal, report })
    const stored = await kvRepo.get(STATS_SNAPSHOT_KEY)
    expect(stored).toBeDefined()
    expect(StatsSnapshotSchema.safeParse(stored).success).toBe(true)
    expect(Object.keys(stored?.models ?? {})).toEqual(['30d', '90d', 'all'])
    expect(report).toHaveBeenLastCalledWith(1, 'done')
  })

  it('stores the same figures live aggregation would give', async () => {
    await seedHistory()
    const snapshot = await buildStatsSnapshot(NOW)
    expect(snapshot.models['30d'].puzzleCount).toBe(4)
    expect(snapshot.models['30d'].puzzleChart?.last.value).toBe(1480)
    expect(snapshot.models['30d'].puzzleChart?.table.length).toBe(4)
  })

  it('stops when the job is cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      createStatsHandler()({}, { signal: controller.signal, report: vi.fn() }),
    ).rejects.toThrow()
    expect(await kvRepo.get(STATS_SNAPSHOT_KEY)).toBeUndefined()
  })

  it('is only trusted while its signature, day and zone match', async () => {
    await seedHistory()
    const snapshot = await buildStatsSnapshot(NOW)
    const context = { signature: snapshot.signature, now: toTimestamp(NOW), timeZone: 'UTC' }
    expect(modelFromSnapshot(snapshot, '30d', context)).toBeDefined()
    expect(modelFromSnapshot(snapshot, '30d', { ...context, signature: 'other' })).toBeUndefined()
    expect(
      modelFromSnapshot(snapshot, '30d', { ...context, now: toTimestamp(NOW + 2 * DAY) }),
    ).toBeUndefined()
    expect(
      modelFromSnapshot(snapshot, '30d', { ...context, timeZone: 'Asia/Tokyo' }),
    ).toBeUndefined()
    expect(modelFromSnapshot(undefined, '30d', context)).toBeUndefined()
  })

  it('registers once and enqueues under the shared dedupe key', async () => {
    const registered: string[] = []
    const enqueue = vi.fn(() => Promise.resolve('job-1'))
    const api = {
      registerHandler: (type: string, _handler: JobHandler) => registered.push(type),
      enqueue,
    } as unknown as JobsApi
    registerStatsHandler(api)
    registerStatsHandler(api)
    await requestStatsRebuild(api)
    expect(registered).toEqual(['rebuild-stats'])
    expect(enqueue).toHaveBeenCalledWith(
      'rebuild-stats',
      {},
      { priority: 'low', dedupeKey: STATS_DEDUPE_KEY },
    )
  })

  it('never throws when the queue is unavailable', async () => {
    const api = {
      registerHandler: () => undefined,
      enqueue: () => Promise.reject(new Error('no queue')),
    } as unknown as JobsApi
    await expect(requestStatsRebuild(api)).resolves.toBeUndefined()
  })
})
