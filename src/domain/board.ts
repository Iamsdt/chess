import { z } from 'zod'

import { MoveQualitySchema } from './enums'
import { SquareSchema } from './primitives'

/**
 * What can be drawn on top of a position.
 *
 * Why it lives in the domain rather than in `@/board`: lessons, the coach, the
 * review screen and share links all describe overlays as *data*, and they must
 * all describe them the same way for the board to render them.
 */

/**
 * Arrow intent, matching the prototype's three arrow styles: the engine's best
 * move, the opponent's threat, and something Sage is pointing at.
 */
export const ARROW_KINDS = ['best', 'threat', 'sage'] as const
export const ArrowKindSchema = z.enum(ARROW_KINDS)
export type ArrowKind = z.infer<typeof ArrowKindSchema>

export const ArrowSchema = z.object({
  from: SquareSchema,
  to: SquareSchema,
  kind: ArrowKindSchema,
})
export type Arrow = z.infer<typeof ArrowSchema>

/** A move-quality badge pinned to a square, as the review board shows. */
export const BoardMarkSchema = z.object({
  square: SquareSchema,
  quality: MoveQualitySchema,
})
export type BoardMark = z.infer<typeof BoardMarkSchema>

/** The complete overlay set a screen hands to `<Board>`. */
export const BoardShapesSchema = z.object({
  /** Tinted `from`/`to` squares of the last move. */
  highlight: z.array(SquareSchema).default(() => []),
  /** Circled squares a lesson or hint wants the eye drawn to. */
  focus: z.array(SquareSchema).default(() => []),
  /** The king square to flag as in check. */
  check: SquareSchema.nullable().default(null),
  arrows: z.array(ArrowSchema).default(() => []),
  marks: z.array(BoardMarkSchema).default(() => []),
})
export type BoardShapes = z.infer<typeof BoardShapesSchema>

/**
 * Why a factory rather than a shared constant: the arrays are mutable, and a
 * shared "empty" object would let one screen's overlay leak into another's.
 */
export const emptyBoardShapes = (): BoardShapes => ({
  highlight: [],
  focus: [],
  check: null,
  arrows: [],
  marks: [],
})
