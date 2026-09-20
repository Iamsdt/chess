import { z } from 'zod'

import { ArrowSchema } from './board'
import { EngineLineSchema } from './engine'
import {
  CoachMessageStatusSchema,
  CoachProviderSchema,
  CoachRoleSchema,
  CoachToneSchema,
  ColorSchema,
} from './enums'
import { GameMetaSchema } from './game'
import { MessageIdSchema, PuzzleIdSchema, ThreadIdSchema } from './ids'
import {
  FenSchema,
  PlySchema,
  RatingSchema,
  SanSchema,
  SquareSchema,
  TimestampSchema,
} from './primitives'

/**
 * Sage: the messages and the context they are answered with.
 *
 * Why the UI shapes and the provider shapes are the same shapes: the chat panel
 * (S09) is built against a mock long before any provider exists (S21), and
 * nothing in the UI is allowed to know which provider is in use.
 */

/** A position card inside a bubble — the prototype's `chat-card`. */
export const CoachAttachmentSchema = z.object({
  kind: z.literal('position'),
  fen: FenSchema,
  orientation: ColorSchema,
  highlight: z.array(SquareSchema).default(() => []),
  focus: z.array(SquareSchema).default(() => []),
  arrows: z.array(ArrowSchema).default(() => []),
  caption: z.string().optional(),
  /** In-app route the card links to, e.g. an analysis board. */
  href: z.string().optional(),
})
export type CoachAttachment = z.infer<typeof CoachAttachmentSchema>

/** What a request/response pair cost, for the monthly usage meter. */
export const CoachUsageSchema = z.object({
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  /** Estimated from the provider's public prices; the UI must say "estimated". */
  estimatedCostUsd: z.number().min(0).optional(),
})
export type CoachUsage = z.infer<typeof CoachUsageSchema>

export const CoachMessageSchema = z.object({
  id: MessageIdSchema,
  threadId: ThreadIdSchema,
  role: CoachRoleSchema,
  /** Markdown subset: bold, lists and inline SAN. Grows while streaming. */
  text: z.string(),
  status: CoachMessageStatusSchema.default('complete'),
  createdAt: TimestampSchema,
  attachments: z.array(CoachAttachmentSchema).default(() => []),
  /** Tappable follow-ups the panel renders under the bubble. */
  quickReplies: z.array(z.string()).default(() => []),
  /** Present on a `sage` message once the provider answered. */
  provider: CoachProviderSchema.optional(),
  model: z.string().optional(),
  usage: CoachUsageSchema.optional(),
  /** Readable failure text for the retry state; never a raw provider dump. */
  error: z.string().optional(),
})
export type CoachMessage = z.infer<typeof CoachMessageSchema>

/** The position Sage is being asked about, if any. */
export const CoachPositionContextSchema = z.object({
  fen: FenSchema,
  orientation: ColorSchema,
  moveNumber: z.number().int().min(1).optional(),
  ply: PlySchema.optional(),
  lastMove: SanSchema.optional(),
})
export type CoachPositionContext = z.infer<typeof CoachPositionContextSchema>

/**
 * Everything the context builder is allowed to send.
 *
 * Why it is a schema and not an ad-hoc object: the spoiler guard and the token
 * budget are enforced against this shape, and a field smuggled in past it would
 * be a field nobody redacted.
 */
export const CoachContextSchema = z.object({
  /** Route id the question was asked from, e.g. `/puzzles/solve`. */
  screen: z.string().min(1),
  tone: CoachToneSchema,
  /** When true, Sage may nudge but must not give a solution away. */
  spoilerGuard: z.boolean(),
  allowEngineLines: z.boolean(),
  position: CoachPositionContextSchema.optional(),
  /** PGN of the game under discussion, already trimmed to the budget. */
  pgn: z.string().optional(),
  /** Only ever populated when `allowEngineLines` is true. */
  engineLines: z.array(EngineLineSchema).default(() => []),
  recentGames: z.array(GameMetaSchema).default(() => []),
  /** Theme names the user is weakest at, so answers can aim at them. */
  weakThemes: z.array(z.string()).default(() => []),
  /** Set on the solver and lesson screens; what the spoiler guard protects. */
  activePuzzle: z
    .object({ id: PuzzleIdSchema, theme: z.string(), rating: RatingSchema })
    .optional(),
  user: z
    .object({
      displayName: z.string(),
      puzzleRating: RatingSchema,
      sparringRating: RatingSchema,
    })
    .optional(),
  /** Hard ceiling the builder must stay under, in tokens. */
  tokenBudget: z.number().int().min(1),
})
export type CoachContext = z.infer<typeof CoachContextSchema>
