import {
  err,
  MistakeEntrySchema,
  now,
  ok,
  parseValid,
  type Result,
  type GameId,
  type MistakeEntry,
  type MistakeId,
  type MistakeQuality,
  type MistakeSource,
  type SrsCardId,
  type Timestamp,
} from '@/domain'

import { notFound, runWrite, validateMany, writeValidated } from '../internal'

import type { ChessKingDb } from '../db'

/**
 * The Mistake Bank: positions the user got wrong, kept so they can be given back.
 *
 * The bank screen filters by source, by quality and by theme, so each of those
 * is an index; `*themes` is multi-entry because a position usually has two or
 * three and the chips are an OR.
 */

export interface MistakeFilter {
  source?: MistakeSource | undefined
  quality?: MistakeQuality | undefined
  theme?: string | undefined
  gameId?: GameId | undefined
  from?: Timestamp | undefined
  to?: Timestamp | undefined
  /** `true` keeps only mistakes already scheduled, `false` only unscheduled ones. */
  scheduled?: boolean | undefined
  limit?: number | undefined
}

const MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER

export interface MistakesRepository {
  get: (id: MistakeId) => Promise<MistakeEntry | undefined>
  /** Newest first. */
  list: (filter?: MistakeFilter) => Promise<MistakeEntry[]>
  count: (filter?: MistakeFilter) => Promise<number>
  listForGame: (gameId: GameId) => Promise<MistakeEntry[]>
  findByCard: (cardId: SrsCardId) => Promise<MistakeEntry | undefined>
  /** The skill radar: how many mistakes carry each theme. */
  countsByTheme: () => Promise<{ theme: string; count: number }[]>
  add: (entry: MistakeEntry) => Promise<Result<MistakeEntry>>
  /** S13 pushes a whole game's mistakes in at the end of a review. */
  addMany: (entries: readonly MistakeEntry[]) => Promise<Result<number>>
  update: (id: MistakeId, patch: Partial<MistakeEntry>) => Promise<Result<MistakeEntry>>
  /** Links a bank entry to the card the scheduler just made for it. */
  attachCard: (id: MistakeId, cardId: SrsCardId) => Promise<Result<MistakeEntry>>
  remove: (id: MistakeId) => Promise<Result<void>>
  removeForGame: (gameId: GameId) => Promise<Result<number>>
  clear: () => Promise<Result<void>>
}

function matches(entry: MistakeEntry, filter: MistakeFilter): boolean {
  if (filter.quality !== undefined && entry.quality !== filter.quality) return false
  if (filter.source !== undefined && entry.source !== filter.source) return false
  if (filter.theme !== undefined && !entry.themes.includes(filter.theme)) return false
  if (filter.gameId !== undefined && entry.gameId !== filter.gameId) return false
  if (filter.from !== undefined && entry.createdAt < filter.from) return false
  if (filter.to !== undefined && entry.createdAt > filter.to) return false
  if (filter.scheduled === true && entry.srsCardId === undefined) return false
  if (filter.scheduled === false && entry.srsCardId !== undefined) return false
  return true
}

export function createMistakesRepository(db: ChessKingDb): MistakesRepository {
  function baseCollection(filter: MistakeFilter) {
    const low = filter.from ?? 0
    const high = filter.to ?? MAX_TIMESTAMP
    if (filter.source !== undefined) {
      return db.mistakes
        .where('[source+createdAt]')
        .between([filter.source, low], [filter.source, high], true, true)
    }
    if (filter.quality !== undefined) {
      return db.mistakes
        .where('[quality+createdAt]')
        .between([filter.quality, low], [filter.quality, high], true, true)
    }
    if (filter.theme !== undefined) return db.mistakes.where('themes').equals(filter.theme)
    if (filter.gameId !== undefined) return db.mistakes.where('gameId').equals(filter.gameId)
    return db.mistakes.where('createdAt').between(low, high, true, true)
  }

  async function update(
    id: MistakeId,
    patch: Partial<MistakeEntry>,
  ): Promise<Result<MistakeEntry>> {
    const outcome = await runWrite('mistakes.update', () =>
      db.transaction('rw', db.mistakes, async (): Promise<Result<MistakeEntry>> => {
        const existing = await db.mistakes.get(id)
        if (existing === undefined) return err(notFound('mistakes.update', id))
        const parsed = parseValid(
          MistakeEntrySchema,
          { ...existing, ...patch, updatedAt: patch.updatedAt ?? now() },
          'mistakes.update',
        )
        if (!parsed.ok) return parsed
        await db.mistakes.put(parsed.value)
        return ok(parsed.value)
      }),
    )
    return outcome.ok ? outcome.value : outcome
  }

  return {
    get: (id) => db.mistakes.get(id),

    list: async (filter = {}) => {
      const rows = await baseCollection(filter)
        .filter((entry) => matches(entry, filter))
        .sortBy('createdAt')
      rows.reverse()
      return filter.limit === undefined ? rows : rows.slice(0, filter.limit)
    },

    count: (filter = {}) =>
      baseCollection(filter)
        .filter((entry) => matches(entry, filter))
        .count(),

    listForGame: (gameId) => db.mistakes.where('gameId').equals(gameId).sortBy('ply'),

    findByCard: (cardId) => db.mistakes.where('srsCardId').equals(cardId).first(),

    countsByTheme: async () => {
      const counts = new Map<string, number>()
      await db.mistakes.each((entry) => {
        for (const theme of entry.themes) counts.set(theme, (counts.get(theme) ?? 0) + 1)
      })
      return [...counts.entries()]
        .map(([theme, count]) => ({ theme, count }))
        .sort((left, right) => right.count - left.count)
    },

    add: (entry) =>
      writeValidated(MistakeEntrySchema, entry, 'mistakes.add', async (validated) => {
        await db.mistakes.put(validated)
        return validated
      }),

    addMany: async (entries) => {
      const validated = validateMany(MistakeEntrySchema, entries, 'mistakes.addMany')
      if (!validated.ok) return validated
      return runWrite('mistakes.addMany', async () => {
        await db.mistakes.bulkPut(validated.value)
        return validated.value.length
      })
    },

    update,

    attachCard: (id, cardId) => update(id, { srsCardId: cardId }),

    remove: (id) =>
      runWrite('mistakes.remove', async () => {
        await db.mistakes.delete(id)
      }),

    removeForGame: (gameId) =>
      runWrite('mistakes.removeForGame', () => db.mistakes.where('gameId').equals(gameId).delete()),

    clear: () => runWrite('mistakes.clear', () => db.mistakes.clear()),
  }
}
