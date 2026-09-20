import {
  err,
  now,
  ok,
  parseValid,
  SrsCardSchema,
  type Result,
  type LessonId,
  type MistakeId,
  type PuzzleId,
  type RepertoireNodeId,
  type SrsCard,
  type SrsCardId,
  type SrsState,
  type SrsSubject,
  type Timestamp,
} from '@/domain'

import { notFound, runWrite, validateMany, writeValidated } from '../internal'

import type { ChessKingDb } from '../db'
import type { IndexableType } from 'dexie'

/**
 * FSRS cards — one table, four subjects.
 *
 * The due queue is `[state+due]` and `[subject.kind+state+due]`: S15 asks for
 * "review cards due before now" and for "due mistakes only" when it interleaves,
 * and both are a single index range rather than a scan plus a sort.
 *
 * `subject` is a discriminated union, so the four id paths are indexed
 * separately. Only one is ever present on a row, and IndexedDB simply leaves the
 * row out of the other three indexes — which is exactly the lookup S15 wants.
 */

export interface DueQuery {
  /** Defaults to now. */
  at?: Timestamp | undefined
  kind?: SrsSubject['kind'] | undefined
  /** The daily cap. */
  limit?: number | undefined
  /** Default: everything but `mastered`, which has left the rotation. */
  states?: readonly SrsState[] | undefined
}

const ACTIVE_STATES: readonly SrsState[] = ['new', 'learning', 'review', 'relearning']

export interface SrsCardsRepository {
  get: (id: SrsCardId) => Promise<SrsCard | undefined>
  /** Due first, then by how long they have been waiting. */
  listDue: (query?: DueQuery) => Promise<SrsCard[]>
  countDue: (query?: DueQuery) => Promise<number>
  /** The bank screen's pipeline: how many cards sit in each state. */
  countsByState: () => Promise<Record<SrsState, number>>
  listByState: (state: SrsState, limit?: number) => Promise<SrsCard[]>
  /** Cards that graduated in a window — "cleared this week". */
  listMastered: (from: Timestamp, to: Timestamp) => Promise<SrsCard[]>
  /** "Is this mistake / puzzle / lesson / line already scheduled?" */
  findBySubject: (subject: SrsSubject) => Promise<SrsCard | undefined>
  put: (card: SrsCard) => Promise<Result<SrsCard>>
  putMany: (cards: readonly SrsCard[]) => Promise<Result<number>>
  /** Applies the scheduler's output; fails loudly if the card vanished. */
  update: (id: SrsCardId, patch: Partial<SrsCard>) => Promise<Result<SrsCard>>
  remove: (id: SrsCardId) => Promise<Result<void>>
  removeBySubject: (subject: SrsSubject) => Promise<Result<number>>
  clear: () => Promise<Result<void>>
}

/** Why: the subject's id lives under a different key per kind, and the index does too. */
function subjectIndex(subject: SrsSubject): {
  path: string
  value: MistakeId | PuzzleId | LessonId | RepertoireNodeId
} {
  switch (subject.kind) {
    case 'mistake':
      return { path: 'subject.mistakeId', value: subject.mistakeId }
    case 'puzzle':
      return { path: 'subject.puzzleId', value: subject.puzzleId }
    case 'lesson':
      return { path: 'subject.lessonId', value: subject.lessonId }
    case 'opening':
      return { path: 'subject.nodeId', value: subject.nodeId }
  }
}

export function createSrsCardsRepository(db: ChessKingDb): SrsCardsRepository {
  const INCLUSIVE = { includeLowers: true, includeUppers: true }

  function dueCollection(query: DueQuery) {
    const at = query.at ?? now()
    const states = query.states ?? ACTIVE_STATES
    // An empty state list is a legal question with an empty answer; `inAnyRange`
    // rejects an empty range list, so it never gets one.
    if (states.length === 0) return db.srsCards.where('state').anyOf([])
    const kind = query.kind
    if (kind !== undefined) {
      const ranges: [IndexableType, IndexableType][] = states.map((state) => [
        [kind, state, 0],
        [kind, state, at],
      ])
      return db.srsCards.where('[subject.kind+state+due]').inAnyRange(ranges, INCLUSIVE)
    }
    const ranges: [IndexableType, IndexableType][] = states.map((state) => [
      [state, 0],
      [state, at],
    ])
    return db.srsCards.where('[state+due]').inAnyRange(ranges, INCLUSIVE)
  }

  async function update(id: SrsCardId, patch: Partial<SrsCard>): Promise<Result<SrsCard>> {
    const outcome = await runWrite('srsCards.update', () =>
      db.transaction('rw', db.srsCards, async (): Promise<Result<SrsCard>> => {
        const existing = await db.srsCards.get(id)
        if (existing === undefined) return err(notFound('srsCards.update', id))
        const parsed = parseValid(
          SrsCardSchema,
          { ...existing, ...patch, updatedAt: patch.updatedAt ?? now() },
          'srsCards.update',
        )
        if (!parsed.ok) return parsed
        await db.srsCards.put(parsed.value)
        return ok(parsed.value)
      }),
    )
    return outcome.ok ? outcome.value : outcome
  }

  return {
    get: (id) => db.srsCards.get(id),

    listDue: async (query = {}) => {
      const rows = await dueCollection(query).sortBy('due')
      return query.limit === undefined ? rows : rows.slice(0, query.limit)
    },

    countDue: (query = {}) => dueCollection(query).count(),

    countsByState: async () => {
      const counts: Record<SrsState, number> = {
        new: 0,
        learning: 0,
        review: 0,
        relearning: 0,
        mastered: 0,
      }
      await db.srsCards.each((card) => {
        counts[card.state] += 1
      })
      return counts
    },

    listByState: (state, limit) => {
      const collection = db.srsCards.where('state').equals(state)
      return limit === undefined ? collection.toArray() : collection.limit(limit).toArray()
    },

    listMastered: (from, to) =>
      db.srsCards.where('masteredAt').between(from, to, true, true).toArray(),

    findBySubject: (subject) => {
      const { path, value } = subjectIndex(subject)
      return db.srsCards.where(path).equals(value).first()
    },

    put: (card) =>
      writeValidated(SrsCardSchema, card, 'srsCards.put', async (validated) => {
        await db.srsCards.put(validated)
        return validated
      }),

    putMany: async (cards) => {
      const validated = validateMany(SrsCardSchema, cards, 'srsCards.putMany')
      if (!validated.ok) return validated
      return runWrite('srsCards.putMany', async () => {
        await db.srsCards.bulkPut(validated.value)
        return validated.value.length
      })
    },

    update,

    remove: (id) =>
      runWrite('srsCards.remove', async () => {
        await db.srsCards.delete(id)
      }),

    removeBySubject: (subject) => {
      const { path, value } = subjectIndex(subject)
      return runWrite('srsCards.removeBySubject', () =>
        db.srsCards.where(path).equals(value).delete(),
      )
    },

    clear: () => runWrite('srsCards.clear', () => db.srsCards.clear()),
  }
}
