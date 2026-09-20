import {
  ContentPackSchema,
  type Result,
  type ContentPack,
  type ContentPackKind,
  type ContentPackSource,
  type Lesson,
  type LessonId,
  type PackId,
} from '@/domain'

import { runWrite, writeValidated } from '../internal'

import type { ChessKingDb } from '../db'

/**
 * Content packs, stored whole.
 *
 * Why the lessons stay inside their pack rather than getting a table: a lesson
 * has no life of its own — it is installed, updated and removed with its pack,
 * and the course map always renders a pack's worth at a time. Puzzles are the
 * opposite case and do get their own table, because 10,000 of them are selected
 * from by rating and theme.
 */
export interface PacksRepository {
  get: (id: PackId) => Promise<ContentPack | undefined>
  list: (kind?: ContentPackKind) => Promise<ContentPack[]>
  listBySource: (source: ContentPackSource) => Promise<ContentPack[]>
  count: () => Promise<number>
  /** Every lesson of every installed pack, in pack order. */
  listLessons: (kind?: ContentPackKind) => Promise<Lesson[]>
  /** The lesson player's entry point; scans packs, which number in the tens. */
  findLesson: (lessonId: LessonId) => Promise<Lesson | undefined>
  /** Idempotent: re-installing a pack replaces it rather than adding a second copy. */
  install: (pack: unknown) => Promise<Result<ContentPack>>
  remove: (id: PackId) => Promise<Result<void>>
  clear: () => Promise<Result<void>>
}

export function createPacksRepository(db: ChessKingDb): PacksRepository {
  async function list(kind?: ContentPackKind): Promise<ContentPack[]> {
    return kind === undefined ? db.packs.toArray() : db.packs.where('kind').equals(kind).toArray()
  }

  return {
    get: (id) => db.packs.get(id),

    list,

    listBySource: (source) => db.packs.where('source').equals(source).toArray(),

    count: () => db.packs.count(),

    listLessons: async (kind) => {
      const packs = await list(kind)
      return packs.flatMap((pack) => pack.lessons)
    },

    findLesson: async (lessonId) => {
      let found: Lesson | undefined
      await db.packs.each((pack) => {
        found ??= pack.lessons.find((lesson) => lesson.id === lessonId)
      })
      return found
    },

    install: (pack) =>
      writeValidated(ContentPackSchema, pack, 'packs.install', async (validated) => {
        await db.packs.put(validated)
        return validated
      }),

    remove: (id) =>
      runWrite('packs.remove', async () => {
        await db.packs.delete(id)
      }),

    clear: () => runWrite('packs.clear', () => db.packs.clear()),
  }
}
