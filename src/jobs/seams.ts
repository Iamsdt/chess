import type { JobsRepository } from '@/data'
import type { JobId, Timestamp } from '@/domain'

import type { JobBroadcast } from './messages'

/**
 * The host APIs S11 stands on, each behind a seam.
 *
 * Why: Web Locks, `BroadcastChannel`, `requestIdleCallback`, `isInputPending` and
 * the Battery Status API are all either missing from jsdom or unobservable from a
 * single tab, and they are exactly the parts whose *logic* most needs testing.
 * Everything the queue does with them goes through this file, so the unit tests
 * drive a deterministic fake and `browser.ts` supplies the real thing.
 */

export interface JobLock {
  /** Idempotent: the queue releases in a `finally`, which can run twice on stop. */
  release(): void
}

export interface JobLockManager {
  /**
   * Take `name` if it is free, otherwise resolve `null` immediately.
   *
   * Why never wait: a tab that queues behind another tab's lock would hold an idle
   * callback open for the length of a full-game analysis. The queue would rather
   * skip to a different job type and come back.
   */
  acquire(name: string): Promise<JobLock | null>
}

export interface JobChannel {
  post(message: JobBroadcast): void
  subscribe(listener: (message: JobBroadcast) => void): () => void
  close(): void
}

export interface IdleBudget {
  /** Milliseconds left in this slice; the queue stops claiming work when it runs out. */
  timeRemaining(): number
}

export interface IdleScheduler {
  /** Runs `task` at the next idle moment, or after `timeoutMs`; the result cancels it. */
  schedule(task: (budget: IdleBudget) => void, timeoutMs: number): () => void
  /** A plain delay, for backoff and for retrying a job another tab has locked. */
  delay(ms: number, task: () => void): () => void
}

/** The two reasons the plan gives for standing down, read as one value. */
export interface RunConditions {
  readonly hidden: boolean
  readonly batterySaver: boolean
}

export interface PowerSource {
  read(): RunConditions
  subscribe(listener: (conditions: RunConditions) => void): () => void
}

export interface JobsEnvironment {
  /** S05 owns the rows; S11 never opens a transaction of its own. */
  readonly repo: JobsRepository
  readonly locks: JobLockManager
  readonly channel: JobChannel
  readonly idle: IdleScheduler
  readonly power: PowerSource
  /**
   * The clocks and the dice, as properties rather than methods.
   *
   * Why properties: `random` is handed to `backoffDelayMs` unbound, and a method
   * would carry a `this` nobody supplies.
   */
  /** True while the user is typing or clicking; the queue gives the slice back. */
  readonly isInputPending: () => boolean
  readonly now: () => Timestamp
  /** Monotonic milliseconds, so a slice can be measured across a clock change. */
  readonly monotonic: () => number
  readonly newJobId: () => JobId
  /** Injected so backoff jitter is reproducible in a test. */
  readonly random: () => number
}
