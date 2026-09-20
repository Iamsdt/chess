import { z } from 'zod'

import {
  DurationMsSchema,
  EngineLaneSchema,
  EngineLineSchema,
  EngineScoreSchema,
  FenSchema,
  UciSchema,
} from '@/domain'

import { ENGINE_BUILD_IDS } from './capabilities'

/**
 * The contract between the main thread and an engine worker.
 *
 * Why zod and not just TypeScript: a worker message arrives as `unknown`. Comlink
 * gives it a convenient shape but no guarantee — a stale worker from a previous
 * deploy, a half-parsed UCI line or a bug in the worker can all put nonsense on
 * the wire. §5 says every worker message is validated before it is trusted, so
 * both ends parse with these schemas and neither end trusts the other's types.
 */

export const EngineInitConfigSchema = z.object({
  build: z.enum(ENGINE_BUILD_IDS),
  /** Absolute URL of the Stockfish loader; the `.wasm` sits beside it. */
  scriptUrl: z.string().min(1),
  threads: z.number().int().min(1).max(32),
  hashMb: z.number().int().min(1).max(4096),
  /**
   * How often the worker is allowed to post a snapshot to the main thread. The
   * engine emits `info` lines faster than any UI can use them; coalescing here is
   * what keeps the main thread idle during a deep search.
   */
  updateIntervalMs: z.number().int().min(0).max(1000),
})
export type EngineInitConfig = z.infer<typeof EngineInitConfigSchema>

/** Stockfish 19 refuses `UCI_Elo` outside this range; below it we use Skill Level. */
export const MIN_UCI_ELO = 1320
export const MAX_UCI_ELO = 3190
/** The weakest play we offer, mapped onto Skill Level 0. */
export const MIN_STRENGTH_ELO = 600

export const EngineStrengthSchema = z.object({
  /** `null` means full strength: no limiter, no skill handicap. */
  elo: z.number().int().min(MIN_STRENGTH_ELO).max(MAX_UCI_ELO).nullable(),
})
export type EngineStrength = z.infer<typeof EngineStrengthSchema>

export const SearchRequestSchema = z.object({
  id: z.string().min(1),
  fen: FenSchema,
  lane: EngineLaneSchema,
  multiPv: z.number().int().min(1).max(10),
  /** At least one of `depth`, `movetimeMs` and `nodes` must be set. */
  depth: z.number().int().min(1).max(60).optional(),
  movetimeMs: DurationMsSchema.max(600_000).optional(),
  nodes: z.number().int().min(1).optional(),
  strength: EngineStrengthSchema,
  showWdl: z.boolean(),
})
export type SearchRequest = z.infer<typeof SearchRequestSchema>

/** A snapshot of the search so far: the current lines, best first. */
export const SearchUpdateSchema = z.object({
  id: z.string().min(1),
  depth: z.number().int().min(0),
  lines: z.array(EngineLineSchema),
  nodes: z.number().int().min(0).optional(),
  nps: z.number().int().min(0).optional(),
  timeMs: DurationMsSchema.optional(),
})
export type SearchUpdate = z.infer<typeof SearchUpdateSchema>

export const SearchResultSchema = SearchUpdateSchema.extend({
  /** `null` when the position is already finished (`bestmove (none)`). */
  bestMove: UciSchema.nullable(),
  ponder: UciSchema.nullable(),
  /**
   * Line 1's score, or — in a checkmated or stalemated position, where the engine
   * reports `score mate 0` with no PV at all — the bare score it did report.
   * `null` only if the engine gave no score whatsoever.
   */
  score: EngineScoreSchema.nullable(),
  /** `true` when the search ended on a `stop` rather than on its own limit. */
  stoppedEarly: z.boolean(),
})
export type SearchResult = z.infer<typeof SearchResultSchema>

/** Why a request needs at least one limit: `go` with none searches forever. */
export function hasSearchLimit(request: SearchRequest): boolean {
  return (
    request.depth !== undefined || request.movetimeMs !== undefined || request.nodes !== undefined
  )
}
