import { ok, type Result } from '@/domain'

import { runWrite, writeValidated } from '../internal'
import { CoachThreadRowSchema } from '../schema'

import type { ChessKingDb } from '../db'
import type { CoachThreadRow } from '../schema'

/**
 * The Session layer: Sage conversations, so a chat survives a reload (coach-agent.md §6).
 *
 * Why a cap: a calculation tree or a board card makes a message several kilobytes, and nobody
 * reopens a chat from last spring. The oldest threads fall off when a newer one is saved.
 */
export const MAX_STORED_THREADS = 30

export interface CoachThreadsRepository {
  /** Newest first. A row that no longer matches its schema is left out, not thrown. */
  list: () => Promise<CoachThreadRow[]>
  /** Upserts one thread and prunes past `MAX_STORED_THREADS`. */
  save: (thread: CoachThreadRow) => Promise<Result<CoachThreadRow>>
  remove: (id: string) => Promise<Result<void>>
  clear: () => Promise<Result<void>>
}

export function createCoachThreadsRepository(db: ChessKingDb): CoachThreadsRepository {
  return {
    list: async () => {
      const rows = await db.coachThreads.orderBy('updatedAt').reverse().toArray()
      return rows.flatMap((row) => {
        const parsed = CoachThreadRowSchema.safeParse(row)
        return parsed.success ? [parsed.data] : []
      })
    },

    save: (thread) =>
      writeValidated(CoachThreadRowSchema, thread, 'coachThreads.save', (validated) =>
        db.transaction('rw', db.coachThreads, async () => {
          await db.coachThreads.put(validated)
          const excess = (await db.coachThreads.count()) - MAX_STORED_THREADS
          if (excess > 0) {
            const oldest = await db.coachThreads.orderBy('updatedAt').limit(excess).primaryKeys()
            await db.coachThreads.bulkDelete(oldest)
          }
          return validated
        }),
      ),

    remove: async (id) => {
      const removed = await runWrite('coachThreads.remove', () => db.coachThreads.delete(id))
      return removed.ok ? ok(undefined) : removed
    },

    clear: () => runWrite('coachThreads.clear', () => db.coachThreads.clear()),
  }
}
