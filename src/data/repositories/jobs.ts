import {
  err,
  isJobActive,
  JobSchema,
  now,
  ok,
  parseValid,
  type Result,
  type Job,
  type JobId,
  type JobPriority,
  type JobState,
  type JobType,
  type Timestamp,
} from '@/domain'

import { notFound, runWrite, writeValidated } from '../internal'

import type { ChessKingDb } from '../db'

/**
 * The durable job queue's storage.
 *
 * S11 owns the scheduler, the locks and the retry policy; this file owns only
 * the rows. `[state+priority]` and `[state+createdAt]` are the two orders the
 * scheduler picks in, and `[type+dedupeKey]` is how "analyse game X" enqueued
 * twice stays one job.
 */

/** Priorities in the order the scheduler drains them; mirrors the engine lanes. */
const PRIORITY_ORDER: readonly JobPriority[] = ['high', 'normal', 'low']
const MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER

export interface JobsRepository {
  get: (id: JobId) => Promise<Job | undefined>
  listByState: (state: JobState, limit?: number) => Promise<Job[]>
  /** Queued and running, which is what the devtools panel and every badge show. */
  listActive: () => Promise<Job[]>
  listByType: (type: JobType, state?: JobState) => Promise<Job[]>
  /**
   * The next job to run: highest priority first, oldest first within a priority,
   * skipping anything still in backoff.
   */
  claimNext: (at?: Timestamp) => Promise<Job | undefined>
  /** Why: a repeat enqueue must find the unfinished twin, not any historical one. */
  findActiveByDedupeKey: (type: JobType, dedupeKey: string) => Promise<Job | undefined>
  countByState: () => Promise<Record<JobState, number>>
  add: (job: Job) => Promise<Result<Job>>
  update: (id: JobId, patch: Partial<Job>) => Promise<Result<Job>>
  /** Progress ticks are frequent; this is the narrow write they use. */
  setProgress: (id: JobId, progress: number, label?: string) => Promise<Result<Job>>
  remove: (id: JobId) => Promise<Result<void>>
  /** Housekeeping: drop finished jobs older than `before`. */
  pruneFinished: (before: Timestamp) => Promise<Result<number>>
  clear: () => Promise<Result<void>>
}

export function createJobsRepository(db: ChessKingDb): JobsRepository {
  async function update(id: JobId, patch: Partial<Job>): Promise<Result<Job>> {
    const outcome = await runWrite('jobs.update', () =>
      db.transaction('rw', db.jobs, async (): Promise<Result<Job>> => {
        const existing = await db.jobs.get(id)
        if (existing === undefined) return err(notFound('jobs.update', id))
        const parsed = parseValid(
          JobSchema,
          { ...existing, ...patch, updatedAt: patch.updatedAt ?? now() },
          'jobs.update',
        )
        if (!parsed.ok) return parsed
        await db.jobs.put(parsed.value)
        return ok(parsed.value)
      }),
    )
    return outcome.ok ? outcome.value : outcome
  }

  return {
    get: (id) => db.jobs.get(id),

    listByState: (state, limit) => {
      const collection = db.jobs
        .where('[state+createdAt]')
        .between([state, 0], [state, MAX_TIMESTAMP], true, true)
      return limit === undefined ? collection.toArray() : collection.limit(limit).toArray()
    },

    listActive: () => db.jobs.where('state').anyOf(['queued', 'running']).sortBy('createdAt'),

    listByType: (type, state) =>
      state === undefined
        ? db.jobs.where('type').equals(type).toArray()
        : db.jobs.where('[type+state]').equals([type, state]).toArray(),

    claimNext: async (at) => {
      const cutoff = at ?? now()
      for (const priority of PRIORITY_ORDER) {
        const candidates = await db.jobs
          .where('[state+priority]')
          .equals(['queued', priority])
          .filter((job) => job.nextRunAt === null || job.nextRunAt <= cutoff)
          .sortBy('createdAt')
        const first = candidates[0]
        if (first !== undefined) return first
      }
      return undefined
    },

    findActiveByDedupeKey: (type, dedupeKey) =>
      db.jobs
        .where('[type+dedupeKey]')
        .equals([type, dedupeKey])
        .filter((job) => isJobActive(job))
        .first(),

    countByState: async () => {
      const counts: Record<JobState, number> = {
        queued: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
        quarantined: 0,
      }
      await db.jobs.each((job) => {
        counts[job.state] += 1
      })
      return counts
    },

    add: (job) =>
      writeValidated(JobSchema, job, 'jobs.add', async (validated) => {
        await db.jobs.put(validated)
        return validated
      }),

    update,

    setProgress: (id, progress, label) =>
      update(id, { progress, ...(label === undefined ? {} : { progressLabel: label }) }),

    remove: (id) =>
      runWrite('jobs.remove', async () => {
        await db.jobs.delete(id)
      }),

    pruneFinished: (before) =>
      runWrite('jobs.pruneFinished', () =>
        db.jobs
          .where('state')
          .anyOf(['succeeded', 'failed', 'cancelled'])
          .filter((job) => job.finishedAt !== null && job.finishedAt < before)
          .delete(),
      ),

    clear: () => runWrite('jobs.clear', () => db.jobs.clear()),
  }
}
