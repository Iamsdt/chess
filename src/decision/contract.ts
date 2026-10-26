import { z } from 'zod'

import {
  DatasetRowSchema,
  DECISION_FLAG_KEYS,
  DECISION_MODE_LABELS,
  DECISION_QUESTIONS,
  type DecisionFlagKey,
  type DecisionModeLabel,
  type DecisionQuestionKey,
  type DecisionQuestionSpec,
} from '@/domain'

/**
 * The decision model's contract: what a model manifest may say, and what a decision is.
 *
 * This file is the TypeScript half of a contract the Python training pipeline
 * (`training/decision-model/`) implements too. The encoder, the pooling, the question keys and
 * the head math are fixed here; a fine-tuned model changes the weights and the encoder repo id,
 * never the shapes.
 */

export {
  DatasetRowSchema,
  DECISION_FLAG_KEYS,
  DECISION_MODE_LABELS,
  DECISION_QUESTIONS,
  type DecisionFlagKey,
  type DecisionModeLabel,
  type DecisionQuestionKey,
  type DecisionQuestionSpec,
}
export type { DatasetRow } from '@/domain'

/** Bumped when the manifest layout changes in a way an older app cannot read. */
export const MANIFEST_FORMAT = 'chess-king-decision/1'

export const DEFAULT_ENCODER_MODEL = 'Xenova/all-MiniLM-L6-v2'
export const DEFAULT_ENCODER_DTYPE = 'q8'
export const DEFAULT_REMOTE_HOST = 'https://huggingface.co/'
/** Prototype heads: the softmax temperature applied to cosine similarities. */
export const DEFAULT_TEMPERATURE = 0.05
/** Tokens the encoder reads; longer questions are truncated. */
export const MAX_TOKENS = 128
/** The weights an encoder download costs, for the "~23 MB" line. */
export const DEFAULT_MODEL_SIZE_MB = 23

const PrototypeHeadSchema = z.object({
  type: z.literal('prototype'),
  temperature: z.number().positive().default(DEFAULT_TEMPERATURE),
})

/** Binary: one weight vector and a scalar. Choice: one row per label and a bias per label. */
const BinaryLinearHeadSchema = z.object({
  type: z.literal('linear'),
  weights: z.array(z.number()).min(1),
  bias: z.number(),
})
const ChoiceLinearHeadSchema = z.object({
  type: z.literal('linear'),
  weights: z.array(z.array(z.number()).min(1)).min(2),
  bias: z.array(z.number()).min(2),
})

const BinaryQuestionSchema = z.object({
  key: z.enum(DECISION_FLAG_KEYS),
  kind: z.literal('binary'),
  head: z.union([PrototypeHeadSchema, BinaryLinearHeadSchema]),
})

const ChoiceQuestionSchema = z.object({
  key: z.literal('mode'),
  kind: z.literal('choice'),
  labels: z.array(z.enum(DECISION_MODE_LABELS)).min(2),
  head: z.union([PrototypeHeadSchema, ChoiceLinearHeadSchema]),
})

export const ManifestQuestionSchema = z.union([ChoiceQuestionSchema, BinaryQuestionSchema])
export type ManifestQuestion = z.infer<typeof ManifestQuestionSchema>

export const EncoderSchema = z.object({
  model: z.string().min(1),
  dtype: z.string().min(1).default(DEFAULT_ENCODER_DTYPE),
  pooling: z.literal('mean').default('mean'),
  normalize: z.literal(true).default(true),
  remoteHost: z.url().optional(),
})
export type EncoderSpec = z.infer<typeof EncoderSchema>

/**
 * A model: which encoder to load, and the head for each question.
 *
 * Questions missing from `questions` fall back to the built-in prototype head when the encoder is
 * the same one (see `resolveQuestions`). A linear head's width must match the encoder's output
 * width, which `validateManifestDims` checks once the encoder has told us its width.
 */
export const ManifestSchema = z
  .object({
    format: z.literal(MANIFEST_FORMAT),
    id: z.string().min(1),
    createdAt: z.iso.datetime().optional(),
    encoder: EncoderSchema,
    questions: z.array(ManifestQuestionSchema).default(() => []),
    /** Evaluation numbers from training; shown in Settings, never interpreted. */
    metrics: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((manifest, ctx) => {
    const seen = new Set<string>()
    for (const [index, question] of manifest.questions.entries()) {
      if (seen.has(question.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', index, 'key'],
          message: `Question "${question.key}" appears twice`,
        })
      }
      seen.add(question.key)
      if (question.kind === 'choice' && question.head.type === 'linear') {
        if (question.head.weights.length !== question.labels.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['questions', index, 'head', 'weights'],
            message: 'A choice head needs one weight row per label',
          })
        }
        if (question.head.bias.length !== question.labels.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['questions', index, 'head', 'bias'],
            message: 'A choice head needs one bias per label',
          })
        }
        const width = question.head.weights[0]?.length
        if (question.head.weights.some((row) => row.length !== width)) {
          ctx.addIssue({
            code: 'custom',
            path: ['questions', index, 'head', 'weights'],
            message: 'Every weight row must have the same width',
          })
        }
      }
      if (question.kind === 'choice') {
        const unique = new Set(question.labels)
        if (unique.size !== question.labels.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['questions', index, 'labels'],
            message: 'Labels must be distinct',
          })
        }
      }
    }
    const widths = new Set<number>()
    for (const question of manifest.questions) {
      if (question.head.type !== 'linear') continue
      if (question.kind === 'choice') {
        widths.add(question.head.weights[0]?.length ?? 0)
      } else {
        widths.add(question.head.weights.length)
      }
    }
    if (widths.size > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['questions'],
        message: 'Linear heads disagree on the embedding width',
      })
    }
  })
export type Manifest = z.infer<typeof ManifestSchema>

/** The head a question runs with after fallbacks are applied. */
export type ResolvedHead =
  | { readonly type: 'prototype'; readonly temperature: number }
  | {
      readonly type: 'linear'
      readonly weights: number[] | number[][]
      readonly bias: number | number[]
    }

export interface ResolvedQuestion {
  readonly key: DecisionQuestionKey
  readonly kind: 'choice' | 'binary'
  readonly labels?: readonly DecisionModeLabel[]
  readonly head: ResolvedHead
  /** True when the manifest did not carry this question and the built-in head stands in. */
  readonly fallback: boolean
}

export interface ResolvedQuestions {
  readonly questions: readonly ResolvedQuestion[]
  /** Questions this model cannot answer: absent, and the encoder differs from the built-in one. */
  readonly unavailable: readonly DecisionQuestionKey[]
}

/** Whether two encoders produce vectors in the same space, so prototype heads still make sense. */
export function sameEncoder(a: EncoderSpec, b: EncoderSpec): boolean {
  return a.model === b.model && a.dtype === b.dtype
}

/**
 * Applies the fallback rule: a question the manifest does not carry uses the built-in prototype
 * head if (and only if) the manifest's encoder is the built-in encoder. A different encoder lives
 * in a different vector space, so a seed centroid from the built-in one would be nonsense there.
 */
export function resolveQuestions(manifest: Manifest, builtin: Manifest): ResolvedQuestions {
  const useBuiltin = sameEncoder(manifest.encoder, builtin.encoder)
  const questions: ResolvedQuestion[] = []
  const unavailable: DecisionQuestionKey[] = []
  for (const spec of DECISION_QUESTIONS) {
    const own = manifest.questions.find((question) => question.key === spec.key)
    if (own !== undefined) {
      if (own.kind === 'choice') {
        questions.push({
          key: 'mode',
          kind: 'choice',
          labels: own.labels,
          head:
            own.head.type === 'prototype'
              ? { type: 'prototype', temperature: own.head.temperature }
              : { type: 'linear', weights: own.head.weights, bias: own.head.bias },
          fallback: false,
        })
      } else {
        questions.push({
          key: own.key,
          kind: 'binary',
          head:
            own.head.type === 'prototype'
              ? { type: 'prototype', temperature: own.head.temperature }
              : { type: 'linear', weights: own.head.weights, bias: own.head.bias },
          fallback: false,
        })
      }
      continue
    }
    if (!useBuiltin) {
      unavailable.push(spec.key)
      continue
    }
    questions.push({
      key: spec.key,
      kind: spec.kind,
      ...(spec.kind === 'choice' ? { labels: spec.labels } : {}),
      head: { type: 'prototype', temperature: DEFAULT_TEMPERATURE },
      fallback: true,
    })
  }
  return { questions, unavailable }
}

/** The model the app ships: the small encoder with prototype heads built from `seeds.json`. */
export const BUILTIN_MANIFEST: Manifest = {
  format: MANIFEST_FORMAT,
  id: 'minilm-l6-prototype@1',
  encoder: {
    model: DEFAULT_ENCODER_MODEL,
    dtype: DEFAULT_ENCODER_DTYPE,
    pooling: 'mean',
    normalize: true,
  },
  questions: [
    {
      key: 'mode',
      kind: 'choice',
      labels: [...DECISION_MODE_LABELS],
      head: { type: 'prototype', temperature: DEFAULT_TEMPERATURE },
    },
    ...DECISION_FLAG_KEYS.map((key): ManifestQuestion => ({
      key,
      kind: 'binary',
      head: { type: 'prototype', temperature: DEFAULT_TEMPERATURE },
    })),
  ],
}

/** The result of asking the model one question. */
export interface Decision {
  readonly modelId: string
  readonly latencyMs: number
  readonly mode: {
    readonly label: DecisionModeLabel
    readonly probs: Readonly<Record<string, number>>
  }
  /** One probability per binary question the model could answer. */
  readonly flags: Readonly<Partial<Record<DecisionFlagKey, number>>>
  /** The text the model was shown. */
  readonly input: string
}

/** One seed row of `seeds.json`. */
export const SeedRowSchema = z.object({
  text: z.string().min(1),
  labels: z.object({
    mode: z.enum(DECISION_MODE_LABELS).optional(),
    needs_engine: z.union([z.literal(0), z.literal(1)]).optional(),
    wants_solution: z.union([z.literal(0), z.literal(1)]).optional(),
    needs_board: z.union([z.literal(0), z.literal(1)]).optional(),
    about_history: z.union([z.literal(0), z.literal(1)]).optional(),
    off_topic: z.union([z.literal(0), z.literal(1)]).optional(),
    deep_answer: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
})
export type SeedRow = z.infer<typeof SeedRowSchema>
export const SeedsSchema = z.array(SeedRowSchema).min(1)
