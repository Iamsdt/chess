import { err, now, ok, parseValid, type Result, type LessonId, type PackId } from '@/domain'

import { notFound, runWrite, writeValidated } from '../internal'
import { LessonProgressSchema, type LessonProgress, type LessonProgressStatus } from '../schema'

import type { ChessKingDb } from '../db'

/**
 * How far the player has got through each lesson.
 *
 * Keyed by `lessonId` rather than by a surrogate id: there is one local user, so
 * a second row for the same lesson would always be a bug.
 */
export interface LessonsProgressRepository {
  get: (lessonId: LessonId) => Promise<LessonProgress | undefined>
  list: (packId?: PackId) => Promise<LessonProgress[]>
  listByStatus: (status: LessonProgressStatus, packId?: PackId) => Promise<LessonProgress[]>
  /** The course map's per-pack "N of M done". */
  countCompleted: (packId?: PackId) => Promise<number>
  /** "Resume where you left off" on the Today screen. */
  mostRecent: () => Promise<LessonProgress | undefined>
  put: (progress: LessonProgress) => Promise<Result<LessonProgress>>
  update: (lessonId: LessonId, patch: Partial<LessonProgress>) => Promise<Result<LessonProgress>>
  remove: (lessonId: LessonId) => Promise<Result<void>>
  clear: () => Promise<Result<void>>
}

export function createLessonsProgressRepository(db: ChessKingDb): LessonsProgressRepository {
  return {
    get: (lessonId) => db.lessonsProgress.get(lessonId),

    list: (packId) =>
      packId === undefined
        ? db.lessonsProgress.toArray()
        : db.lessonsProgress.where('packId').equals(packId).toArray(),

    listByStatus: (status, packId) =>
      packId === undefined
        ? db.lessonsProgress.where('status').equals(status).toArray()
        : db.lessonsProgress.where('[packId+status]').equals([packId, status]).toArray(),

    countCompleted: (packId) =>
      packId === undefined
        ? db.lessonsProgress.where('status').equals('completed').count()
        : db.lessonsProgress.where('[packId+status]').equals([packId, 'completed']).count(),

    mostRecent: () => db.lessonsProgress.orderBy('updatedAt').reverse().first(),

    put: (progress) =>
      writeValidated(LessonProgressSchema, progress, 'lessonsProgress.put', async (validated) => {
        await db.lessonsProgress.put(validated)
        return validated
      }),

    update: async (lessonId, patch) => {
      const outcome = await runWrite('lessonsProgress.update', () =>
        db.transaction('rw', db.lessonsProgress, async (): Promise<Result<LessonProgress>> => {
          const existing = await db.lessonsProgress.get(lessonId)
          if (existing === undefined) return err(notFound('lessonsProgress.update', lessonId))
          const parsed = parseValid(
            LessonProgressSchema,
            { ...existing, ...patch, updatedAt: patch.updatedAt ?? now() },
            'lessonsProgress.update',
          )
          if (!parsed.ok) return parsed
          await db.lessonsProgress.put(parsed.value)
          return ok(parsed.value)
        }),
      )
      return outcome.ok ? outcome.value : outcome
    },

    remove: (lessonId) =>
      runWrite('lessonsProgress.remove', async () => {
        await db.lessonsProgress.delete(lessonId)
      }),

    clear: () => runWrite('lessonsProgress.clear', () => db.lessonsProgress.clear()),
  }
}
