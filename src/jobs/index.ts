/**
 * S11 · the durable background job queue.
 *
 * ```ts
 * import { jobs } from '@/jobs'
 *
 * jobs.registerHandler('analyse-game', async (payload, { signal, report }) => {
 *   const input = assertValid(AnalyseGamePayloadSchema, payload, 'analyse-game')
 *   for (const [index, fen] of input.positions.entries()) {
 *     signal.throwIfAborted()
 *     await engine.evaluate(fen, { signal })
 *     report(index / input.positions.length, `move ${String(index + 1)}`)
 *   }
 * })
 *
 * const id = await jobs.enqueue('analyse-game', payload, { dedupeKey: gameId })
 * const stop = jobs.observe(id, ({ progress }) => setBar(progress))
 * ```
 *
 * What the queue guarantees, and where each guarantee comes from:
 *
 * - **It survives a reload.** Every job is a row in S05's `jobs` table, and a job
 *   left `running` by a tab that went away is re-queued the next time a tab
 *   registers a handler for its type.
 * - **It stays out of the way.** Work is claimed inside `requestIdleCallback`, in
 *   slices bounded by a few milliseconds, and a slice ends the instant
 *   `navigator.scheduling.isInputPending()` says the user is doing something. The
 *   queue stands down completely while the tab is hidden or the device is saving
 *   power.
 * - **Two tabs never double-process.** A job type is claimed under a **Web Lock**
 *   named after it, and that lock dies with the tab holding it.
 * - **Every tab sees the same progress.** Transitions and whole-percent progress
 *   ticks fan out over a **BroadcastChannel**, validated on arrival.
 * - **A broken job stops being retried.** Failures back off exponentially and a job
 *   that exhausts its attempts is *quarantined*, visible in `/dev/jobs`, not silently
 *   retried for ever.
 *
 * Handlers own their payloads: the queue stores whatever it was given and the
 * handler validates it with `assertValid` before trusting a field of it.
 */
export type { EnqueueOptions, JobHandler, JobObserver, JobProgress, JobsApi } from './contract'

export { jobQueue, jobs } from './runtime'

export {
  createJobQueue,
  JobQueueError,
  type InFlightJob,
  type JobQueue,
  type JobQueueOptions,
  type JobsRuntimeStats,
  type PauseReason,
} from './queue'

export {
  backoffDelayMs,
  classifyFailure,
  DEFAULT_BACKOFF,
  DEFAULT_MAX_ATTEMPTS,
  NonRetryableJobError,
  type BackoffPolicy,
  type FailureDisposition,
} from './backoff'

export { JOBS_CHANNEL_NAME, JobBroadcastSchema, type JobBroadcast } from './messages'

export type {
  IdleBudget,
  IdleScheduler,
  JobChannel,
  JobLock,
  JobLockManager,
  JobsEnvironment,
  PowerSource,
  RunConditions,
} from './seams'

/** The browser bindings of the seams above; `hasX` is how a screen reports honestly
 *  that a fallback is in use. */
export { createBrowserEnvironment, hasBroadcastChannel, hasWebLocks } from './browser'
