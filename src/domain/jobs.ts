import { z } from 'zod'

import { JobPrioritySchema, JobStateSchema, JobTypeSchema } from './enums'
import { JobIdSchema } from './ids'
import { TimestampSchema } from './primitives'

/**
 * A durable unit of background work.
 *
 * Why the payload stays `Record<string, unknown>`: the queue must survive a
 * reload and a schema change, so it stores whatever the enqueuer gave it and the
 * *handler* validates it with `assertValid` when it runs. A typed payload here
 * would put every feature's shapes into the job system.
 */
export const JobPayloadSchema = z.record(z.string(), z.unknown())
export type JobPayload = z.infer<typeof JobPayloadSchema>

export const JobErrorSchema = z.object({
  message: z.string().min(1),
  code: z.string().optional(),
  occurredAt: TimestampSchema,
})
export type JobError = z.infer<typeof JobErrorSchema>

export const JobSchema = z.object({
  id: JobIdSchema,
  type: JobTypeSchema,
  payload: JobPayloadSchema,
  state: JobStateSchema,
  priority: JobPrioritySchema.default('normal'),
  attempts: z.number().int().min(0).default(0),
  maxAttempts: z.number().int().min(1).default(3),
  /** 0–100; the devtools panel and every progress bar read this. */
  progress: z.number().min(0).max(100).default(0),
  /** What the progress bar says it is doing, e.g. `band 3 of 6`. */
  progressLabel: z.string().optional(),
  lastError: JobErrorSchema.nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  startedAt: TimestampSchema.nullable().default(null),
  finishedAt: TimestampSchema.nullable().default(null),
  /** Backoff target; the scheduler skips the job until this instant. */
  nextRunAt: TimestampSchema.nullable().default(null),
  /**
   * Why: enqueueing "analyse game X" twice must not analyse it twice. The queue
   * treats this as unique among unfinished jobs.
   */
  dedupeKey: z.string().nullable().default(null),
  /** The Web Locks owner that claimed the job, so a dead tab's claim is visible. */
  lockOwner: z.string().nullable().default(null),
})
export type Job = z.infer<typeof JobSchema>

/** Why: three screens ask "is this still going?"; they should not each re-derive it. */
export function isJobActive(job: Job): boolean {
  return job.state === 'queued' || job.state === 'running'
}
