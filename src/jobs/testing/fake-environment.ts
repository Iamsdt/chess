import type { JobsRepository } from '@/data'
import { parseValid, toJobId, toTimestamp, type JobId } from '@/domain'

import { JobBroadcastSchema, type JobBroadcast } from '../messages'

import type {
  IdleScheduler,
  JobChannel,
  JobLock,
  JobLockManager,
  JobsEnvironment,
  PowerSource,
  RunConditions,
} from '../seams'

/**
 * A job environment with no browser in it.
 *
 * Why it ships in `src` rather than in a test file: jsdom has no Web Locks and no
 * `BroadcastChannel`, so every sprint that enqueues work (S13's review, S20's
 * import) needs the same fakes to test its handler. This mirrors S07's
 * `@/engine/testing/fake-engine`.
 *
 * The fakes are deliberately faithful where it matters: the lock hub refuses a
 * second holder exactly as Web Locks would, and the channel hub delivers
 * asynchronously to every subscriber *except* the sender, JSON-round-tripped and
 * re-validated, exactly as a real `BroadcastChannel` message arrives.
 */

/** Captured at import, before a test installs fake timers. */
const realSetTimeout = globalThis.setTimeout.bind(globalThis)

const realTurn = (): Promise<void> =>
  new Promise<void>((resolve) => {
    realSetTimeout(resolve, 0)
  })

/**
 * Step the scheduler's virtual time and storage's real tasks together.
 *
 * Why it is needed: the queue's own timers are faked, so a test decides when an idle
 * callback fires and when a backoff expires — but `fake-indexeddb` completes its
 * requests on a real task, which advancing virtual time does not flush. Pass
 * `vi.advanceTimersByTimeAsync`; the returned function interleaves the two.
 */
export function createRunner(
  advance: (ms: number) => Promise<void>,
  stepMs = 8,
): (ms: number) => Promise<void> {
  return async (ms: number): Promise<void> => {
    for (let elapsed = 0; elapsed <= ms; elapsed += stepMs) {
      await advance(stepMs)
      // Two turns: one IndexedDB operation can take more than a single task to land.
      await realTurn()
      await realTurn()
    }
  }
}

/** One process-wide lock table shared by every "tab" built from the same hub. */
export interface LockHub {
  /** A manager for one tab. Two managers from one hub exclude each other. */
  manager(): JobLockManager
  /** Which lock names are held right now, for assertions. */
  held(): readonly string[]
}

export function createLockHub(): LockHub {
  const held = new Set<string>()
  return {
    manager(): JobLockManager {
      return {
        acquire(name: string): Promise<JobLock | null> {
          if (held.has(name)) return Promise.resolve(null)
          held.add(name)
          let released = false
          const lock: JobLock = {
            release() {
              if (released) return
              released = true
              held.delete(name)
            },
          }
          return Promise.resolve(lock)
        },
      }
    },
    held: () => [...held],
  }
}

export interface ChannelHub {
  /** A channel endpoint for one tab. */
  channel(): JobChannel
  /** Everything posted, in order, for assertions. */
  posted(): readonly JobBroadcast[]
}

export function createChannelHub(): ChannelHub {
  interface Endpoint {
    readonly listeners: Set<(message: JobBroadcast) => void>
    closed: boolean
  }
  const endpoints = new Set<Endpoint>()
  const posted: JobBroadcast[] = []

  return {
    channel(): JobChannel {
      const self: Endpoint = { listeners: new Set(), closed: false }
      endpoints.add(self)
      return {
        post(message) {
          if (self.closed) return
          posted.push(message)
          // The wire is a boundary: round-trip and re-validate, as the browser does.
          const wire: unknown = JSON.parse(JSON.stringify(message))
          const parsed = parseValid(JobBroadcastSchema, wire, 'fake jobs broadcast')
          if (!parsed.ok) throw new Error(parsed.error.message)
          const delivered = parsed.value
          queueMicrotask(() => {
            for (const endpoint of [...endpoints]) {
              if (endpoint === self || endpoint.closed) continue
              for (const listener of [...endpoint.listeners]) listener(delivered)
            }
          })
        },
        subscribe(listener) {
          self.listeners.add(listener)
          return () => {
            self.listeners.delete(listener)
          }
        },
        close() {
          self.closed = true
          self.listeners.clear()
          endpoints.delete(self)
        },
      }
    },
    posted: () => posted,
  }
}

/**
 * Idle scheduling as a zero-delay timeout, so `vi.advanceTimersByTimeAsync` drives
 * the whole scheduler. The budget it hands out is generous; the queue's own
 * `sliceMs` is what the tests bound.
 */
export function createFakeIdleScheduler(budgetMs = 50): IdleScheduler {
  return {
    schedule(task, _timeoutMs) {
      const handle = setTimeout(() => {
        task({ timeRemaining: () => budgetMs })
      }, 0)
      return () => {
        clearTimeout(handle)
      }
    },
    delay(ms, task) {
      const handle = setTimeout(task, ms)
      return () => {
        clearTimeout(handle)
      }
    },
  }
}

const FULL_POWER: RunConditions = { hidden: false, batterySaver: false }

export interface FakePowerSource extends PowerSource {
  /** Flip visibility or battery saver and notify the queue, as the browser would. */
  set(next: Partial<RunConditions>): void
}

export function createFakePowerSource(initial: RunConditions = FULL_POWER): FakePowerSource {
  const listeners = new Set<(conditions: RunConditions) => void>()
  let conditions = initial
  return {
    read: () => conditions,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(next) {
      conditions = { ...conditions, ...next }
      for (const listener of [...listeners]) listener(conditions)
    },
  }
}

export interface FakeEnvironmentControls {
  /** Read by the scheduler on every loop turn; set it to make the queue stand down. */
  inputPending: boolean
  /** What `random()` returns, so backoff jitter is a constant in tests. */
  randomValue: number
  readonly power: FakePowerSource
}

export interface FakeEnvironment extends JobsEnvironment {
  readonly controls: FakeEnvironmentControls
}

export interface FakeEnvironmentOptions {
  readonly repo: JobsRepository
  /** Share one hub between two environments to model two tabs. */
  readonly locks?: JobLockManager
  readonly channel?: JobChannel
  /** Prefix for the deterministic ids this environment mints. */
  readonly idPrefix?: string
  readonly idleBudgetMs?: number
}

export function createFakeEnvironment(options: FakeEnvironmentOptions): FakeEnvironment {
  const power = createFakePowerSource()
  const controls: FakeEnvironmentControls = {
    inputPending: false,
    randomValue: 0.5,
    power,
  }
  const prefix = options.idPrefix ?? 'job'
  let counter = 0
  const newJobId = (): JobId => {
    counter += 1
    return toJobId(`${prefix}_${String(counter)}`)
  }

  return {
    repo: options.repo,
    locks: options.locks ?? createLockHub().manager(),
    channel: options.channel ?? createChannelHub().channel(),
    idle: createFakeIdleScheduler(options.idleBudgetMs),
    power,
    isInputPending: () => controls.inputPending,
    now: () => toTimestamp(Date.now()),
    monotonic: () => performance.now(),
    newJobId,
    random: () => controls.randomValue,
    controls,
  }
}
