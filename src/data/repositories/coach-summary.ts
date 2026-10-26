import { now, ok, type Result } from '@/domain'

import { runWrite, writeValidated } from '../internal'
import { COACH_SUMMARY_ID, CoachSummarySchema, type CoachSummary } from '../schema'

import type { ChessKingDb } from '../db'

/** The Summary layer: one compact row about chats older than the one in front of the user. */
export interface CoachSummaryRepository {
  get: () => Promise<CoachSummary | undefined>
  set: (text: string) => Promise<Result<CoachSummary>>
  clear: () => Promise<Result<void>>
}

export function createCoachSummaryRepository(db: ChessKingDb): CoachSummaryRepository {
  return {
    get: async () => {
      const parsed = CoachSummarySchema.safeParse(await db.coachSummary.get(COACH_SUMMARY_ID))
      return parsed.success ? parsed.data : undefined
    },

    set: (text) =>
      writeValidated(
        CoachSummarySchema,
        { id: COACH_SUMMARY_ID, text, updatedAt: now() },
        'coachSummary.set',
        async (validated) => {
          await db.coachSummary.put(validated)
          return validated
        },
      ),

    clear: async () => {
      const cleared = await runWrite('coachSummary.clear', () => db.coachSummary.clear())
      return cleared.ok ? ok(undefined) : cleared
    },
  }
}
