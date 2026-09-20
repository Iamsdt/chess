import type { Job, JobId, JobPriority, JobState, JobType } from '@/domain'

/**
 * S11 · the contract four Wave 3 sprints code against.
 *
 * This file is the seam that was written before the implementation, so that S12,
 * S14, S19 and S20 could compile and test against fixed names instead of each
 * inventing their own. The names and signatures below are unchanged; only the
 * throwing stub that used to sit beside them is gone, replaced by `createJobQueue`.
 */

export interface EnqueueOptions {
  readonly priority?: JobPriority
  /** Two enqueues sharing a key collapse into one active job — re-analysing the same game
   *  twice is waste, not parallelism. */
  readonly dedupeKey?: string
}

export interface JobProgress {
  readonly id: JobId
  readonly state: JobState
  /** 0–1, or null while the handler cannot say. */
  readonly progress: number | null
  readonly label?: string
}

export type JobObserver = (progress: JobProgress) => void

/** A handler runs off the main thread's critical path and must honour `signal`. */
export type JobHandler = (
  payload: unknown,
  context: {
    readonly signal: AbortSignal
    readonly report: (progress: number, label?: string) => void
  },
) => Promise<void>

export interface JobsApi {
  enqueue(type: JobType, payload: unknown, options?: EnqueueOptions): Promise<JobId>
  observe(id: JobId, observer: JobObserver): () => void
  cancel(id: JobId): Promise<void>
  registerHandler(type: JobType, handler: JobHandler): void
  list(state?: JobState): Promise<Job[]>
}
