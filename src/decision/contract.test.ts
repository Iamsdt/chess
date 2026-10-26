import { describe, expect, it } from 'vitest'

import {
  BUILTIN_MANIFEST,
  DECISION_FLAG_KEYS,
  DECISION_MODE_LABELS,
  DECISION_QUESTIONS,
  ManifestSchema,
  MANIFEST_FORMAT,
  resolveQuestions,
  SeedsSchema,
  type Manifest,
} from './contract'
import seedsJson from './seeds.json'

const base = {
  format: MANIFEST_FORMAT,
  id: 'tuned@1',
  encoder: { model: 'me/tuned-minilm', dtype: 'q8' },
}

function linearBinary(dim: number) {
  return { type: 'linear' as const, weights: Array.from({ length: dim }, () => 0.1), bias: 0.2 }
}

describe('manifest schema', () => {
  it('accepts the built-in manifest', () => {
    expect(ManifestSchema.safeParse(BUILTIN_MANIFEST).success).toBe(true)
  })

  it('fills in encoder defaults and an empty question list', () => {
    const parsed = ManifestSchema.parse({
      format: MANIFEST_FORMAT,
      id: 'x',
      encoder: { model: 'Xenova/all-MiniLM-L6-v2' },
    })
    expect(parsed.encoder).toMatchObject({ dtype: 'q8', pooling: 'mean', normalize: true })
    expect(parsed.questions).toEqual([])
  })

  it('accepts linear heads for choice and binary questions, and metrics', () => {
    const parsed = ManifestSchema.safeParse({
      ...base,
      metrics: { accuracy: 0.91, note: 'held out' },
      questions: [
        {
          key: 'mode',
          kind: 'choice',
          labels: ['grandmaster', 'teacher'],
          head: {
            type: 'linear',
            weights: [
              [1, 2, 3],
              [4, 5, 6],
            ],
            bias: [0, 0],
          },
        },
        { key: 'needs_engine', kind: 'binary', head: linearBinary(3) },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it.each([
    ['a wrong format string', { ...base, format: 'something/9' }],
    ['no encoder', { format: MANIFEST_FORMAT, id: 'x' }],
    [
      'an unknown question key',
      { ...base, questions: [{ key: 'weather', kind: 'binary', head: linearBinary(2) }] },
    ],
    [
      'a duplicated question',
      {
        ...base,
        questions: [
          { key: 'off_topic', kind: 'binary', head: linearBinary(2) },
          { key: 'off_topic', kind: 'binary', head: linearBinary(2) },
        ],
      },
    ],
    [
      'a choice head with the wrong number of weight rows',
      {
        ...base,
        questions: [
          {
            key: 'mode',
            kind: 'choice',
            labels: ['grandmaster', 'teacher', 'tutor'],
            head: { type: 'linear', weights: [[1], [2]], bias: [0, 0, 0] },
          },
        ],
      },
    ],
    [
      'ragged weight rows',
      {
        ...base,
        questions: [
          {
            key: 'mode',
            kind: 'choice',
            labels: ['grandmaster', 'teacher'],
            head: { type: 'linear', weights: [[1, 2], [3]], bias: [0, 0] },
          },
        ],
      },
    ],
    [
      'linear heads of different widths',
      {
        ...base,
        questions: [
          { key: 'off_topic', kind: 'binary', head: linearBinary(2) },
          { key: 'needs_board', kind: 'binary', head: linearBinary(3) },
        ],
      },
    ],
    [
      'a mode label the app has no mode for',
      {
        ...base,
        questions: [
          {
            key: 'mode',
            kind: 'choice',
            labels: ['grandmaster', 'poet'],
            head: { type: 'prototype' },
          },
        ],
      },
    ],
    [
      'a non-positive temperature',
      {
        ...base,
        questions: [
          { key: 'off_topic', kind: 'binary', head: { type: 'prototype', temperature: 0 } },
        ],
      },
    ],
    [
      'a kind that disagrees with the key',
      { ...base, questions: [{ key: 'mode', kind: 'binary', head: { type: 'prototype' } }] },
    ],
  ])('rejects %s', (_name, manifest) => {
    expect(ManifestSchema.safeParse(manifest).success).toBe(false)
  })
})

describe('resolving questions against the built-in model', () => {
  function parse(raw: unknown): Manifest {
    return ManifestSchema.parse(raw)
  }

  it('the built-in manifest answers every question with a prototype head', () => {
    const { questions, unavailable } = resolveQuestions(BUILTIN_MANIFEST, BUILTIN_MANIFEST)
    expect(questions.map((q) => q.key)).toEqual(DECISION_QUESTIONS.map((q) => q.key))
    expect(questions.every((q) => q.head.type === 'prototype' && !q.fallback)).toBe(true)
    expect(unavailable).toEqual([])
  })

  it('a missing question falls back to the built-in prototype head when the encoder is the same', () => {
    const manifest = parse({
      ...base,
      encoder: { model: BUILTIN_MANIFEST.encoder.model, dtype: BUILTIN_MANIFEST.encoder.dtype },
      questions: [{ key: 'needs_engine', kind: 'binary', head: linearBinary(4) }],
    })
    const { questions, unavailable } = resolveQuestions(manifest, BUILTIN_MANIFEST)
    expect(unavailable).toEqual([])
    const engine = questions.find((q) => q.key === 'needs_engine')
    expect(engine?.head.type).toBe('linear')
    expect(engine?.fallback).toBe(false)
    const mode = questions.find((q) => q.key === 'mode')
    expect(mode?.head.type).toBe('prototype')
    expect(mode?.fallback).toBe(true)
    expect(mode?.labels).toEqual(DECISION_MODE_LABELS)
  })

  it('a different encoder never borrows built-in heads: its missing questions are unavailable', () => {
    const manifest = parse({
      ...base,
      questions: [{ key: 'needs_engine', kind: 'binary', head: linearBinary(4) }],
    })
    const { questions, unavailable } = resolveQuestions(manifest, BUILTIN_MANIFEST)
    expect(questions.map((q) => q.key)).toEqual(['needs_engine'])
    expect(unavailable).toEqual(['mode', ...DECISION_FLAG_KEYS.filter((k) => k !== 'needs_engine')])
  })

  it('the same model at another dtype is a different space too', () => {
    const manifest = parse({
      ...base,
      encoder: { model: BUILTIN_MANIFEST.encoder.model, dtype: 'fp32' },
    })
    expect(resolveQuestions(manifest, BUILTIN_MANIFEST).questions).toEqual([])
  })
})

describe('seeds.json', () => {
  const seeds = SeedsSchema.parse(seedsJson)

  it('validates against the schema', () => {
    expect(SeedsSchema.safeParse(seedsJson).success).toBe(true)
  })

  it('has roughly 180-250 rows with no duplicates', () => {
    expect(seeds.length).toBeGreaterThanOrEqual(180)
    expect(seeds.length).toBeLessThanOrEqual(260)
    expect(new Set(seeds.map((s) => s.text)).size).toBe(seeds.length)
  })

  it.each(DECISION_MODE_LABELS)('has at least 12 examples of mode %s', (label) => {
    expect(seeds.filter((s) => s.labels.mode === label).length).toBeGreaterThanOrEqual(12)
  })

  it.each(DECISION_FLAG_KEYS)('has at least 15 positives and 15 negatives for %s', (key) => {
    expect(seeds.filter((s) => s.labels[key] === 1).length).toBeGreaterThanOrEqual(15)
    expect(seeds.filter((s) => s.labels[key] === 0).length).toBeGreaterThanOrEqual(15)
  })

  it('includes some non-English rows', () => {
    expect(seeds.some((s) => /[áéíóúñüöàèçâêî]/i.test(s.text))).toBe(true)
  })
})
