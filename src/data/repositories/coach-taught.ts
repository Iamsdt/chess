import { now, ok, parseValid, type CoachMode, type Result, type Timestamp } from '@/domain'

import { runWrite } from '../internal'
import { TaughtConceptSchema, type TaughtConcept } from '../schema'

import type { ChessKingDb } from '../db'

/**
 * The Taught layer: concepts Sage has covered, so it builds on them instead of repeating them.
 */
export interface NewTaughtConcept {
  readonly id: string
  readonly label: string
  readonly mode: CoachMode
}

export interface CoachTaughtRepository {
  /** Newest first. */
  list: (limit?: number) => Promise<TaughtConcept[]>
  /** First time creates the row; every later time bumps `count` and `lastTaughtAt`. */
  record: (concept: NewTaughtConcept, at?: Timestamp) => Promise<Result<TaughtConcept>>
  clear: () => Promise<Result<void>>
}

export function createCoachTaughtRepository(db: ChessKingDb): CoachTaughtRepository {
  return {
    list: async (limit = 50) => {
      const rows = await db.coachTaught.orderBy('lastTaughtAt').reverse().limit(limit).toArray()
      return rows.flatMap((row) => {
        const parsed = TaughtConceptSchema.safeParse(row)
        return parsed.success ? [parsed.data] : []
      })
    },

    record: async (concept, at = now()) => {
      const written = await runWrite('coachTaught.record', () =>
        db.transaction('rw', db.coachTaught, async (): Promise<Result<TaughtConcept>> => {
          const existing = await db.coachTaught.get(concept.id)
          const parsed = parseValid(
            TaughtConceptSchema,
            {
              ...concept,
              count: (existing?.count ?? 0) + 1,
              firstTaughtAt: existing?.firstTaughtAt ?? at,
              lastTaughtAt: at,
            },
            'coachTaught.record',
          )
          if (!parsed.ok) return parsed
          await db.coachTaught.put(parsed.value)
          return ok(parsed.value)
        }),
      )
      return written.ok ? written.value : written
    },

    clear: () => runWrite('coachTaught.clear', () => db.coachTaught.clear()),
  }
}
