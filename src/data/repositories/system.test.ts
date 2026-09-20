import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  FIXTURE_NOW,
  FIXTURE_TODAY,
  makeJob,
  makeProfile,
  makeSettings,
  makeStreakState,
  toJobId,
  toLocalDate,
  toSessionId,
  toTimestamp,
  type Job,
} from '@/domain'

import { createDb, type ChessKingDb } from '../db'
import { defineKvKey, KV_KEYS, VAULT_KV_PREFIX } from '../kv-keys'

import { createJobsRepository } from './jobs'
import { createKvRepository } from './kv'
import { createProfileRepository } from './profile'
import { createSessionsRepository } from './sessions'
import { createSettingsRepository } from './settings'

import type { PracticeSession } from '../schema'

let counter = 0
let db: ChessKingDb | undefined

afterEach(() => {
  db?.close()
  db = undefined
})

function setup(): {
  sessions: ReturnType<typeof createSessionsRepository>
  jobs: ReturnType<typeof createJobsRepository>
  settings: ReturnType<typeof createSettingsRepository>
  profile: ReturnType<typeof createProfileRepository>
  kv: ReturnType<typeof createKvRepository>
} {
  counter += 1
  db = createDb(`system-test-${String(counter)}`)
  return {
    sessions: createSessionsRepository(db),
    jobs: createJobsRepository(db),
    settings: createSettingsRepository(db),
    profile: createProfileRepository(db),
    kv: createKvRepository(db),
  }
}

const session = (id: string, overrides: Partial<PracticeSession> = {}): PracticeSession => ({
  id: toSessionId(id),
  kind: 'adaptive-puzzles',
  state: 'completed',
  day: FIXTURE_TODAY,
  startedAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  endedAt: toTimestamp(FIXTURE_NOW + 60_000),
  durationMs: 60_000,
  itemsAttempted: 4,
  itemsCorrect: 3,
  resumeState: {},
  ...overrides,
})

describe('sessions repository', () => {
  it('finds the session a reload interrupted', async () => {
    const { sessions } = setup()
    await sessions.start(session('s1'))
    await sessions.start(session('s2', { state: 'active', endedAt: null, kind: 'puzzle-rush' }))

    expect((await sessions.findActive())?.id).toBe('s2')
    expect((await sessions.findActive('puzzle-rush'))?.id).toBe('s2')
    expect(await sessions.findActive('lesson')).toBeUndefined()
  })

  it('totals the day for the goal ring and groups by kind', async () => {
    const { sessions } = setup()
    await sessions.start(session('s1', { durationMs: 300_000 }))
    await sessions.start(session('s2', { durationMs: 200_000, kind: 'lesson' }))
    await sessions.start(
      session('s3', {
        durationMs: 900_000,
        day: toLocalDate('2026-09-18'),
        startedAt: toTimestamp(FIXTURE_NOW - 24 * 3_600_000),
      }),
    )

    expect(await sessions.totalDurationForDay(FIXTURE_TODAY)).toBe(500_000)
    expect((await sessions.listByDay(FIXTURE_TODAY, 'lesson')).map((row) => row.id)).toEqual(['s2'])
    expect((await sessions.listByKind('adaptive-puzzles')).map((row) => row.id)).toEqual([
      's1',
      's3',
    ])
  })

  it('finishes a session with a state and a stamp', async () => {
    const { sessions } = setup()
    await sessions.start(session('s1', { state: 'active', endedAt: null }))

    const finished = await sessions.finish(toSessionId('s1'), 'abandoned', FIXTURE_NOW)
    expect(finished.ok && finished.value.state).toBe('abandoned')
    expect(finished.ok && finished.value.endedAt).toBe(FIXTURE_NOW)
    expect(await sessions.findActive()).toBeUndefined()
  })

  it('carries an opaque resume state through a round trip', async () => {
    const { sessions } = setup()
    await sessions.start(session('s1', { resumeState: { queue: ['p1', 'p2'], index: 1 } }))
    const stored = await sessions.get(toSessionId('s1'))
    expect(stored?.resumeState).toEqual({ queue: ['p1', 'p2'], index: 1 })
  })
})

describe('jobs repository', () => {
  const job = (id: string, overrides: Partial<Job> = {}): Job =>
    makeJob({ id: toJobId(id), state: 'queued', startedAt: null, lockOwner: null, ...overrides })

  it('claims the highest priority queued job, oldest first', async () => {
    const { jobs } = setup()
    await jobs.add(job('j1', { priority: 'low', createdAt: toTimestamp(FIXTURE_NOW - 3000) }))
    await jobs.add(job('j2', { priority: 'high', createdAt: toTimestamp(FIXTURE_NOW - 1000) }))
    await jobs.add(job('j3', { priority: 'high', createdAt: toTimestamp(FIXTURE_NOW - 2000) }))

    expect((await jobs.claimNext(FIXTURE_NOW))?.id).toBe('j3')
  })

  it('skips a job that is still backing off', async () => {
    const { jobs } = setup()
    await jobs.add(job('j1', { nextRunAt: toTimestamp(FIXTURE_NOW + 60_000) }))
    expect(await jobs.claimNext(FIXTURE_NOW)).toBeUndefined()
    expect((await jobs.claimNext(toTimestamp(FIXTURE_NOW + 120_000)))?.id).toBe('j1')
  })

  it('finds an unfinished twin by dedupe key and ignores a finished one', async () => {
    const { jobs } = setup()
    await jobs.add(
      job('done', { state: 'succeeded', dedupeKey: 'analyse:g1', finishedAt: FIXTURE_NOW }),
    )
    expect(await jobs.findActiveByDedupeKey('analyse-game', 'analyse:g1')).toBeUndefined()

    await jobs.add(job('live', { dedupeKey: 'analyse:g1' }))
    expect((await jobs.findActiveByDedupeKey('analyse-game', 'analyse:g1'))?.id).toBe('live')
  })

  it('reports progress and counts by state', async () => {
    const { jobs } = setup()
    await jobs.add(job('j1'))
    await jobs.add(job('j2', { state: 'running' }))

    const ticked = await jobs.setProgress(toJobId('j1'), 55, 'move 20 of 40')
    expect(ticked.ok && ticked.value.progress).toBe(55)
    expect(ticked.ok && ticked.value.progressLabel).toBe('move 20 of 40')

    expect((await jobs.listActive()).length).toBe(2)
    expect((await jobs.countByState()).queued).toBe(1)
    expect((await jobs.countByState()).running).toBe(1)
  })

  it('prunes finished jobs older than a cutoff', async () => {
    const { jobs } = setup()
    await jobs.add(
      job('old', { state: 'succeeded', finishedAt: toTimestamp(FIXTURE_NOW - 100_000) }),
    )
    await jobs.add(job('recent', { state: 'succeeded', finishedAt: FIXTURE_NOW }))
    await jobs.add(job('live'))

    const pruned = await jobs.pruneFinished(toTimestamp(FIXTURE_NOW - 1000))
    expect(pruned.ok && pruned.value).toBe(1)
    expect(await jobs.get(toJobId('recent'))).toBeDefined()
    expect(await jobs.get(toJobId('live'))).toBeDefined()
  })

  it('refuses a progress value outside 0-100', async () => {
    const { jobs } = setup()
    await jobs.add(job('j1'))
    const result = await jobs.setProgress(toJobId('j1'), 140)
    expect(result.ok).toBe(false)
    expect((await jobs.get(toJobId('j1')))?.progress).toBe(42)
  })
})

describe('settings repository', () => {
  it('answers with the schema defaults before anything is saved', async () => {
    const { settings } = setup()
    expect(await settings.peek()).toBeUndefined()

    const defaults = await settings.get()
    expect(defaults.theme).toBe('system')
    expect(defaults.board.pieceSet).toBe('california')
    expect(defaults.coach.hasKey).toBe(false)
  })

  it('saves, patches and resets', async () => {
    const { settings } = setup()
    await settings.save(makeSettings())

    const patched = await settings.update({ dailyGoalMinutes: 30 })
    expect(patched.ok && patched.value.dailyGoalMinutes).toBe(30)
    expect((await settings.get()).board.theme).toBe('grove')

    await settings.reset()
    expect((await settings.get()).dailyGoalMinutes).toBe(15)
  })

  it('never stores a field the settings schema does not name', async () => {
    const { settings } = setup()
    const smuggled = { ...makeSettings(), apiKey: 'sk-should-not-survive' }
    const saved = await settings.save(smuggled)

    expect(saved.ok).toBe(true)
    expect(await settings.get()).not.toHaveProperty('apiKey')
  })
})

describe('profile repository', () => {
  it('is absent until onboarding writes it', async () => {
    const { profile } = setup()
    expect(await profile.get()).toBeUndefined()

    const failed = await profile.update({ displayName: 'Nobody' })
    expect(!failed.ok && failed.error.code).toBe('not-found')

    await profile.save(makeProfile())
    expect((await profile.get())?.displayName).toBe('Shudipto')
  })

  it('patches the rating the puzzle loop writes back', async () => {
    const { profile } = setup()
    await profile.save(makeProfile())

    const updated = await profile.update({ puzzleRating: 1520 })
    expect(updated.ok && updated.value.puzzleRating).toBe(1520)
    expect((await profile.get())?.puzzleRatingDeviation).toBe(60.1)
  })
})

describe('kv repository', () => {
  it('round-trips a typed value and validates it on the way back', async () => {
    const { kv } = setup()
    expect(await kv.get(KV_KEYS.streak)).toBeUndefined()

    await kv.set(KV_KEYS.streak, makeStreakState())
    expect((await kv.get(KV_KEYS.streak))?.current).toBe(12)
    expect(await kv.has(KV_KEYS.streak)).toBe(true)

    await kv.remove(KV_KEYS.streak)
    expect(await kv.get(KV_KEYS.streak)).toBeUndefined()
  })

  it('refuses to store a value that does not match its key schema', async () => {
    const { kv } = setup()
    const bogus = { ...makeStreakState(), current: -4 }
    const result = await kv.set(KV_KEYS.streak, bogus)
    expect(result.ok).toBe(false)
    expect(await kv.has(KV_KEYS.streak)).toBe(false)
  })

  it('updates through a change function', async () => {
    const { kv } = setup()
    await kv.set(KV_KEYS.streak, makeStreakState())
    const bumped = await kv.update(KV_KEYS.streak, (current) => ({
      ...makeStreakState(),
      current: (current?.current ?? 0) + 1,
    }))
    expect(bumped.ok && bumped.value.current).toBe(13)
  })

  it('keeps a reserved namespace out of the backup-safe listing', async () => {
    const { kv } = setup()
    const vaultKey = defineKvKey(`${VAULT_KV_PREFIX}coach`, z.object({ ciphertext: z.string() }))

    await kv.set(KV_KEYS.seededAt, FIXTURE_NOW)
    await kv.set(vaultKey, { ciphertext: 'AAAA' })

    // The vault round-trips for its owner…
    expect(await kv.get(vaultKey)).toEqual({ ciphertext: 'AAAA' })
    // …and is invisible to anything that builds a backup.
    const safe = await kv.listBackupSafe()
    expect(safe.map((row) => row.key)).toEqual([KV_KEYS.seededAt.name])
  })

  it('refuses to restore rows from a reserved namespace', async () => {
    const { kv } = setup()
    const result = await kv.putRaw([
      { key: `${VAULT_KV_PREFIX}coach`, value: { ciphertext: 'AAAA' }, updatedAt: FIXTURE_NOW },
    ])
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.code).toBe('validation')
  })
})
