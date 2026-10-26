import { z } from 'zod'

import { TimestampSchema } from './primitives'

/**
 * The on-device decision model's vocabulary: which typed questions it answers and the shapes
 * its answers are stored and exported in.
 *
 * Why this lives in the domain layer and not in `src/decision`: the log table (`@/data`), the
 * Sage message (`@/domain/coach`) and the model runtime all need the same words, and the pure
 * layers may not depend on the runtime. The runtime imports these; nothing here imports it.
 *
 * The question keys, labels and the export row are a contract shared with the Python training
 * pipeline under `training/decision-model/`. Changing a key or a label is a breaking change to a
 * fine-tuned model, so it needs a new manifest `format` version.
 */

/** The Sage modes a question can route to. A subset of `COACH_MODES`: no companion or paused. */
export const DECISION_MODE_LABELS = [
  'grandmaster',
  'teacher',
  'tutor',
  'puzzle-nudger',
  'planner',
  'open-qa',
  'visualization',
] as const
export const DecisionModeLabelSchema = z.enum(DECISION_MODE_LABELS)
export type DecisionModeLabel = z.infer<typeof DecisionModeLabelSchema>

/** The yes/no questions, in display order. */
export const DECISION_FLAG_KEYS = [
  'needs_engine',
  'wants_solution',
  'needs_board',
  'about_history',
  'off_topic',
  'deep_answer',
] as const
export const DecisionFlagKeySchema = z.enum(DECISION_FLAG_KEYS)
export type DecisionFlagKey = z.infer<typeof DecisionFlagKeySchema>

export const DECISION_QUESTION_KEYS = ['mode', ...DECISION_FLAG_KEYS] as const
export type DecisionQuestionKey = (typeof DECISION_QUESTION_KEYS)[number]

export type DecisionQuestionSpec =
  | {
      readonly key: 'mode'
      readonly kind: 'choice'
      readonly labels: readonly DecisionModeLabel[]
      readonly title: string
      readonly description: string
    }
  | {
      readonly key: DecisionFlagKey
      readonly kind: 'binary'
      readonly title: string
      readonly description: string
    }

/** The registry. Order is the order the playground and the correction form show them in. */
export const DECISION_QUESTIONS: readonly DecisionQuestionSpec[] = [
  {
    key: 'mode',
    kind: 'choice',
    labels: DECISION_MODE_LABELS,
    title: 'Mode',
    description: 'Which voice should answer',
  },
  {
    key: 'needs_engine',
    kind: 'binary',
    title: 'Needs engine',
    description: 'The answer needs Stockfish analysis',
  },
  {
    key: 'wants_solution',
    kind: 'binary',
    title: 'Wants the answer',
    description: 'Asks to be told the move (spoiler risk)',
  },
  {
    key: 'needs_board',
    kind: 'binary',
    title: 'Needs a board',
    description: 'A demonstration on a board would help',
  },
  {
    key: 'about_history',
    kind: 'binary',
    title: 'About my games',
    description: 'About your own games, stats or progress',
  },
  {
    key: 'off_topic',
    kind: 'binary',
    title: 'Off topic',
    description: 'Not about chess',
  },
  {
    key: 'deep_answer',
    kind: 'binary',
    title: 'Deep answer',
    description: 'Needs a long answer rather than a quick reply',
  },
]

/** Labels for one text. Every key optional: a missing key means "unknown", not "no". */
export const DecisionLabelsSchema = z.object({
  mode: DecisionModeLabelSchema.optional(),
  needs_engine: z.union([z.literal(0), z.literal(1)]).optional(),
  wants_solution: z.union([z.literal(0), z.literal(1)]).optional(),
  needs_board: z.union([z.literal(0), z.literal(1)]).optional(),
  about_history: z.union([z.literal(0), z.literal(1)]).optional(),
  off_topic: z.union([z.literal(0), z.literal(1)]).optional(),
  deep_answer: z.union([z.literal(0), z.literal(1)]).optional(),
})
export type DecisionLabels = z.infer<typeof DecisionLabelsSchema>

/** What the model said: `mode` is a distribution, every flag a probability. */
export const DecisionProbsSchema = z.object({
  mode: z.record(z.string(), z.number()).optional(),
  needs_engine: z.number().optional(),
  wants_solution: z.number().optional(),
  needs_board: z.number().optional(),
  about_history: z.number().optional(),
  off_topic: z.number().optional(),
  deep_answer: z.number().optional(),
})
export type DecisionProbs = z.infer<typeof DecisionProbsSchema>

/** The probability a flag must reach to count as a "yes" when a decision is turned into labels. */
export const DECISION_FLAG_THRESHOLD = 0.5

/** Why a function: the pseudo-labels of a logged decision are derived, never typed by hand. */
export function labelsFromProbs(probs: DecisionProbs): DecisionLabels {
  const labels: DecisionLabels = {}
  if (probs.mode !== undefined) {
    let best: DecisionModeLabel | undefined
    let bestProb = -1
    for (const label of DECISION_MODE_LABELS) {
      const p = probs.mode[label]
      if (p !== undefined && p > bestProb) {
        best = label
        bestProb = p
      }
    }
    if (best !== undefined) labels.mode = best
  }
  for (const key of DECISION_FLAG_KEYS) {
    const p = probs[key]
    if (p !== undefined) labels[key] = p >= DECISION_FLAG_THRESHOLD ? 1 : 0
  }
  return labels
}

/** One logged decision, as stored in the `decisions` table. */
export const DecisionRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: TimestampSchema,
  text: z.string().min(1),
  /** Route id the question was asked from; the model never sees it. */
  screen: z.string().min(1).nullable(),
  modelId: z.string().min(1),
  latencyMs: z.number().min(0),
  probs: DecisionProbsSchema,
  /** The model's own argmax / threshold labels. */
  labels: DecisionLabelsSchema,
  /** The user's correction, only the keys they changed. `null` until they correct one. */
  correction: DecisionLabelsSchema.nullable().default(null),
  /** 0 or 1 and not a boolean, because IndexedDB cannot index a boolean. */
  corrected: z.union([z.literal(0), z.literal(1)]).default(0),
})
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>

export const DATASET_SOURCES = ['seed', 'predicted', 'corrected'] as const
export const DatasetSourceSchema = z.enum(DATASET_SOURCES)

/** One line of the exported training JSONL. Shared with the Python pipeline. */
export const DatasetRowSchema = z.object({
  text: z.string().min(1),
  screen: z.string().min(1).nullable(),
  labels: DecisionLabelsSchema,
  source: DatasetSourceSchema,
  model_id: z.string().nullable(),
  probs: DecisionProbsSchema.nullable(),
  created_at: z.iso.datetime(),
})
export type DatasetRow = z.infer<typeof DatasetRowSchema>

/** The compact decision a Sage message carries (small enough to sit in a thread and a backup). */
export const CoachDecisionSchema = z.object({
  /** The `decisions` row this was logged as; absent when logging is off. */
  logId: z.string().min(1).optional(),
  modelId: z.string().min(1),
  latencyMs: z.number().min(0),
  mode: z.object({
    label: DecisionModeLabelSchema,
    prob: z.number().min(0).max(1),
    /** Every mode's probability, for the chip's popover. */
    probs: z.record(z.string(), z.number()).optional(),
  }),
  flags: z.record(z.string(), z.number()),
})
export type CoachDecision = z.infer<typeof CoachDecisionSchema>
