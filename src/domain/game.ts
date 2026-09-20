import { z } from 'zod'

import { EngineScoreSchema } from './engine'
import {
  ColorSchema,
  EnginePersonalitySchema,
  GameResultSchema,
  GameSourceSchema,
  GameTerminationSchema,
  MoveQualitySchema,
  PieceTypeSchema,
  PlayerKindSchema,
  PromotionPieceSchema,
  ReviewStateSchema,
} from './enums'
import { GameIdSchema } from './ids'
import {
  DurationMsSchema,
  EcoCodeSchema,
  FenSchema,
  PercentSchema,
  PlySchema,
  RatingSchema,
  SanSchema,
  TimestampSchema,
  UciSchema,
} from './primitives'

/**
 * Games, their moves and everything the review screen shows.
 *
 * Why `GameMeta` is separate from `Game`: the library lists hundreds of rows and
 * must never load hundreds of move arrays, and the persistence layer stores the
 * two in different tables for exactly that reason.
 */

/** Time control, as a union so "untimed" cannot carry an increment. */
export const TimeControlSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('untimed') }),
  z.object({
    kind: z.literal('increment'),
    initialMs: DurationMsSchema,
    incrementMs: DurationMsSchema,
  }),
  z.object({ kind: z.literal('correspondence'), daysPerMove: z.number().int().min(1) }),
])
export type TimeControl = z.infer<typeof TimeControlSchema>

/** One side of a game. `engineLevel` is the rating the opponent was calibrated to. */
export const PlayerRefSchema = z.object({
  kind: PlayerKindSchema,
  name: z.string().min(1),
  rating: RatingSchema.optional(),
  engineLevel: RatingSchema.optional(),
  personality: EnginePersonalitySchema.optional(),
})
export type PlayerRef = z.infer<typeof PlayerRefSchema>

/** The opening a game landed in, once `@/chess` has matched it against the ECO table. */
export const OpeningRefSchema = z.object({
  eco: EcoCodeSchema.optional(),
  name: z.string().min(1),
  variation: z.string().optional(),
  /** The first ply that left book; the review screen prints "book until move N". */
  bookExitPly: PlySchema.optional(),
})
export type OpeningRef = z.infer<typeof OpeningRefSchema>

/**
 * Per-quality move counts for one side — the review Summary table.
 *
 * Why a full record rather than a partial one: a missing key and a zero read the
 * same in a template, and only one of them is honest.
 */
export const MoveQualityCountsSchema = z.record(MoveQualitySchema, z.number().int().min(0))
export type MoveQualityCounts = z.infer<typeof MoveQualityCountsSchema>

/** Why: building the zero-filled record by hand at each call site invites a typo. */
export function emptyMoveQualityCounts(): MoveQualityCounts {
  return {
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    miss: 0,
    blunder: 0,
  }
}

/**
 * One half-move, plus whatever the review has learned about it.
 *
 * The analysis fields are optional because a game exists long before it is
 * reviewed, and a resumable review fills them in ply by ply.
 */
export const MoveRecordSchema = z.object({
  gameId: GameIdSchema,
  /** 0-based half-move index; `(gameId, ply)` is the storage key. */
  ply: PlySchema,
  /** 1-based full-move number, as printed in the move list. */
  moveNumber: z.number().int().min(1),
  color: ColorSchema,
  san: SanSchema,
  uci: UciSchema,
  fenBefore: FenSchema,
  fenAfter: FenSchema,
  captured: PieceTypeSchema.optional(),
  promotion: PromotionPieceSchema.optional(),
  isCheck: z.boolean().default(false),
  isCheckmate: z.boolean().default(false),
  /** Clock remaining for the mover after the move, when the game was timed. */
  clockMs: DurationMsSchema.optional(),
  timeSpentMs: DurationMsSchema.optional(),
  /** Taken-back moves stay in the record; the review shows them rather than hiding them. */
  wasTakenBack: z.boolean().default(false),

  evalBefore: EngineScoreSchema.optional(),
  evalAfter: EngineScoreSchema.optional(),
  quality: MoveQualitySchema.optional(),
  /** What the engine preferred, when it differed. */
  bestMove: UciSchema.optional(),
  bestMoveSan: SanSchema.optional(),
  bestLine: z.array(UciSchema).optional(),
  /** Plain-language reason, generated from engine plus rules — never from an LLM. */
  explanation: z.string().optional(),
  /** True while the position is still in the bundled opening book. */
  isBook: z.boolean().default(false),
  nag: z.number().int().min(0).max(255).optional(),
  comment: z.string().optional(),
})
export type MoveRecord = z.infer<typeof MoveRecordSchema>

/** A game's header row: everything the library table and review header need. */
export const GameMetaSchema = z.object({
  id: GameIdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  startedAt: TimestampSchema,
  endedAt: TimestampSchema.optional(),
  source: GameSourceSchema,
  /** Provider id of an imported game; the import dedupes on it. */
  externalId: z.string().optional(),
  externalUrl: z.url().optional(),
  white: PlayerRefSchema,
  black: PlayerRefSchema,
  /** Which side the user played. Every "you" label on every screen reads this. */
  youPlay: ColorSchema,
  result: GameResultSchema,
  termination: GameTerminationSchema,
  timeControl: TimeControlSchema,
  /** Non-standard starting positions come from lessons, puzzles and pasted FENs. */
  initialFen: FenSchema,
  finalFen: FenSchema,
  plyCount: PlySchema,
  opening: OpeningRefSchema.optional(),
  reviewState: ReviewStateSchema.default('not-reviewed'),
  /** Per-side accuracy percentage, once the review has run. */
  accuracy: z.object({ white: PercentSchema, black: PercentSchema }).optional(),
  qualityCounts: z
    .object({ white: MoveQualityCountsSchema, black: MoveQualityCountsSchema })
    .optional(),
  /** How many positions this game contributed to the Mistake Bank. */
  mistakeCount: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default(() => []),
})
export type GameMeta = z.infer<typeof GameMetaSchema>

/** A game with its moves loaded — what the review and analysis screens work on. */
export const GameSchema = z.object({
  meta: GameMetaSchema,
  /** Ordered by `ply`, starting at 0. */
  moves: z.array(MoveRecordSchema),
  /** Serialized PGN, kept for export and for re-import fidelity. */
  pgn: z.string().optional(),
})
export type Game = z.infer<typeof GameSchema>
