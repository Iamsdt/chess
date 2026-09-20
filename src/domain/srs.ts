import { z } from 'zod'

import { EngineScoreSchema } from './engine'
import {
  ColorSchema,
  MistakeQualitySchema,
  MistakeSourceSchema,
  ReviewGradeSchema,
  SrsStateSchema,
} from './enums'
import {
  GameIdSchema,
  LessonIdSchema,
  MistakeIdSchema,
  PuzzleIdSchema,
  RepertoireNodeIdSchema,
  SrsCardIdSchema,
} from './ids'
import {
  DurationMsSchema,
  FenSchema,
  PlySchema,
  SanSchema,
  TimestampSchema,
  UciSchema,
} from './primitives'

/**
 * Spaced repetition and the Mistake Bank.
 *
 * Why one card type for four subjects: the plan reuses a single FSRS scheduler
 * for mistakes, puzzles, lessons and opening lines. A discriminated `subject`
 * keeps the scheduler subject-blind while the queue stays able to render a card.
 */
export const SrsSubjectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mistake'), mistakeId: MistakeIdSchema }),
  z.object({ kind: z.literal('puzzle'), puzzleId: PuzzleIdSchema }),
  z.object({ kind: z.literal('lesson'), lessonId: LessonIdSchema }),
  z.object({ kind: z.literal('opening'), nodeId: RepertoireNodeIdSchema }),
])
export type SrsSubject = z.infer<typeof SrsSubjectSchema>

/**
 * An FSRS-6 card.
 *
 * `stability` and `difficulty` are the model's own parameters and are written
 * only by the scheduler; everything else is bookkeeping the queue reads.
 */
export const SrsCardSchema = z.object({
  id: SrsCardIdSchema,
  subject: SrsSubjectSchema,
  state: SrsStateSchema,
  /** When this card next becomes due. The queue orders by this. */
  due: TimestampSchema,
  lastReviewedAt: TimestampSchema.nullable().default(null),
  /** FSRS memory stability, in days. */
  stability: z.number().min(0),
  /** FSRS difficulty, 1–10. */
  difficulty: z.number().min(1).max(10),
  /** Days between the previous review and the one that produced this state. */
  elapsedDays: z.number().min(0),
  /** The interval the scheduler granted, in days. */
  scheduledDays: z.number().min(0),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  /** Index into the learning/relearning steps; `null` outside those states. */
  learningStep: z.number().int().min(0).nullable().default(null),
  /** Three in a row promotes to `mastered`; the pipeline on the bank screen. */
  consecutiveCorrect: z.number().int().min(0).default(0),
  /** Set when the card leaves the rotation, so "cleared this week" is countable. */
  masteredAt: TimestampSchema.nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})
export type SrsCard = z.infer<typeof SrsCardSchema>

/**
 * The log line for one review.
 *
 * Why the before/after pairs: FSRS is replayable. Keeping both sides means a
 * parameter change can re-derive the whole schedule, and the golden-vector tests
 * can assert on the transition rather than the end state.
 */
export const ReviewOutcomeSchema = z.object({
  cardId: SrsCardIdSchema,
  reviewedAt: TimestampSchema,
  grade: ReviewGradeSchema,
  /** `again` is the only grade that counts as a failure. */
  correct: z.boolean(),
  durationMs: DurationMsSchema,
  stateBefore: SrsStateSchema,
  stateAfter: SrsStateSchema,
  stabilityBefore: z.number().min(0),
  stabilityAfter: z.number().min(0),
  difficultyBefore: z.number().min(1).max(10),
  difficultyAfter: z.number().min(1).max(10),
  dueBefore: TimestampSchema,
  dueAfter: TimestampSchema,
  scheduledDays: z.number().min(0),
})
export type ReviewOutcome = z.infer<typeof ReviewOutcomeSchema>

/**
 * A position the user got wrong, kept so it can be given back to them.
 *
 * Why the engine line is stored rather than recomputed: the bank must work
 * offline and instantly, and re-running Stockfish for a card the user is staring
 * at would defeat the point.
 */
export const MistakeEntrySchema = z.object({
  id: MistakeIdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  source: MistakeSourceSchema,
  /** Present when the mistake came out of a reviewed game. */
  gameId: GameIdSchema.optional(),
  ply: PlySchema.optional(),
  moveNumber: z.number().int().min(1).optional(),
  puzzleId: PuzzleIdSchema.optional(),
  lessonId: LessonIdSchema.optional(),
  /** The position as it stood before the move went wrong. */
  fen: FenSchema,
  /** The side the user was playing; also the board orientation for the card. */
  yourColor: ColorSchema,
  playedSan: SanSchema,
  playedUci: UciSchema,
  bestSan: SanSchema,
  bestUci: UciSchema,
  /** The full line to replay, so the card can be solved like a puzzle. */
  solution: z.array(UciSchema).min(1),
  quality: MistakeQualitySchema,
  evalBefore: EngineScoreSchema,
  evalAfter: EngineScoreSchema,
  /** Theme vocabulary shared with puzzles, so the filter chips are one set. */
  themes: z.array(z.string()).default(() => []),
  /** The "the idea you missed" text; calm, never shaming. */
  explanation: z.string().min(1),
  /** What the card prints as its origin, e.g. `vs Stockfish 1200`. */
  originLabel: z.string().optional(),
  srsCardId: SrsCardIdSchema.optional(),
})
export type MistakeEntry = z.infer<typeof MistakeEntrySchema>
