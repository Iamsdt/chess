import { z } from 'zod'

import { ArrowSchema, BoardMarkSchema } from './board'
import { ColorSchema, DifficultySchema, LessonStepKindSchema } from './enums'
import {
  LessonIdSchema,
  LessonStepIdSchema,
  PackIdSchema,
  TrackIdSchema,
  UnitIdSchema,
} from './ids'
import { FenSchema, SanSchema, SquareSchema } from './primitives'

/**
 * Lessons, as data.
 *
 * Why every step is declarative: the lesson player (S16) must be able to run all
 * 49 converted tutorials — and any community pack — with no lesson-specific code.
 * If a lesson needs behaviour the schema cannot express, the schema is wrong.
 */
export const LessonStepSchema = z.object({
  id: LessonStepIdSchema,
  /** 0-based position within the lesson; the step pips read this. */
  index: z.number().int().min(0),
  kind: LessonStepKindSchema,
  fen: FenSchema,
  orientation: ColorSchema,
  /** The instruction headline, e.g. `Fork the king and the rook.` */
  prompt: z.string().min(1),
  /** The paragraph under the headline. */
  text: z.string().optional(),
  /**
   * Moves that complete the step, in SAN because packs are hand-authored.
   * Empty for an `info` step.
   */
  expectedMoves: z.array(SanSchema).default(() => []),
  /** Accepted, but answered with `alternativeText` rather than full credit. */
  alternativeMoves: z.array(SanSchema).default(() => []),
  alternativeText: z.string().optional(),
  /** Circled squares that point the eye without giving the move away. */
  focusSquares: z.array(SquareSchema).default(() => []),
  arrows: z.array(ArrowSchema).default(() => []),
  marks: z.array(BoardMarkSchema).default(() => []),
  /** The hint ladder for this step, in order; at most three rungs. */
  hints: z
    .array(z.string().min(1))
    .max(3)
    .default(() => []),
  successText: z.string().optional(),
  failureText: z.string().optional(),
  /** The "key idea" card shown once the step is done. */
  keyIdea: z.string().optional(),
})
export type LessonStep = z.infer<typeof LessonStepSchema>

export const LessonSchema = z.object({
  id: LessonIdSchema,
  packId: PackIdSchema,
  trackId: TrackIdSchema.optional(),
  unitId: UnitIdSchema.optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  difficulty: DifficultySchema,
  /** What the course map prints as "about N minutes". */
  estimatedMinutes: z.number().int().min(1),
  /** Tactical/strategic themes, shared vocabulary with puzzles and mistakes. */
  themes: z.array(z.string()).default(() => []),
  /** Lessons that should be finished first; the course map locks on this. */
  prerequisites: z.array(LessonIdSchema).default(() => []),
  steps: z.array(LessonStepSchema).min(1),
  /** Bumped by the pack author; progress survives a content update. */
  version: z.number().int().min(1).default(1),
})
export type Lesson = z.infer<typeof LessonSchema>
