import { describe, expect, it } from 'vitest'

import { BUILTIN_MANIFEST, resolveQuestions, type SeedRow } from './contract'
import {
  centroidCacheHash,
  CentroidSetSchema,
  computeCentroids,
  evaluateEmbedding,
  toDecision,
} from './evaluate'

const { questions } = resolveQuestions(BUILTIN_MANIFEST, BUILTIN_MANIFEST)

/** Two-dimensional "embeddings" so every number below can be checked by hand. */
const seeds: SeedRow[] = [
  { text: 'a', labels: { mode: 'grandmaster', needs_engine: 1, off_topic: 0 } },
  { text: 'b', labels: { mode: 'grandmaster', needs_engine: 1, off_topic: 0 } },
  { text: 'c', labels: { mode: 'tutor', needs_engine: 0, off_topic: 1 } },
  { text: 'd', labels: { mode: 'tutor', needs_engine: 0, off_topic: 1 } },
]
const vectors = [
  [1, 0],
  [1, 0],
  [0, 1],
  [0, 1],
]

describe('computeCentroids', () => {
  const set = computeCentroids(seeds, vectors, questions)

  it('builds a choice question from labels with examples only', () => {
    const mode = set.mode
    expect(mode && 'labels' in mode ? mode.labels : []).toEqual(['grandmaster', 'tutor'])
  })

  it('builds binary questions that have both classes, and skips the rest', () => {
    expect(set.needs_engine).toBeDefined()
    expect(set.off_topic).toBeDefined()
    expect(set.wants_solution).toBeUndefined()
  })

  it('survives the cache schema (it is stored in IndexedDB)', () => {
    expect(CentroidSetSchema.safeParse(JSON.parse(JSON.stringify(set))).success).toBe(true)
  })
})

describe('evaluateEmbedding', () => {
  const set = computeCentroids(seeds, vectors, questions)

  it('answers what it can and reports what it cannot', () => {
    const { probs, skipped } = evaluateEmbedding([1, 0], questions, set)
    expect(probs.mode?.grandmaster).toBeGreaterThan(0.99)
    expect(probs.mode?.tutor).toBeLessThan(0.01)
    expect(probs.mode?.planner).toBe(0)
    expect(probs.needs_engine).toBeGreaterThan(0.99)
    expect(probs.off_topic).toBeLessThan(0.01)
    expect(skipped).toEqual(['wants_solution', 'needs_board', 'about_history', 'deep_answer'])
  })

  it('runs linear heads, whatever the centroids say', () => {
    const linear = [
      {
        key: 'needs_engine' as const,
        kind: 'binary' as const,
        fallback: false,
        head: { type: 'linear' as const, weights: [2, 0], bias: -1 },
      },
      {
        key: 'mode' as const,
        kind: 'choice' as const,
        labels: ['grandmaster', 'teacher'] as const,
        fallback: false,
        head: {
          type: 'linear' as const,
          weights: [
            [1, 0],
            [0, 1],
          ],
          bias: [0, 0],
        },
      },
    ]
    const { probs, skipped } = evaluateEmbedding([1, 0], linear, {})
    expect(skipped).toEqual([])
    expect(probs.needs_engine).toBeCloseTo(1 / (1 + Math.exp(-1)), 8)
    expect(probs.mode?.grandmaster).toBeCloseTo(1 / (1 + Math.exp(-1)), 8)
    expect(probs.mode?.teacher).toBeCloseTo(1 / (1 + Math.E), 8)
    expect(probs.mode?.tutor).toBe(0)
  })
})

describe('toDecision', () => {
  it('picks the most probable mode and carries the flags', () => {
    const decision = toDecision(
      { mode: { grandmaster: 0.2, tutor: 0.7, teacher: 0.1 }, needs_engine: 0.9, off_topic: 0.1 },
      { modelId: 'm', latencyMs: 3, input: 'hi' },
    )
    expect(decision?.mode.label).toBe('tutor')
    expect(decision?.flags).toEqual({ needs_engine: 0.9, off_topic: 0.1 })
    expect(decision).toMatchObject({ modelId: 'm', latencyMs: 3, input: 'hi' })
  })

  it('is undefined when the model could not answer the mode question', () => {
    expect(
      toDecision({ needs_engine: 1 }, { modelId: 'm', latencyMs: 1, input: 'x' }),
    ).toBeUndefined()
  })
})

describe('centroidCacheHash', () => {
  const encoder = { model: 'Xenova/all-MiniLM-L6-v2', dtype: 'q8' }

  it('is stable for the same inputs', () => {
    expect(centroidCacheHash(encoder, seeds, questions)).toBe(
      centroidCacheHash(encoder, seeds, questions),
    )
  })

  it('changes with the encoder, the seed text or the seed labels', () => {
    const base = centroidCacheHash(encoder, seeds, questions)
    expect(centroidCacheHash({ ...encoder, dtype: 'fp32' }, seeds, questions)).not.toBe(base)
    expect(centroidCacheHash({ ...encoder, model: 'other/model' }, seeds, questions)).not.toBe(base)
    expect(
      centroidCacheHash(encoder, [{ ...seeds[0]!, text: 'z' }, ...seeds.slice(1)], questions),
    ).not.toBe(base)
    expect(
      centroidCacheHash(
        encoder,
        [{ ...seeds[0]!, labels: { mode: 'teacher' } }, ...seeds.slice(1)],
        questions,
      ),
    ).not.toBe(base)
  })
})
