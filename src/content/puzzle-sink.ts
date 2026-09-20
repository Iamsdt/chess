import { z } from 'zod'

import {
  PUZZLE_BANDS,
  PuzzleBandSchema,
  TimestampSchema,
  now,
  ok,
  type Difficulty,
  type Puzzle,
  type PuzzleBand,
  type Result,
} from '@/domain'

/**
 * The storage port.
 *
 * Why `@/content` defines it and `@/data` implements it: the importer must not
 * know Dexie, and the repositories must not know CSV. This interface is the whole
 * contract between them — an idempotent bulk upsert, the import manifest, and the
 * counts the hub screens read. S05 satisfies it with a Dexie-backed adapter; the
 * two implementations in this folder keep the importer testable without one.
 */

/** The object store the Dexie schema must provide, named once so both sides agree. */
export const PUZZLE_STORE_NAME = 'puzzles'
/** `Puzzle.id`; the upsert is idempotent because the key is the puzzle's own id. */
export const PUZZLE_KEY_PATH = 'id'
/**
 * The indexes S14's selection queries need: band + sub-level walk the curriculum,
 * rating targets ~75% success, theme weights weak areas, difficulty filters chips.
 */
export const PUZZLE_INDEXES = ['band', 'subLevel', 'rating', 'theme', 'difficulty'] as const
export type PuzzleIndexName = (typeof PUZZLE_INDEXES)[number]
/** The store that holds the import state; one row, keyed by `PUZZLE_IMPORT_STATE_KEY`. */
export const CONTENT_META_STORE_NAME = 'contentMeta'
export const CONTENT_META_KEY_PATH = 'key'
export const PUZZLE_IMPORT_STATE_KEY = 'puzzleImportState'

/** What one band's import got to, and against which manifest version. */
export const ImportedBandStateSchema = z.object({
  band: PuzzleBandSchema,
  /** The manifest's version for this band when it was imported. */
  version: z.number().int().min(1),
  /** Data rows consumed, skipped ones included; a resume starts here. */
  rowsRead: z.number().int().min(0),
  puzzlesImported: z.number().int().min(0),
  skippedRows: z.number().int().min(0),
  /** False while a band is part-imported, so a resume knows to carry on. */
  complete: z.boolean(),
  updatedAt: TimestampSchema,
})
export type ImportedBandState = z.infer<typeof ImportedBandStateSchema>

/**
 * The whole import manifest, as stored.
 *
 * Why an array rather than a record keyed by band: a record has to be either
 * fully populated or partial, and both read badly under `exactOptionalPropertyTypes`
 * for a value that is genuinely "the bands we have got to so far".
 */
export const PuzzleImportStateSchema = z.object({
  /** Bumped only if this stored shape changes; unrelated to the content version. */
  stateVersion: z.literal(1),
  manifestVersion: z.number().int().min(1),
  bands: z.array(ImportedBandStateSchema),
  updatedAt: TimestampSchema,
})
export type PuzzleImportState = z.infer<typeof PuzzleImportStateSchema>

/** Why: the state is an array, and every caller wants one band out of it. */
export function findBandState(
  state: PuzzleImportState | null,
  band: PuzzleBand,
): ImportedBandState | null {
  return state?.bands.find((entry) => entry.band === band) ?? null
}

/** Why: replacing one band's entry in place is the only mutation the importer makes. */
export function withBandState(
  state: PuzzleImportState | null,
  manifestVersion: number,
  next: ImportedBandState,
): PuzzleImportState {
  const bands = (state?.bands ?? []).filter((entry) => entry.band !== next.band)
  bands.push(next)
  bands.sort((left, right) => PUZZLE_BANDS.indexOf(left.band) - PUZZLE_BANDS.indexOf(right.band))
  return { stateVersion: 1, manifestVersion, bands, updatedAt: next.updatedAt }
}

export interface PuzzleWriteSummary {
  /** Rows handed to the store. Upserts, so this is not "rows added". */
  readonly written: number
}

export interface PuzzleStoreStats {
  readonly total: number
  readonly byBand: Readonly<Record<PuzzleBand, number>>
  readonly byDifficulty: Readonly<Record<Difficulty, number>>
  /** Open-ended: 35 themes ship today and packs add more. */
  readonly byTheme: Readonly<Record<string, number>>
}

/**
 * The seam `@/data` implements.
 *
 * Every method returns a `Result` rather than throwing: a failed write mid-import
 * has to stop the band and be reported, not unwind the whole run.
 */
export interface PuzzleSink {
  /** Idempotent upsert keyed by `Puzzle.id`; re-importing must never duplicate. */
  putPuzzles(puzzles: readonly Puzzle[]): Promise<Result<PuzzleWriteSummary>>
  /** `null` before the first import. */
  readImportState(): Promise<Result<PuzzleImportState | null>>
  writeImportState(state: PuzzleImportState): Promise<Result<void>>
  stats(): Promise<Result<PuzzleStoreStats>>
}

/** Why: three stats shapes have to start from zero-filled buckets, not `{}`. */
export function emptyStats(): PuzzleStoreStats {
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
  return { total: 0, byBand, byDifficulty, byTheme: {} }
}

/**
 * A `PuzzleSink` backed by a `Map`.
 *
 * Why it ships rather than living in a test file: the CLI validator and the
 * `/dev` tooling both need somewhere to put 10,000 puzzles that is not the user's
 * database, and a second implementation keeps the port honest.
 */
export function createInMemoryPuzzleSink(): PuzzleSink & { readonly puzzles: Map<string, Puzzle> } {
  const puzzles = new Map<string, Puzzle>()
  let state: PuzzleImportState | null = null

  return {
    puzzles,
    putPuzzles(incoming) {
      for (const puzzle of incoming) puzzles.set(puzzle.id, puzzle)
      return Promise.resolve(ok({ written: incoming.length }))
    },
    readImportState() {
      return Promise.resolve(ok(state))
    },
    writeImportState(next) {
      state = { ...next, updatedAt: next.updatedAt === 0 ? now() : next.updatedAt }
      return Promise.resolve(ok(undefined))
    },
    stats() {
      const stats = emptyStats()
      const byBand = { ...stats.byBand }
      const byDifficulty = { ...stats.byDifficulty }
      const byTheme: Record<string, number> = {}
      for (const puzzle of puzzles.values()) {
        byBand[puzzle.band] += 1
        byDifficulty[puzzle.difficulty] += 1
        byTheme[puzzle.theme] = (byTheme[puzzle.theme] ?? 0) + 1
      }
      return Promise.resolve(ok({ total: puzzles.size, byBand, byDifficulty, byTheme }))
    },
  }
}
