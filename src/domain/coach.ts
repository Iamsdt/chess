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
export const CoachPositionAttachmentSchema = z.object({
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
export type CoachPositionAttachment = z.infer<typeof CoachPositionAttachmentSchema>

/**
 * Which voice and tool set Sage answers with (coach-agent.md §3). The screen picks one and
 * the user can override it.
 */
export const COACH_MODES = [
  'companion',
  'grandmaster',
  'teacher',
  'tutor',
  'puzzle-nudger',
  'planner',
  'open-qa',
  'visualization',
  'paused',
] as const
export const CoachModeSchema = z.enum(COACH_MODES)
export type CoachMode = z.infer<typeof CoachModeSchema>

/** How a Sage board draws its pieces (coach-agent.md §10.1). */
export const BOARD_VIEWS = ['normal', 'ghost', 'frozen', 'partial', 'blindfold', 'flash'] as const
export const BoardViewSchema = z.enum(BOARD_VIEWS)
export type BoardView = z.infer<typeof BoardViewSchema>

/** An evaluation from the engine, white-centred. Exactly one of the two is set. */
export const CoachEvalSchema = z.object({
  cp: z.number().int().optional(),
  mate: z.number().int().optional(),
})
export type CoachEval = z.infer<typeof CoachEvalSchema>

/**
 * One step of a demonstration on Sage's own board (coach-agent.md §11).
 *
 * Why steps carry SAN and not positions: the dialog replays them through the rules, so a
 * step that is not legal from the one before it fails loudly instead of drawing nonsense.
 */
export const SageBoardStepSchema = z.object({
  /** Played from the previous step's position; absent on a step that only annotates. */
  san: SanSchema.optional(),
  /** One short line, never a paragraph. */
  caption: z.string().min(1),
  arrows: z.array(ArrowSchema).default(() => []),
  focus: z.array(SquareSchema).default(() => []),
  /** Painted in the warning colour: the piece left hanging, the square a fork lands on. */
  danger: z.array(SquareSchema).default(() => []),
  /** Shade the squares each side attacks and defends (`showControlMap`). */
  controlMap: z.boolean().default(false),
  eval: CoachEvalSchema.optional(),
  /** Hands the move to the user: the dialog waits until they play one of `accept`. */
  yourTurn: z
    .object({
      prompt: z.string().min(1),
      accept: z.array(SanSchema).min(1),
      praise: z.string().min(1),
      retry: z.string().min(1),
    })
    .optional(),
})
export type SageBoardStep = z.infer<typeof SageBoardStepSchema>

export const SAGE_BOARD_CARDS = ['what-if', 'threat', 'idea', 'line', 'compare'] as const
export const SageBoardCardSchema = z.enum(SAGE_BOARD_CARDS)
export type SageBoardCard = z.infer<typeof SageBoardCardSchema>

/** A board card: opens Sage's own board in a dialog. Never touches the user's board. */
export const SageBoardAttachmentSchema = z.object({
  kind: z.literal('board'),
  card: SageBoardCardSchema,
  title: z.string().min(1),
  fen: FenSchema,
  orientation: ColorSchema,
  view: BoardViewSchema.default('normal'),
  steps: z.array(SageBoardStepSchema).min(1),
  /** Compare cards only: the second candidate, played from the same `fen`. */
  versus: z
    .object({ title: z.string().min(1), steps: z.array(SageBoardStepSchema).min(1) })
    .optional(),
})
export type SageBoardAttachment = z.infer<typeof SageBoardAttachmentSchema>

export const CALC_TAGS = [
  'best',
  'good',
  'tempting',
  'mistake',
  'blunder',
  'only-move',
  'forced',
] as const
export const CalcTagSchema = z.enum(CALC_TAGS)
export type CalcTag = z.infer<typeof CalcTagSchema>

/** One node of a calculation tree (coach-agent.md §9.1), stored as a flat id map. */
export const CalcNodeSchema = z.object({
  id: z.string().min(1),
  /** `null` for a root candidate. */
  parentId: z.string().min(1).nullable(),
  san: SanSchema,
  eval: CoachEvalSchema,
  tag: CalcTagSchema,
  /** Set on a root candidate: the 2–4 word branch name from the narrator. */
  branchName: z.string().optional(),
  /** Set on a root candidate: what the move is trying to do, in one sentence. */
  idea: z.string().optional(),
  /** Set on a leaf: why the branch stopped. */
  stop: z.enum(['quiet', 'mate', 'depth']).optional(),
})
export type CalcNode = z.infer<typeof CalcNodeSchema>

export const CalculationAttachmentSchema = z.object({
  kind: z.literal('calculation'),
  title: z.string().min(1),
  fen: FenSchema,
  orientation: ColorSchema,
  nodes: z.array(CalcNodeSchema).min(1),
  takeaway: z.string().optional(),
})
export type CalculationAttachment = z.infer<typeof CalculationAttachmentSchema>

export const VISUALIZATION_EXERCISES = [
  'follow-line',
  'whats-hanging',
  'is-it-check',
  'flash-recall',
  'blind-checks',
  'blind-route',
  'count-exchange',
  'pick-picture',
] as const
export const VisualizationExerciseSchema = z.enum(VISUALIZATION_EXERCISES)
export type VisualizationExercise = z.infer<typeof VisualizationExerciseSchema>

/**
 * A visualization exercise (coach-agent.md §10). It carries the question's inputs only:
 * the answer is computed by replaying the line, so it never sits in the model's context.
 */
export const VisualizationAttachmentSchema = z.object({
  kind: z.literal('visualization'),
  exercise: VisualizationExerciseSchema,
  title: z.string().min(1),
  fen: FenSchema,
  orientation: ColorSchema,
  moves: z.array(SanSchema).default(() => []),
  view: BoardViewSchema.default('frozen'),
  level: z.number().int().min(1).max(10),
  /** What the question points at: the tracked piece's square, a route's ends, a named move. */
  target: z
    .object({
      square: SquareSchema.optional(),
      to: SquareSchema.optional(),
      move: SanSchema.optional(),
    })
    .optional(),
})
export type VisualizationAttachment = z.infer<typeof VisualizationAttachmentSchema>

/** A tool call Sage made while answering, shown as a small chip in the bubble. */
export const CoachToolAttachmentSchema = z.object({
  kind: z.literal('tool'),
  /** The tool's name from coach-agent.md §5, e.g. `analysePosition`. */
  name: z.string().min(1),
  /** What it returned, in a few words: "depth 18 · +0.8 · Nf3 best". */
  summary: z.string().min(1),
  status: z.enum(['done', 'running', 'failed']).default('done'),
})
export type CoachToolAttachment = z.infer<typeof CoachToolAttachmentSchema>

export const GM_STEPS = [
  'assess',
  'candidates',
  'calculate',
  'compare',
  'plan',
  'takeaway',
] as const
export const GmStepSchema = z.enum(GM_STEPS)
export type GmStep = z.infer<typeof GmStepSchema>

/** Grandmaster thinking (coach-agent.md §4): six steps, each with an optional board. */
export const ThinkingAttachmentSchema = z.object({
  kind: z.literal('thinking'),
  steps: z
    .array(
      z.object({
        step: GmStepSchema,
        title: z.string().min(1),
        text: z.string().min(1),
        board: SageBoardAttachmentSchema.optional(),
      }),
    )
    .min(1),
})
export type ThinkingAttachment = z.infer<typeof ThinkingAttachmentSchema>

export const COACH_ACTIONS = [
  'queue-puzzles',
  'add-to-mistake-bank',
  'start-drill',
  'set-plan',
  'save-note',
  'open-lesson',
  'confirm-spend',
] as const
export const CoachActionSchema = z.enum(COACH_ACTIONS)
export type CoachAction = z.infer<typeof CoachActionSchema>

/** Something Sage proposes doing in the app. Nothing happens until the user confirms. */
export const ActionAttachmentSchema = z.object({
  kind: z.literal('action'),
  action: CoachActionSchema,
  title: z.string().min(1),
  detail: z.string().optional(),
  /** Plan rows, puzzle themes, the note text: whatever the action is about. */
  items: z.array(z.string()).default(() => []),
  /** Where confirming goes, when it navigates. */
  href: z.string().optional(),
  /** Set when the action depends on a screen that is not built yet. */
  unavailable: z.string().optional(),
})
export type ActionAttachment = z.infer<typeof ActionAttachmentSchema>

/** Graded hints (coach-agent.md §1.8): revealed one level at a time, never all at once. */
export const HintsAttachmentSchema = z.object({
  kind: z.literal('hints'),
  fen: FenSchema,
  orientation: ColorSchema,
  levels: z
    .array(
      z.object({
        label: z.string().min(1),
        text: z.string().min(1),
        focus: z.array(SquareSchema).default(() => []),
        arrows: z.array(ArrowSchema).default(() => []),
      }),
    )
    .min(1)
    .max(3),
})
export type HintsAttachment = z.infer<typeof HintsAttachmentSchema>

/** Everything that can sit under the text of a Sage message. */
export const CoachAttachmentSchema = z.discriminatedUnion('kind', [
  CoachPositionAttachmentSchema,
  SageBoardAttachmentSchema,
  CalculationAttachmentSchema,
  VisualizationAttachmentSchema,
  CoachToolAttachmentSchema,
  ThinkingAttachmentSchema,
  ActionAttachmentSchema,
  HintsAttachmentSchema,
])
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
  /** The mode Sage answered in, shown on the bubble. */
  mode: CoachModeSchema.optional(),
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
