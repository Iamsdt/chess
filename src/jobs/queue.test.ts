import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { jobsRepo } from '@/data'

import { NonRetryableJobError, type BackoffPolicy } from './backoff'
import { createJobQueue, type JobQueue } from './queue'
import {
  createFakeEnvironment,
  createRunner,
  type FakeEnvironment,
} from './testing/fake-environment'

import type { JobProgress } from './contract'

/**
 * Queue unit tests.
 *
 * Everything here runs on the fake environment from `./testing`, on fake timers, so
 * "the scheduler woke up" and "the backoff expired" are things the test decides
 * rather than things it waits for. The host APIs these fakes stand in for — Web
 * Locks, `BroadcastChannel`, `requestIdleCallback`, `isInputPending` — do not exist
 * in jsdom; `multi-tab.test.ts` covers the locking *logic*, and `e2e/jobs-*.spec.ts`
 * is where the real implementations are exercised.
 */

/** The main-thread budget the queue is built with here, and asserted against below. */
const SLICE_MS = 5

/** No jitter, so a retry lands on a time the test can name. */
const FIXED_BACKOFF: BackoffPolicy = { baseMs: 100, factor: 2, maxMs: 1_000, jitter: 0 }

const run = createRunner(async (ms) => {
  await vi.advanceTimersByTimeAsync(ms)
})

let env: FakeEnvironment
let queue: JobQueue

function setup(): void {
  env = createFakeEnvironment({ repo: jobsRepo })
  queue = createJobQueue(env, { backoff: FIXED_BACKOFF, ownerId: 'tab-a', sliceMs: SLICE_MS })
}

beforeEach(async () => {
  // `setImmediate` stays real: `fake-indexeddb` drives its request events with it.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  })
  await jobsRepo.clear()
  setup()
})

afterEach(async () => {
  await queue.stop()
  vi.useRealTimers()
})

describe('enqueueing', () => {
  it('runs a queued job and tells observers how it is going', async () => {
    const seen: JobProgress[] = []
    queue.registerHandler('rebuild-stats', (_payload, { report }) => {
      report(0.5, 'halfway')
      return Promise.resolve()
    })

    const id = await queue.enqueue('rebuild-stats', { scope: 'all' })
    queue.observe(id, (progress) => seen.push(progress))
    await run(100)

    expect((await jobsRepo.get(id))?.state).toBe('succeeded')
    expect(seen.map((entry) => entry.state)).toContain('succeeded')
    expect(seen.some((entry) => entry.label === 'halfway')).toBe(true)
    expect(seen.at(-1)?.progress).toBe(1)
  })

  it('hands the handler the payload it was given', async () => {
    const payloads: unknown[] = []
    queue.registerHandler('import-pgn', (payload) => {
      payloads.push(payload)
      return Promise.resolve()
    })

    await queue.enqueue('import-pgn', { pgn: '1. e4 e5' })
    await run(100)

    expect(payloads).toEqual([{ pgn: '1. e4 e5' }])
  })

  it('collapses two enqueues that share a dedupe key', async () => {
    const first = await queue.enqueue('analyse-game', { gameId: 'g1' }, { dedupeKey: 'g1' })
    const second = await queue.enqueue('analyse-game', { gameId: 'g1' }, { dedupeKey: 'g1' })

    expect(second).toBe(first)
    expect(await jobsRepo.listByState('queued')).toHaveLength(1)
  })

  it('refuses a payload that is not a record', async () => {
    await expect(queue.enqueue('rebuild-stats', 'not a payload')).rejects.toThrow(
      /Invalid data from/,
    )
  })

  it('drains a high-priority job before a low-priority one queued earlier', async () => {
    const order: string[] = []
    queue.registerHandler('rebuild-stats', () => {
      order.push('rebuild-stats')
      return Promise.resolve()
    })
    queue.registerHandler('analyse-game', () => {
      order.push('analyse-game')
      return Promise.resolve()
    })

    await queue.enqueue('rebuild-stats', {}, { priority: 'low' })
    await queue.enqueue('analyse-game', {}, { priority: 'high' })
    await run(200)

    expect(order).toEqual(['analyse-game', 'rebuild-stats'])
  })

  it('leaves a job queued while no handler is registered for its type', async () => {
    const id = await queue.enqueue('prefetch-pack', { packId: 'p1' })
    await run(200)
    expect((await jobsRepo.get(id))?.state).toBe('queued')

    let ran = false
    queue.registerHandler('prefetch-pack', () => {
      ran = true
      return Promise.resolve()
    })
    await run(200)

    expect(ran).toBe(true)
    expect((await jobsRepo.get(id))?.state).toBe('succeeded')
  })
})

describe('failure handling', () => {
  it('retries on an exponential backoff and quarantines when the attempts run out', async () => {
    let attempts = 0
    queue.registerHandler('rebuild-stats', () => {
      attempts += 1
      return Promise.reject(new Error('stats exploded'))
    })

    const id = await queue.enqueue('rebuild-stats', {})
    await run(50)
    expect(attempts).toBe(1)
    expect((await jobsRepo.get(id))?.state).toBe('queued')

    // First retry is 100 ms away, so 50 ms is still too early.
    await run(40)
    expect(attempts).toBe(1)

    await run(100)
    expect(attempts).toBe(2)

    await run(300)
    expect(attempts).toBe(3)

    const job = await jobsRepo.get(id)
    expect(job?.state).toBe('quarantined')
    expect(job?.attempts).toBe(3)
    expect(job?.lastError?.message).toBe('stats exploded')
  })

  it('does not retry a job whose handler says retrying is pointless', async () => {
    let attempts = 0
    queue.registerHandler('import-pgn', () => {
      attempts += 1
      return Promise.reject(new NonRetryableJobError('that PGN is gibberish', 'bad-pgn'))
    })

    const id = await queue.enqueue('import-pgn', {})
    await run(1_000)

    const job = await jobsRepo.get(id)
    expect(attempts).toBe(1)
    expect(job?.state).toBe('failed')
    expect(job?.lastError?.code).toBe('bad-pgn')
  })

  it('puts a quarantined job back in the queue when asked', async () => {
    let attempts = 0
    queue.registerHandler('rebuild-stats', () => {
      attempts += 1
      return attempts <= 3 ? Promise.reject(new Error('nope')) : Promise.resolve()
    })

    const id = await queue.enqueue('rebuild-stats', {})
    await run(1_000)
    expect((await jobsRepo.get(id))?.state).toBe('quarantined')

    await queue.retry(id)
    await run(200)

    const job = await jobsRepo.get(id)
    expect(job?.state).toBe('succeeded')
    expect(job?.attempts).toBe(0)
  })
})

describe('cancellation', () => {
  it('aborts a running handler through its signal', async () => {
    queue.registerHandler(
      'analyse-game',
      (_payload, { signal }) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const id = await queue.enqueue('analyse-game', { gameId: 'g1' })
    await run(50)
    expect((await jobsRepo.get(id))?.state).toBe('running')

    await queue.cancel(id)
    await run(50)

    expect((await jobsRepo.get(id))?.state).toBe('cancelled')
  })

  it('cancels a job that has not started without running it', async () => {
    let ran = false
    const id = await queue.enqueue('rebuild-stats', {})
    await queue.cancel(id)
    queue.registerHandler('rebuild-stats', () => {
      ran = true
      return Promise.resolve()
    })
    await run(200)

    expect(ran).toBe(false)
    expect((await jobsRepo.get(id))?.state).toBe('cancelled')
  })
})

describe('standing down', () => {
  it('runs nothing while the tab is hidden, and catches up when it comes back', async () => {
    queue.registerHandler('rebuild-stats', () => Promise.resolve())
    env.controls.power.set({ hidden: true })

    const id = await queue.enqueue('rebuild-stats', {})
    await run(500)
    expect((await jobsRepo.get(id))?.state).toBe('queued')
    expect(queue.stats().pauseReasons).toContain('hidden')

    env.controls.power.set({ hidden: false })
    await run(200)

    expect((await jobsRepo.get(id))?.state).toBe('succeeded')
  })

  it('runs nothing while the device is saving power', async () => {
    queue.registerHandler('rebuild-stats', () => Promise.resolve())
    env.controls.power.set({ batterySaver: true })

    const id = await queue.enqueue('rebuild-stats', {})
    await run(500)

    expect((await jobsRepo.get(id))?.state).toBe('queued')
    expect(queue.stats().pauseReasons).toContain('battery-saver')
  })

  it('gives the slice back while the user is interacting, then resumes', async () => {
    queue.registerHandler('rebuild-stats', () => Promise.resolve())
    env.controls.inputPending = true

    const id = await queue.enqueue('rebuild-stats', {})
    await run(200)
    expect((await jobsRepo.get(id))?.state).toBe('queued')

    env.controls.inputPending = false
    await run(200)

    expect((await jobsRepo.get(id))?.state).toBe('succeeded')
  })

  it('keeps its own scheduling slices inside the main-thread budget', async () => {
    queue.registerHandler('rebuild-stats', () => Promise.resolve())
    queue.registerHandler('analyse-game', () => Promise.resolve())
    for (let index = 0; index < 10; index += 1) {
      await queue.enqueue('rebuild-stats', { index })
      await queue.enqueue('analyse-game', { index })
    }
    await run(3_000)

    const stats = queue.stats()
    expect(stats.completed).toBe(20)
    // §5's ~5 ms rule, applied to the queue's own bookkeeping. The budget is checked
    // at the top of the loop, so one more claim can begin inside a slice that has
    // just run out; what must not happen is a slice running on and on.
    expect(stats.maxSliceMs).toBeLessThan(SLICE_MS * 3)
  })
})

describe('reporting', () => {
  it('lists jobs newest first, and by state on request', async () => {
    queue.registerHandler('rebuild-stats', () => Promise.resolve())
    const done = await queue.enqueue('rebuild-stats', { a: 1 })
    await run(200)
    const waiting = await queue.enqueue('prefetch-pack', { b: 2 })

    const succeeded = await queue.list('succeeded')
    expect(succeeded.map((job) => job.id)).toEqual([done])
    expect((await queue.list()).map((job) => job.id)).toContain(waiting)
  })

  it('reports what the scheduler is doing', async () => {
    queue.registerHandler('rebuild-stats', () => Promise.resolve())
    await queue.enqueue('rebuild-stats', {})
    await run(200)

    const stats = queue.stats()
    expect(stats.owner).toBe('tab-a')
    expect(stats.started).toBe(true)
    expect(stats.handlers).toEqual(['rebuild-stats'])
    expect(stats.completed).toBe(1)
    expect(stats.throughputPerMinute).toBe(1)
    expect(stats.inFlight).toEqual([])
    expect(stats.heldLocks).toEqual([])
  })
})
