import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { jobsRepo } from '@/data'

import { createJobQueue, type JobQueue } from './queue'
import {
  createChannelHub,
  createFakeEnvironment,
  createLockHub,
  createRunner,
  type ChannelHub,
  type LockHub,
} from './testing/fake-environment'

import type { JobHandler, JobProgress } from './contract'

/**
 * Two tabs, one database.
 *
 * jsdom has neither Web Locks nor `BroadcastChannel`, so both are fakes here — but
 * they are fakes of the *contract* the queue relies on: a lock has exactly one
 * holder, and a message reaches every endpoint except the one that sent it. What is
 * under test is the queue's use of them, which is where the double-processing bug
 * would live. That the real APIs behave this way is Chrome's problem, and
 * `e2e/jobs-multi-tab.spec.ts` is where it is checked against a real browser.
 */

const run = createRunner(async (ms) => {
  await vi.advanceTimersByTimeAsync(ms)
})

let locks: LockHub
let channels: ChannelHub
let tabA: JobQueue
let tabB: JobQueue

/** A handler that takes long enough for the other tab to get a turn at claiming it. */
function slowHandler(tab: string, log: string[]): JobHandler {
  return () => {
    log.push(tab)
    return new Promise<void>((resolve) => {
      setTimeout(resolve, 100)
    })
  }
}

beforeEach(async () => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  })
  await jobsRepo.clear()
  locks = createLockHub()
  channels = createChannelHub()
  tabA = createJobQueue(
    createFakeEnvironment({
      repo: jobsRepo,
      locks: locks.manager(),
      channel: channels.channel(),
      idPrefix: 'a',
    }),
    { ownerId: 'tab-a' },
  )
  tabB = createJobQueue(
    createFakeEnvironment({
      repo: jobsRepo,
      locks: locks.manager(),
      channel: channels.channel(),
      idPrefix: 'b',
    }),
    { ownerId: 'tab-b' },
  )
})

afterEach(async () => {
  await tabA.stop()
  await tabB.stop()
  vi.useRealTimers()
})

describe('one job, two tabs', () => {
  it('runs a job exactly once', async () => {
    const log: string[] = []
    tabA.registerHandler('analyse-game', slowHandler('a', log))
    tabB.registerHandler('analyse-game', slowHandler('b', log))

    const id = await tabA.enqueue('analyse-game', { gameId: 'g1' })
    await run(600)

    expect(log).toHaveLength(1)
    expect((await jobsRepo.get(id))?.state).toBe('succeeded')
    expect(locks.held()).toEqual([])
  })

  it('runs a batch of same-type jobs exactly once each', async () => {
    const log: string[] = []
    tabA.registerHandler('import-pgn', slowHandler('a', log))
    tabB.registerHandler('import-pgn', slowHandler('b', log))

    for (let index = 0; index < 6; index += 1) {
      await tabA.enqueue('import-pgn', { index })
    }
    await run(3_000)

    expect(log).toHaveLength(6)
    expect(await jobsRepo.listByState('succeeded')).toHaveLength(6)
    expect(await jobsRepo.listByState('queued')).toHaveLength(0)
  })

  it('lets the second tab take a different job type instead of waiting', async () => {
    const log: string[] = []
    tabA.registerHandler('analyse-game', slowHandler('a:analyse', log))
    tabA.registerHandler('import-pgn', slowHandler('a:import', log))
    tabB.registerHandler('analyse-game', slowHandler('b:analyse', log))
    tabB.registerHandler('import-pgn', slowHandler('b:import', log))

    await tabA.enqueue('analyse-game', {})
    await tabA.enqueue('import-pgn', {})
    await run(800)

    expect(log).toHaveLength(2)
    expect(await jobsRepo.listByState('succeeded')).toHaveLength(2)
  })
})

describe('fan-out', () => {
  it('shows progress from the working tab to an observer in the idle one', async () => {
    tabA.registerHandler('analyse-game', (_payload, { report }) => {
      report(0.42, 'move 12 of 30')
      return new Promise<void>((resolve) => {
        setTimeout(resolve, 50)
      })
    })

    const id = await tabB.enqueue('analyse-game', { gameId: 'g1' })
    const seen: JobProgress[] = []
    tabB.observe(id, (progress) => seen.push(progress))
    await run(400)

    expect(seen.some((entry) => entry.label === 'move 12 of 30' && entry.progress === 0.42)).toBe(
      true,
    )
    expect(seen.at(-1)?.state).toBe('succeeded')
  })

  it('cancels from the tab that is not running the job', async () => {
    tabA.registerHandler(
      'analyse-game',
      (_payload, { signal }) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const id = await tabB.enqueue('analyse-game', { gameId: 'g1' })
    await run(200)
    expect((await jobsRepo.get(id))?.state).toBe('running')

    await tabB.cancel(id)
    await run(200)

    expect((await jobsRepo.get(id))?.state).toBe('cancelled')
    expect(locks.held()).toEqual([])
  })
})
