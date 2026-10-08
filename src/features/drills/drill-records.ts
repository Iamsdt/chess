import { z } from 'zod'

import { defineKvKey, kvRepo, type KvRepository } from '@/data'
import { domainError, err, now, ok, TimestampSchema, type Result, type Timestamp } from '@/domain'

import type { DrillOutcome } from './endgame-session'

/**
 * What the drills remember: a best record and stars per endgame, a best score per
 * vision drill.
 *
 * Why the `kv` table and no table of its own: both are tiny, keyed documents that are
 * read whole and rewritten whole, which is exactly what `kv` is for. It also means
 * they travel in the backup for free and need no schema migration.
 */

/* --------------------------------------------------------------- endgames */

export const EndgameRecordSchema = z.object({
  attempts: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  /** Fewest player moves of any winning attempt; `null` until one succeeds. */
  bestMoves: z.number().int().positive().nullable(),
  /** Best star rating ever earned, 0 when never completed. */
  stars: z.number().int().min(0).max(3),
  lastPlayedAt: TimestampSchema.nullable(),
})
export type EndgameRecord = z.infer<typeof EndgameRecordSchema>

export const EndgameRecordsSchema = z.record(z.string(), EndgameRecordSchema)
export type EndgameRecords = z.infer<typeof EndgameRecordsSchema>

export const EMPTY_ENDGAME_RECORD: EndgameRecord = {
  attempts: 0,
  wins: 0,
  bestMoves: null,
  stars: 0,
  lastPlayedAt: null,
}

/** Fold one finished attempt into a drill's record. `playing` changes nothing. */
export function applyEndgameOutcome(
  record: EndgameRecord,
  outcome: DrillOutcome,
  at: Timestamp,
): EndgameRecord {
  if (outcome.kind === 'playing') return record
  const base = { ...record, attempts: record.attempts + 1, lastPlayedAt: at }
  if (outcome.kind === 'failed') return base
  return {
    ...base,
    wins: record.wins + 1,
    stars: Math.max(record.stars, outcome.stars),
    bestMoves:
      record.bestMoves === null ? outcome.moves : Math.min(record.bestMoves, outcome.moves),
  }
}

/** How many drills have the full three stars. */
export function masteredCount(records: EndgameRecords): number {
  return Object.values(records).filter((record) => record.stars === 3).length
}

/* ----------------------------------------------------------------- vision */

export const VISION_MODES = ['square', 'checks', 'knight', 'blindfold'] as const
export const VisionModeSchema = z.enum(VISION_MODES)
export type VisionMode = z.infer<typeof VisionModeSchema>

export const VisionRecordSchema = z.object({
  plays: z.number().int().nonnegative(),
  best: z.number().int().nonnegative(),
  lastScore: z.number().int().nonnegative(),
  lastPlayedAt: TimestampSchema.nullable(),
})
export type VisionRecord = z.infer<typeof VisionRecordSchema>

export const EMPTY_VISION_RECORD: VisionRecord = {
  plays: 0,
  best: 0,
  lastScore: 0,
  lastPlayedAt: null,
}

export const VisionRecordsSchema = z.object({
  square: VisionRecordSchema.default(EMPTY_VISION_RECORD),
  checks: VisionRecordSchema.default(EMPTY_VISION_RECORD),
  knight: VisionRecordSchema.default(EMPTY_VISION_RECORD),
  blindfold: VisionRecordSchema.default(EMPTY_VISION_RECORD),
})
export type VisionRecords = z.infer<typeof VisionRecordsSchema>

export function emptyVisionRecords(): VisionRecords {
  return {
    square: EMPTY_VISION_RECORD,
    checks: EMPTY_VISION_RECORD,
    knight: EMPTY_VISION_RECORD,
    blindfold: EMPTY_VISION_RECORD,
  }
}

export function applyVisionScore(record: VisionRecord, score: number, at: Timestamp): VisionRecord {
  return {
    plays: record.plays + 1,
    best: Math.max(record.best, score),
    lastScore: score,
    lastPlayedAt: at,
  }
}

/* ---------------------------------------------------------------- storage */

export const ENDGAME_RECORDS_KEY = defineKvKey('drills:endgames', EndgameRecordsSchema)
export const VISION_RECORDS_KEY = defineKvKey('drills:vision', VisionRecordsSchema)

/**
 * The drills' storage, as a port.
 *
 * Why a port: the screens must show a loading, an empty and an error state, and a test
 * can only reach the error state if the storage can be made to fail on demand.
 */
export interface DrillRecordsPort {
  readEndgames: () => Promise<Result<EndgameRecords>>
  /** Resolves to the whole updated table so the screen never has to re-read. */
  recordEndgame: (drillId: string, outcome: DrillOutcome) => Promise<Result<EndgameRecords>>
  readVision: () => Promise<Result<VisionRecords>>
  recordVision: (mode: VisionMode, score: number) => Promise<Result<VisionRecords>>
}

function failure(where: string, cause: unknown): Result<never> {
  const message = cause instanceof Error ? cause.message : 'The drill records could not be reached'
  return err(domainError('io', message, { where, cause }))
}

/** Reads of an unset or no-longer-valid row come back as "nothing yet", never as an error. */
export function createDrillRecordsPort(
  kv: KvRepository,
  clock: () => Timestamp = now,
): DrillRecordsPort {
  return {
    readEndgames: async () => {
      try {
        return ok(await kv.getOr(ENDGAME_RECORDS_KEY, {}))
      } catch (cause: unknown) {
        return failure('drills: read endgames', cause)
      }
    },

    recordEndgame: async (drillId, outcome) => {
      try {
        return await kv.update(ENDGAME_RECORDS_KEY, (current) => ({
          ...current,
          [drillId]: applyEndgameOutcome(
            current?.[drillId] ?? EMPTY_ENDGAME_RECORD,
            outcome,
            clock(),
          ),
        }))
      } catch (cause: unknown) {
        return failure('drills: record endgame', cause)
      }
    },

    readVision: async () => {
      try {
        return ok(await kv.getOr(VISION_RECORDS_KEY, emptyVisionRecords()))
      } catch (cause: unknown) {
        return failure('drills: read vision', cause)
      }
    },

    recordVision: async (mode, score) => {
      try {
        return await kv.update(VISION_RECORDS_KEY, (current) => {
          const records = current ?? emptyVisionRecords()
          return { ...records, [mode]: applyVisionScore(records[mode], score, clock()) }
        })
      } catch (cause: unknown) {
        return failure('drills: record vision', cause)
      }
    },
  }
}

export const defaultDrillRecords: DrillRecordsPort = createDrillRecordsPort(kvRepo)
