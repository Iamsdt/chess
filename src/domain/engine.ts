import { z } from 'zod'

import { EngineLaneSchema, type Color } from './enums'
import { DurationMsSchema, FenSchema, SanSchema, TimestampSchema, UciSchema } from './primitives'

/**
 * What the engine says about a position.
 *
 * Why a discriminated union for the score: a centipawn number and a mate distance
 * are not comparable, and flattening them into one signed integer ("mate = 30000")
 * is the classic source of nonsense eval bars. Callers must handle both.
 */
export const EngineScoreSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('cp'),
    /** Centipawns from the side-to-move's point of view. */
    value: z.number().int(),
  }),
  z.object({
    kind: z.literal('mate'),
    /** Full moves to mate; negative means the side to move is getting mated. */
    moves: z.number().int(),
  }),
])
export type EngineScore = z.infer<typeof EngineScoreSchema>

/** Win/draw/loss permilles, as Stockfish reports them when `UCI_ShowWDL` is on. */
export const WdlSchema = z.object({
  win: z.number().int().min(0).max(1000),
  draw: z.number().int().min(0).max(1000),
  loss: z.number().int().min(0).max(1000),
})
export type Wdl = z.infer<typeof WdlSchema>

/** One MultiPV line, as parsed from a single UCI `info` record. */
export const EngineLineSchema = z.object({
  /** 1-based; line 1 is the engine's current best. */
  multipv: z.number().int().min(1),
  depth: z.number().int().min(0),
  selDepth: z.number().int().min(0).optional(),
  score: EngineScoreSchema,
  /** The principal variation, longest first move to last. Never empty. */
  pv: z.array(UciSchema).min(1),
  /** Filled in by `@/chess` when a screen needs readable moves; the engine has none. */
  sanPv: z.array(SanSchema).optional(),
  nodes: z.number().int().min(0).optional(),
  nps: z.number().int().min(0).optional(),
  timeMs: DurationMsSchema.optional(),
  wdl: WdlSchema.optional(),
})
export type EngineLine = z.infer<typeof EngineLineSchema>

/** What the engine reports about itself, for the devtools panel and benchmarks. */
export const EngineInfoSchema = z.object({
  name: z.string().min(1),
  /** `true` when the cross-origin-isolated multi-threaded build loaded. */
  multiThreaded: z.boolean(),
  threads: z.number().int().min(1),
  hashMb: z.number().int().min(1),
})
export type EngineInfo = z.infer<typeof EngineInfoSchema>

/**
 * A completed evaluation of one position — the unit that gets cached, stored on a
 * move and handed to the coach.
 */
export const EngineEvalSchema = z.object({
  fen: FenSchema,
  /** The depth actually reached, which a cancelled search may undercut. */
  depth: z.number().int().min(0),
  /** Line 1's score, lifted out because almost every caller wants only this. */
  score: EngineScoreSchema,
  /** `null` when the position is already over. */
  bestMove: UciSchema.nullable(),
  ponder: UciSchema.nullable().default(null),
  /** Ordered by `multipv`; length equals the MultiPV that was requested. */
  lines: z.array(EngineLineSchema),
  nodes: z.number().int().min(0).optional(),
  nps: z.number().int().min(0).optional(),
  timeMs: DurationMsSchema.optional(),
  lane: EngineLaneSchema,
  engine: EngineInfoSchema.optional(),
  computedAt: TimestampSchema,
})
export type EngineEval = z.infer<typeof EngineEvalSchema>

/** Why: eval bars, graphs and classifiers all need one comparable number. */
export const MATE_SCORE_CP = 100_000

/**
 * Collapse a score to centipawns from White's point of view.
 *
 * Why here and not in `@/chess`: the eval graph, the coach context and the share
 * codec all need the same collapse, and they must agree to the last point.
 */
export function scoreToWhiteCentipawns(score: EngineScore, sideToMove: Color): number {
  const fromMover =
    score.kind === 'cp'
      ? score.value
      : score.moves >= 0
        ? MATE_SCORE_CP - score.moves
        : -MATE_SCORE_CP - score.moves
  return sideToMove === 'white' ? fromMover : -fromMover
}
