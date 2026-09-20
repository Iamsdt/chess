import { z } from 'zod'

import { JobIdSchema, JobStateSchema, JobTypeSchema } from '@/domain'

/**
 * What one tab tells the others.
 *
 * Why a schema on a same-origin channel: a `BroadcastChannel` message is data from
 * outside this module's control — the other tab may be running yesterday's build,
 * or a stale service worker's — so it passes the same gate as a worker message or
 * a backup file before anything acts on it.
 */

/** One channel for the whole queue; the `kind` discriminant does the routing. */
export const JOBS_CHANNEL_NAME = 'chess-king:jobs'

const OriginSchema = z.string().min(1)

export const JobBroadcastSchema = z.discriminatedUnion('kind', [
  /** A job changed state or moved its progress bar; every tab's observers want it. */
  z.object({
    kind: z.literal('progress'),
    origin: OriginSchema,
    id: JobIdSchema,
    type: JobTypeSchema,
    state: JobStateSchema,
    /** 0–1 or null, exactly as `JobProgress` carries it; the wire is that fan-out. */
    progress: z.number().min(0).max(1).nullable(),
    label: z.string().optional(),
  }),
  /** "Whoever is running this, stop." Only the tab holding the job acts on it. */
  z.object({
    kind: z.literal('cancel'),
    origin: OriginSchema,
    id: JobIdSchema,
  }),
  /** New work exists. An idle tab that already drained the queue would not notice. */
  z.object({
    kind: z.literal('wake'),
    origin: OriginSchema,
    type: JobTypeSchema,
  }),
])
export type JobBroadcast = z.infer<typeof JobBroadcastSchema>
