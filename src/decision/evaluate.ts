import { z } from 'zod'

import {
  DECISION_FLAG_KEYS,
  DECISION_MODE_LABELS,
  type DecisionFlagKey,
  type DecisionModeLabel,
  type DecisionProbs,
  type DecisionQuestionKey,
} from '@/domain'

import { type Decision, type ResolvedQuestion, type SeedRow } from './contract'
import {
  buildBinaryCentroids,
  buildChoiceCentroids,
  linearBinary,
  linearChoice,
  prototypeBinary,
  prototypeChoice,
  type BinaryCentroids,
  type ChoiceCentroids,
  type LabelledEmbedding,
  type QuestionCentroids,
  type Vector,
} from './heads'

/**
 * Turns an embedding into answers, and seeds into the centroids prototype heads need.
 *
 * Pure on purpose: the worker only embeds text and calls these, so the same code is exercised by
 * unit tests without a model.
 */

/** Prototype centroids by question key. Plain arrays, so they survive IndexedDB and the worker. */
export type CentroidSet = Partial<Record<DecisionQuestionKey, QuestionCentroids>>

const ChoiceCentroidsSchema = z.object({
  labels: z.array(z.string()),
  centroids: z.array(z.array(z.number())),
})
const BinaryCentroidsSchema = z.object({
  positive: z.array(z.number()),
  negative: z.array(z.number()),
})
export const CentroidSetSchema = z.record(
  z.string(),
  z.union([ChoiceCentroidsSchema, BinaryCentroidsSchema]),
)

function isChoiceCentroids(value: QuestionCentroids): value is ChoiceCentroids {
  return 'centroids' in value
}
function isBinaryCentroids(value: QuestionCentroids): value is BinaryCentroids {
  return 'positive' in value
}

/** Builds centroids for every question that runs a prototype head. */
export function computeCentroids(
  seeds: readonly SeedRow[],
  embeddings: readonly Vector[],
  questions: readonly ResolvedQuestion[],
): CentroidSet {
  const rows: LabelledEmbedding[] = seeds.map((seed, index) => ({
    embedding: embeddings[index] ?? [],
    labels: seed.labels,
  }))
  const set: CentroidSet = {}
  for (const question of questions) {
    if (question.head.type !== 'prototype') continue
    if (question.kind === 'choice') {
      const built = buildChoiceCentroids(
        rows,
        question.key,
        question.labels ?? DECISION_MODE_LABELS,
      )
      if (built.labels.length >= 2) set[question.key] = built
    } else {
      const built = buildBinaryCentroids(rows, question.key)
      if (built !== undefined) set[question.key] = built
    }
  }
  return set
}

export interface Evaluation {
  readonly probs: DecisionProbs
  /** Questions that could not be answered (a prototype head with no usable seeds). */
  readonly skipped: readonly DecisionQuestionKey[]
}

/** Runs every resolved question against one embedding. */
export function evaluateEmbedding(
  embedding: Vector,
  questions: readonly ResolvedQuestion[],
  centroids: CentroidSet,
): Evaluation {
  const probs: DecisionProbs = {}
  const skipped: DecisionQuestionKey[] = []
  for (const question of questions) {
    const head = question.head
    if (question.kind === 'choice') {
      const labels = question.labels ?? DECISION_MODE_LABELS
      let distribution: number[] | undefined
      let names: readonly string[] = labels
      if (head.type === 'linear' && Array.isArray(head.weights[0]) && Array.isArray(head.bias)) {
        distribution = linearChoice(embedding, head.weights as number[][], head.bias)
      } else if (head.type === 'prototype') {
        const own = centroids[question.key]
        if (own !== undefined && isChoiceCentroids(own)) {
          distribution = prototypeChoice(embedding, own.centroids, head.temperature)
          names = own.labels
        }
      }
      if (distribution === undefined) {
        skipped.push(question.key)
        continue
      }
      const record: Record<string, number> = {}
      for (const label of DECISION_MODE_LABELS) record[label] = 0
      names.forEach((name, index) => {
        record[name] = distribution[index] ?? 0
      })
      probs.mode = record
      continue
    }
    const key = question.key as DecisionFlagKey
    if (
      head.type === 'linear' &&
      typeof head.bias === 'number' &&
      !Array.isArray(head.weights[0])
    ) {
      probs[key] = linearBinary(embedding, head.weights as number[], head.bias)
    } else if (head.type === 'prototype') {
      const own = centroids[key]
      if (own !== undefined && isBinaryCentroids(own)) {
        probs[key] = prototypeBinary(embedding, own.positive, own.negative, head.temperature)
      } else {
        skipped.push(key)
      }
    } else {
      skipped.push(key)
    }
  }
  return { probs, skipped }
}

/** Assembles the public `Decision` from raw probabilities. */
export function toDecision(
  probs: DecisionProbs,
  meta: { modelId: string; latencyMs: number; input: string },
): Decision | undefined {
  const distribution = probs.mode
  if (distribution === undefined) return undefined
  let label: DecisionModeLabel | undefined
  let best = -1
  for (const candidate of DECISION_MODE_LABELS) {
    const p = distribution[candidate] ?? 0
    if (p > best) {
      best = p
      label = candidate
    }
  }
  if (label === undefined) return undefined
  const flags: Partial<Record<DecisionFlagKey, number>> = {}
  for (const key of DECISION_FLAG_KEYS) {
    const p = probs[key]
    if (p !== undefined) flags[key] = p
  }
  return {
    modelId: meta.modelId,
    latencyMs: meta.latencyMs,
    mode: { label, probs: distribution },
    flags,
    input: meta.input,
  }
}

/** cyrb53: small, dependency-free, plenty to tell two seed files apart. */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * What a centroid cache entry is valid for: the encoder, the heads that need centroids, and the
 * seed text and labels. Change any of them and the hash changes, so a stale cache cannot be read.
 */
export function centroidCacheHash(
  encoder: { model: string; dtype: string },
  seeds: readonly SeedRow[],
  questions: readonly ResolvedQuestion[],
): string {
  const temps = questions
    .filter((q) => q.head.type === 'prototype')
    .map((q) => `${q.key}:${q.labels?.join(',') ?? ''}`)
    .join(';')
  return hashString(`${encoder.model}|${encoder.dtype}|${temps}|${JSON.stringify(seeds)}`)
}
