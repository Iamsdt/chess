import { describe, expect, it } from 'vitest'

import {
  buildBinaryCentroids,
  buildChoiceCentroids,
  centroid,
  cosine,
  dot,
  linearBinary,
  linearChoice,
  mean,
  normalize,
  prototypeBinary,
  prototypeChoice,
  sigmoid,
  softmax,
} from './heads'

const close = (actual: number, expected: number, digits = 8): void => {
  expect(actual).toBeCloseTo(expected, digits)
}

describe('vector basics', () => {
  it('dot, normalize and cosine agree with hand-computed values', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32)
    const unit = normalize([3, 4])
    close(unit[0] ?? 0, 0.6)
    close(unit[1] ?? 0, 0.8)
    close(cosine([1, 0], [1, 1]), Math.SQRT1_2)
    close(cosine([1, 0], [0, 1]), 0)
    close(cosine([2, 0], [-5, 0]), -1)
  })

  it('treats a zero vector as orthogonal to everything instead of producing NaN', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0)
    expect(normalize([0, 0])).toEqual([0, 0])
  })

  it('mean and centroid average, and the centroid is unit length', () => {
    expect(
      mean([
        [1, 0],
        [0, 1],
        [2, 2],
      ]),
    ).toEqual([1, 1])
    const c = centroid([
      [1, 0],
      [0, 1],
    ])
    close(c[0] ?? 0, Math.SQRT1_2)
    close(c[1] ?? 0, Math.SQRT1_2)
    close(Math.hypot(...c), 1)
    expect(mean([])).toEqual([])
  })
})

describe('softmax and sigmoid', () => {
  it('softmax matches known values and sums to one', () => {
    const p = softmax([1, 2, 3])
    close(p[0] ?? 0, 0.09003057)
    close(p[1] ?? 0, 0.24472847)
    close(p[2] ?? 0, 0.66524096)
    close(
      p.reduce((a, b) => a + b, 0),
      1,
    )
    expect(softmax([0, 0])).toEqual([0.5, 0.5])
    expect(softmax([])).toEqual([])
  })

  it('softmax is stable for huge logits', () => {
    const p = softmax([1000, 1000, 0])
    close(p[0] ?? 0, 0.5)
    close(p[2] ?? 1, 0)
    expect(p.every(Number.isFinite)).toBe(true)
  })

  it('sigmoid matches known values and survives both tails', () => {
    close(sigmoid(0), 0.5)
    close(sigmoid(2), 0.880797078)
    close(sigmoid(-2), 0.119202922)
    expect(sigmoid(-800)).toBe(0)
    expect(sigmoid(800)).toBe(1)
  })
})

describe('linear heads', () => {
  it('choice: softmax(W·e + b)', () => {
    const p = linearChoice(
      [2, 0],
      [
        [1, 0],
        [0, 1],
      ],
      [0, 0],
    )
    close(p[0] ?? 0, 0.880797078)
    close(p[1] ?? 0, 0.119202922)
    const biased = linearChoice(
      [0, 0],
      [
        [1, 0],
        [0, 1],
      ],
      [Math.log(3), 0],
    )
    close(biased[0] ?? 0, 0.75)
  })

  it('binary: sigmoid(w·e + b)', () => {
    close(linearBinary([1, 1], [1, -1], 0.5), 0.6224593312)
    close(linearBinary([0, 0], [5, 5], 0), 0.5)
  })
})

describe('prototype heads', () => {
  it('choice: softmax(cos(e, c_k) / T)', () => {
    const p = prototypeChoice(
      [1, 0],
      [
        [1, 0],
        [0, 1],
      ],
      0.5,
    )
    close(p[0] ?? 0, 0.880797078)
    close(p[1] ?? 0, 0.119202922)
  })

  it('a smaller temperature sharpens the distribution', () => {
    const soft = prototypeChoice(
      [1, 0],
      [
        [1, 0],
        [0, 1],
      ],
      0.5,
    )
    const sharp = prototypeChoice(
      [1, 0],
      [
        [1, 0],
        [0, 1],
      ],
      0.05,
    )
    expect(sharp[0]).toBeGreaterThan(soft[0] ?? 1)
    close(sharp[0] ?? 0, 1 / (1 + Math.exp(-20)))
  })

  it('binary: sigmoid((cos(e, c_pos) - cos(e, c_neg)) / T)', () => {
    close(prototypeBinary([1, 0], [1, 0], [0, 1], 0.5), 0.880797078)
    close(prototypeBinary([0, 1], [1, 0], [0, 1], 0.5), 0.119202922)
    close(prototypeBinary([1, 1], [1, 0], [0, 1], 0.05), 0.5)
  })
})

describe('building centroids from labelled embeddings', () => {
  const rows = [
    { embedding: [1, 0], labels: { mode: 'a', flag: 1 } },
    { embedding: [0.8, 0.2], labels: { mode: 'a', flag: 1 } },
    { embedding: [0, 1], labels: { mode: 'b', flag: 0 } },
    { embedding: [0.5, 0.5], labels: { flag: 0 } },
  ]

  it('one centroid per label that has examples, in the order asked for', () => {
    const built = buildChoiceCentroids(rows, 'mode', ['b', 'c', 'a'])
    expect(built.labels).toEqual(['b', 'a'])
    expect(built.centroids).toHaveLength(2)
    const a = built.centroids[1] ?? []
    close(Math.hypot(...a), 1)
    expect(a[0]).toBeGreaterThan(a[1] ?? 1)
  })

  it('binary centroids need both classes, and ignore rows with the label unknown', () => {
    const built = buildBinaryCentroids(rows, 'flag')
    expect(built).toBeDefined()
    expect(built?.positive[0]).toBeGreaterThan(built?.positive[1] ?? 1)
    expect(built?.negative[1]).toBeGreaterThan(built?.negative[0] ?? 1)
    expect(buildBinaryCentroids(rows, 'unknown-key')).toBeUndefined()
    expect(buildBinaryCentroids(rows.slice(0, 2), 'flag')).toBeUndefined()
  })
})
