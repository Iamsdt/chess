import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { jobsRepo } from '@/data'
import { makeJob, toJobId } from '@/domain'

import { createJobQueue, type JobQueue } from './queue'
import {
  createChannelHub,
  createFakeEnvironment,
  createLockHub,
  createRunner,
  type ChannelHub,
  type LockHub,
} from './testing/fake-environment'

import type { BackoffPolicy } from './backoff'

/**
 * Crash recovery: what a tab finds when it opens on a database another tab died in
 * the middle of.
 *
 * The liveness signal is the Web Lock, not a heartbeat or a timeout: a lock dies
 * with the tab that held it, so a job type whose lock is free has nobody working on
 * it however confident its rows are.
 */

const run = createRunner(async (ms) => {
  await vi.advanceTimersByTimeAsync(ms)
})
const FAST_BACKOFF: BackoffPolicy = { baseMs: 100, factor: 2, maxMs: 1_000, jitter: 0 }

let locks: LockHub
let channels: ChannelHub
let queues: JobQueue[]

/** A tab. Building a second one on the same hubs is what "after the reload" means. */
function openTab(owner: string): JobQueue {
  const queue = createJobQueue(
    createFakeEnvironment({
      repo: jobsRepo,
      locks: locks.manager(),
      channel: channels.channel(),
      idPrefix: owner,
    }),
    { ownerId: owner, backoff: FAST_BACKOFF },
  )
  queues.push(queue)
  return queue
}

beforeEach(async () => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  })
  await jobsRepo.clear()
  locks = createLockHub()
  channels = createChannelHub()
  queues = []
})

afterEach(async () => {
  for (const queue of queues) await queue.stop()
  vi.useRealTimers()
})

describe('after a tab dies mid-job', () => {
  it('re-queues the orphan and finishes it', async () => {
    await jobsRepo.add(
      makeJob({
        id: toJobId('job-orphan'),
        type: 'analyse-game',
        state: 'running',
        attempts: 0,
        progress: 40,
        lockOwner: 'dead-tab',
      }),
    )

    let ran = false
    const tab = openTab('tab-b')
    tab.registerHandler('analyse-game', () => {
      ran = true
      return Promise.resolve()
    })
    await run(500)

    const job = await jobsRepo.get(toJobId('job-orphan'))
    expect(ran).toBe(true)
    expect(job?.state).toBe('succeeded')
    expect(job?.attempts).toBe(1)
    expect(job?.lockOwner).toBeNull()
  })

  it('quarantines a job that has already taken a tab down too often', async () => {
    await jobsRepo.add(
      makeJob({
        id: toJobId('job-poison'),
        type: 'analyse-game',
        state: 'running',
        attempts: 2,
        maxAttempts: 3,
        lockOwner: 'dead-tab',
      }),
    )

    let ran = false
    const tab = openTab('tab-b')
    tab.registerHandler('analyse-game', () => {
      ran = true
      return Promise.resolve()
    })
    await run(500)

    const job = await jobsRepo.get(toJobId('job-poison'))
    expect(ran).toBe(false)
    expect(job?.state).toBe('quarantined')
    expect(job?.lastError?.code).toBe('interrupted')
  })

  it('leaves a running job alone while another tab still holds its lock', async () => {
    await jobsRepo.add(
      makeJob({
        id: toJobId('job-live'),
        type: 'analyse-game',
        state: 'running',
        lockOwner: 'tab-a',
      }),
    )
    const heldByLivingTab = await locks.manager().acquire('chess-king:job:analyse-game')
    expect(heldByLivingTab).not.toBeNull()

    const tab = openTab('tab-b')
    tab.registerHandler('analyse-game', () => Promise.resolve())
    await run(500)

    expect((await jobsRepo.get(toJobId('job-live')))?.state).toBe('running')
    heldByLivingTab?.release()
  })
})

describe('after a reload', () => {
  it('finishes a job that was queued before the page went away', async () => {
    const before = openTab('tab-before')
    const id = await before.enqueue('analyse-game', { gameId: 'g1' }, { priority: 'high' })
    await run(100)
    // Nothing handled it: this tab had no handler for it, exactly as on a cold start.
    expect((await jobsRepo.get(id))?.state).toBe('queued')
    await before.stop()

    let ran = false
    const after = openTab('tab-after')
    after.registerHandler('analyse-game', () => {
      ran = true
      return Promise.resolve()
    })
    await run(500)

    expect(ran).toBe(true)
    expect((await jobsRepo.get(id))?.state).toBe('succeeded')
  })

  it('re-queues a job the tab was in the middle of when it was stopped', async () => {
    const before = openTab('tab-before')
    before.registerHandler(
      'import-pgn',
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 10_000)
        }),
    )
    const id = await before.enqueue('import-pgn', { pgn: '1. e4' })
    await run(200)
    expect((await jobsRepo.get(id))?.state).toBe('running')

    await before.stop()
    await run(50)
    const requeued = await jobsRepo.get(id)
    expect(requeued?.state).toBe('queued')
    // An orderly stop is not the job's fault, so it costs no attempt.
    expect(requeued?.attempts).toBe(0)

    let ran = false
    const after = openTab('tab-after')
    after.registerHandler('import-pgn', () => {
      ran = true
      return Promise.resolve()
    })
    await run(500)

    expect(ran).toBe(true)
    expect((await jobsRepo.get(id))?.state).toBe('succeeded')
  })
})
