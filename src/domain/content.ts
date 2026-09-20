import { z } from 'zod'

import { ContentPackKindSchema, ContentPackSourceSchema } from './enums'
import { PackIdSchema } from './ids'
import { LessonSchema } from './lesson'
import { TimestampSchema } from './primitives'
import { PuzzleSchema } from './puzzle'

/**
 * A content pack: the unit of import, update and attribution.
 *
 * Why `formatVersion` is separate from `version`: the first says whether this app
 * can read the file at all, the second is the author's own content revision. A
 * pack whose format is too new must fail with a readable message, not a stack.
 */

/** Bumped only when the pack file layout changes incompatibly. */
export const CONTENT_PACK_FORMAT_VERSION = 1

export const ContentPackSchema = z.object({
  id: PackIdSchema,
  formatVersion: z.number().int().min(1),
  /** Author's revision, e.g. `2.3`. Free-form; only compared for inequality. */
  version: z.string().min(1),
  name: z.string().min(1),
  kind: ContentPackKindSchema,
  source: ContentPackSourceSchema,
  description: z.string().optional(),
  author: z.string().optional(),
  homepage: z.url().optional(),
  /** Licence text or SPDX id; shown in About and recorded in `docs/licences.md`. */
  licence: z.string().min(1),
  /** What the pack list prints as "N lessons"; validated against the arrays. */
  itemCount: z.number().int().min(0),
  lessons: z.array(LessonSchema).default(() => []),
  puzzles: z.array(PuzzleSchema).default(() => []),
  importedAt: TimestampSchema,
  updatedAt: TimestampSchema,
})
export type ContentPack = z.infer<typeof ContentPackSchema>

/** Why: a pack whose `itemCount` lies makes progress bars lie; catch it at import. */
export function contentPackItemCountMatches(pack: ContentPack): boolean {
  return pack.itemCount === pack.lessons.length + pack.puzzles.length
}
