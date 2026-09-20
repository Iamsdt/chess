import {
  PuzzleSchema,
  type Result,
  type Difficulty,
  type PackId,
  type Puzzle,
  type PuzzleBand,
  type PuzzleId,
} from '@/domain'

import { runWrite, validateMany } from '../internal'

import type { ChessKingDb } from '../db'
import type { Collection } from 'dexie'

/**
 * The 10,000 imported puzzles.
 *
 * Why `active` is filtered in memory rather than indexed: IndexedDB has no
 * boolean key type, so an index on it would silently hold nothing. Every query
 * below narrows on an indexed range first and only then drops inactive rows, so
 * the predicate runs over tens of rows rather than thousands.
 */

/** The selection knobs S14 turns: band curriculum, rating window, theme weighting. */
export interface PuzzleSelection {
  band?: PuzzleBand | undefined
  /** 1–10 within the band. Only meaningful together with `band`. */
  subLevel?: number | undefined
  minRating?: number | undefined
  maxRating?: number | undefined
  theme?: string | undefined
  difficulty?: Difficulty | undefined
  /** Puzzles already solved or already queued this session. */
  excludeIds?: readonly PuzzleId[] | undefined
  /** Default false: an inactive puzzle stays importable but is never selected. */
  includeInactive?: boolean | undefined
  limit?: number | undefined
}

export interface PuzzleStats {
  total: number
  byBand: Record<PuzzleBand, number>
  byDifficulty: Record<Difficulty, number>
  /** `null` when the table is empty, so callers do not divide by an absent range. */
  ratingRange: { min: number; max: number } | null
}

const MAX_RATING = 4000

function chooseCollection(
  db: ChessKingDb,
  selection: PuzzleSelection,
): Collection<Puzzle, PuzzleId> {
  const low = selection.minRating ?? 0
  const high = selection.maxRating ?? MAX_RATING
  if (selection.band !== undefined && selection.subLevel !== undefined) {
    return db.puzzles
      .where('[band+subLevel+rating]')
      .between(
        [selection.band, selection.subLevel, low],
        [selection.band, selection.subLevel, high],
        true,
        true,
      )
  }
  if (selection.band !== undefined) {
    return db.puzzles
      .where('[band+rating]')
      .between([selection.band, low], [selection.band, high], true, true)
  }
  if (selection.theme !== undefined) {
    return db.puzzles
      .where('[theme+rating]')
      .between([selection.theme, low], [selection.theme, high], true, true)
  }
  if (selection.difficulty !== undefined) {
    return db.puzzles
      .where('[difficulty+rating]')
      .between([selection.difficulty, low], [selection.difficulty, high], true, true)
  }
  return db.puzzles.where('rating').between(low, high, true, true)
}

function predicate(selection: PuzzleSelection): (puzzle: Puzzle) => boolean {
  const excluded = new Set<string>(selection.excludeIds ?? [])
  return (puzzle) => {
    if (selection.includeInactive !== true && !puzzle.active) return false
    if (excluded.has(puzzle.id)) return false
    if (selection.subLevel !== undefined && puzzle.subLevel !== selection.subLevel) return false
    if (selection.theme !== undefined && puzzle.theme !== selection.theme) return false
    if (selection.difficulty !== undefined && puzzle.difficulty !== selection.difficulty) {
      return false
    }
    if (selection.band !== undefined && puzzle.band !== selection.band) return false
    return true
  }
}

export interface PuzzlesRepository {
  get: (id: PuzzleId) => Promise<Puzzle | undefined>
  getMany: (ids: readonly PuzzleId[]) => Promise<Puzzle[]>
  /** The candidate pool S14 draws from, ordered by rating. */
  select: (selection?: PuzzleSelection) => Promise<Puzzle[]>
  count: (selection?: PuzzleSelection) => Promise<number>
  /**
   * The nth puzzle in id order.
   *
   * Why it exists: the daily puzzle has to be the same for a given date on every
   * device, which means indexing into a stable ordering rather than sampling.
   */
  getByIndex: (index: number) => Promise<Puzzle | undefined>
  /** Distinct themes with their counts — the theme-mastery chips and the radar. */
  listThemes: () => Promise<{ theme: string; count: number }[]>
  stats: () => Promise<PuzzleStats>
  /**
   * Idempotent bulk upsert: re-importing a band updates its rows and never
   * duplicates them. S10 calls this once per band, with progress in between.
   */
  bulkUpsert: (
    puzzles: readonly unknown[],
  ) => Promise<Result<{ inserted: number; updated: number }>>
  removeByPack: (packId: PackId) => Promise<Result<number>>
  clear: () => Promise<Result<void>>
}

export function createPuzzlesRepository(db: ChessKingDb): PuzzlesRepository {
  async function select(selection: PuzzleSelection = {}): Promise<Puzzle[]> {
    const collection = chooseCollection(db, selection).filter(predicate(selection))
    const limited = selection.limit === undefined ? collection : collection.limit(selection.limit)
    return limited.toArray()
  }

  return {
    get: (id) => db.puzzles.get(id),

    getMany: async (ids) => {
      const rows = await db.puzzles.bulkGet([...ids])
      return rows.filter((row): row is Puzzle => row !== undefined)
    },

    select,

    count: (selection = {}) => chooseCollection(db, selection).filter(predicate(selection)).count(),

    getByIndex: (index) => db.puzzles.orderBy('id').offset(index).first(),

    listThemes: async () => {
      const keys = await db.puzzles.orderBy('theme').uniqueKeys()
      const themes = keys.filter((key): key is string => typeof key === 'string')
      const counted = await Promise.all(
        themes.map(async (theme) => ({
          theme,
          count: await db.puzzles.where('theme').equals(theme).count(),
        })),
      )
      return counted.sort((left, right) => right.count - left.count)
    },

    stats: async () => {
      const byBand: Record<PuzzleBand, number> = {
        pawn: 0,
        knight: 0,
        bishop: 0,
        rook: 0,
        queen: 0,
        king: 0,
      }
      const byDifficulty: Record<Difficulty, number> = {
        beginner: 0,
        intermediate: 0,
        advanced: 0,
      }
      let total = 0
      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      await db.puzzles.each((puzzle) => {
        total += 1
        byBand[puzzle.band] += 1
        byDifficulty[puzzle.difficulty] += 1
        if (puzzle.rating < min) min = puzzle.rating
        if (puzzle.rating > max) max = puzzle.rating
      })
      return { total, byBand, byDifficulty, ratingRange: total === 0 ? null : { min, max } }
    },

    bulkUpsert: async (puzzles) => {
      const validated = validateMany(PuzzleSchema, puzzles, 'puzzles.bulkUpsert')
      if (!validated.ok) return validated
      const rows = validated.value
      return runWrite('puzzles.bulkUpsert', async () =>
        db.transaction('rw', db.puzzles, async () => {
          const existing = await db.puzzles.bulkGet(rows.map((row) => row.id))
          const updated = existing.filter((row) => row !== undefined).length
          await db.puzzles.bulkPut(rows)
          return { inserted: rows.length - updated, updated }
        }),
      )
    },

    removeByPack: (packId) =>
      runWrite('puzzles.removeByPack', () => db.puzzles.where('packId').equals(packId).delete()),

    clear: () => runWrite('puzzles.clear', () => db.puzzles.clear()),
  }
}
