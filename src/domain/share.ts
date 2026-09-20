import { z } from 'zod'

import { ColorSchema, GameResultSchema } from './enums'
import {
  EcoCodeSchema,
  FenSchema,
  PlySchema,
  RatingSchema,
  SanSchema,
  SquareSchema,
  TimestampSchema,
  UciSchema,
} from './primitives'

/**
 * What a share link carries.
 *
 * Why a discriminated union with a `v`: everything here is encoded into a URL
 * fragment and decoded on someone else's device, possibly months later and
 * possibly tampered with. The version lets an old link fail with a readable
 * message, and the union stops a decoder guessing what it is holding.
 */

/** Bumped on any incompatible change to the encoding. */
export const SHARE_PAYLOAD_VERSION = 1

/** Who sent the link. There are no accounts, so this is just a name they typed. */
export const ShareSenderSchema = z.object({
  name: z.string().min(1).max(40),
  rating: RatingSchema.optional(),
})
export type ShareSender = z.infer<typeof ShareSenderSchema>

const shareBase = {
  v: z.number().int().min(1),
  from: ShareSenderSchema.optional(),
  /** When the link was made; a stale correspondence link can say so. */
  at: TimestampSchema.optional(),
}

export const SharePositionSchema = z.object({
  ...shareBase,
  kind: z.literal('position'),
  fen: FenSchema,
  orientation: ColorSchema,
  highlight: z.array(SquareSchema).default(() => []),
  /** The question the sender is asking about the position. */
  note: z.string().max(280).optional(),
})
export type SharePosition = z.infer<typeof SharePositionSchema>

/** One puzzle inside a challenge; the position travels, not a database id. */
export const SharePuzzleSchema = z.object({
  fen: FenSchema,
  solution: z.array(UciSchema).min(1),
  theme: z.string().optional(),
  rating: RatingSchema.optional(),
})
export type SharePuzzle = z.infer<typeof SharePuzzleSchema>

export const SharePuzzleChallengeSchema = z.object({
  ...shareBase,
  kind: z.literal('puzzle-challenge'),
  puzzles: z.array(SharePuzzleSchema).min(1).max(20),
  /** The sender's time to beat, in seconds. */
  timeSeconds: z.number().int().min(0).optional(),
  /** Hide themes and ratings so the receiver solves blind. */
  hideTheme: z.boolean().default(false),
  message: z.string().max(280).optional(),
})
export type SharePuzzleChallenge = z.infer<typeof SharePuzzleChallengeSchema>

export const ShareAnnotationSchema = z.object({
  ply: PlySchema,
  san: SanSchema,
  comment: z.string().max(280),
  author: z.enum(['player', 'sage']),
})
export type ShareAnnotation = z.infer<typeof ShareAnnotationSchema>

export const ShareAnnotatedGameSchema = z.object({
  ...shareBase,
  kind: z.literal('annotated-game'),
  title: z.string().max(80).optional(),
  initialFen: FenSchema.optional(),
  /** The moves, in UCI because it packs smaller than SAN. */
  moves: z.array(UciSchema).min(1),
  result: GameResultSchema,
  eco: EcoCodeSchema.optional(),
  annotations: z.array(ShareAnnotationSchema).default(() => []),
})
export type ShareAnnotatedGame = z.infer<typeof ShareAnnotatedGameSchema>

export const ShareCorrespondenceMoveSchema = z.object({
  ...shareBase,
  kind: z.literal('correspondence-move'),
  /** Stable per game so both sides can tell a reply from a new invitation. */
  gameKey: z.string().min(1).max(32),
  initialFen: FenSchema.optional(),
  /** The whole game so far; the receiver needs no prior state. */
  moves: z.array(UciSchema).default(() => []),
  /** The colour the *sender* is playing. */
  senderColor: ColorSchema,
  lastMove: SanSchema.optional(),
  openingName: z.string().optional(),
})
export type ShareCorrespondenceMove = z.infer<typeof ShareCorrespondenceMoveSchema>

export const SharePayloadSchema = z.discriminatedUnion('kind', [
  SharePositionSchema,
  SharePuzzleChallengeSchema,
  ShareAnnotatedGameSchema,
  ShareCorrespondenceMoveSchema,
])
export type SharePayload = z.infer<typeof SharePayloadSchema>
