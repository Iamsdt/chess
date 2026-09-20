import { z } from 'zod'

import { ColorSchema } from './enums'
import { RepertoireNodeIdSchema, SrsCardIdSchema } from './ids'
import {
  EcoCodeSchema,
  FenSchema,
  PercentSchema,
  PlySchema,
  SanSchema,
  TimestampSchema,
  UciSchema,
} from './primitives'

/**
 * A repertoire, stored as flat nodes rather than a nested tree.
 *
 * Why flat: IndexedDB indexes rows, the editor needs to move a subtree without
 * rewriting its ancestors, and transposition detection is a lookup on
 * `positionKey` — all three are awkward on a nested document.
 */
export const RepertoireNodeSchema = z.object({
  id: RepertoireNodeIdSchema,
  /** `null` on the root of a repertoire; the root carries the opening's identity. */
  parentId: RepertoireNodeIdSchema.nullable(),
  /** Ordered: the first child is the main line unless `isMainLine` says otherwise. */
  childIds: z.array(RepertoireNodeIdSchema).default(() => []),
  /** Whose repertoire this belongs to, not whose move it is. */
  color: ColorSchema,
  fen: FenSchema,
  /**
   * The FEN's first four fields — placement, side, castling, en passant.
   *
   * Why: two different move orders reaching the same position must collide here,
   * which is exactly what transposition detection needs and what the move
   * counters would prevent.
   */
  positionKey: z.string().min(1),
  /** The move that led here; `null` on the root. */
  san: SanSchema.nullable(),
  uci: UciSchema.nullable(),
  ply: PlySchema,
  /** True when this is a move the user commits to, false for an opponent reply. */
  isYourMove: z.boolean(),
  isMainLine: z.boolean().default(false),
  eco: EcoCodeSchema.optional(),
  /** Set on the root, and on any node that names a variation. */
  openingName: z.string().optional(),
  variation: z.string().optional(),
  /** The author's note: what the plan is here. */
  comment: z.string().optional(),
  /**
   * How often opponents in the 1200–1600 band play this reply, 0–100. The drill
   * weights the opponent's choices by it.
   */
  popularity: PercentSchema.optional(),
  /** Style tags, e.g. `solid`, `sharp`, `pawn chains`. */
  tags: z.array(z.string()).default(() => []),
  /** Set once the line is being drilled through the shared SRS scheduler. */
  srsCardId: SrsCardIdSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})
export type RepertoireNode = z.infer<typeof RepertoireNodeSchema>

/** Why: the key must be derived identically everywhere or transpositions are missed. */
export function positionKeyFromFen(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ')
}
