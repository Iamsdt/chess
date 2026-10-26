/**
 * The decision model's head math, as pure functions over plain numbers.
 *
 * Why no imports: the Python pipeline implements the same formulas, and the smoke test runs this
 * file directly under Node. Keeping it free of the app's modules keeps both honest.
 *
 * Embeddings are expected to be L2-normalised by the encoder (`normalize: true`), but every
 * function here that depends on it normalises again, so a slightly-off vector cannot skew a
 * cosine.
 */

export type Vector = ArrayLike<number>

export function dot(a: Vector, b: Vector): number {
  const n = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < n; i += 1) sum += (a[i] ?? 0) * (b[i] ?? 0)
  return sum
}

export function norm(a: Vector): number {
  return Math.sqrt(dot(a, a))
}

/** Unit-length copy. A zero vector stays zero, so it scores 0 against everything. */
export function normalize(a: Vector): number[] {
  const length = norm(a)
  return Array.from(a, (value) => (length === 0 ? 0 : value / length))
}

export function cosine(a: Vector, b: Vector): number {
  const denominator = norm(a) * norm(b)
  return denominator === 0 ? 0 : dot(a, b) / denominator
}

/** Numerically stable: subtracts the max before exponentiating. */
export function softmax(logits: readonly number[]): number[] {
  if (logits.length === 0) return []
  const max = Math.max(...logits)
  const exps = logits.map((logit) => Math.exp(logit - max))
  const total = exps.reduce((sum, value) => sum + value, 0)
  return exps.map((value) => value / total)
}

/** Stable at both tails: never exponentiates a large positive number. */
export function sigmoid(x: number): number {
  if (x >= 0) return 1 / (1 + Math.exp(-x))
  const e = Math.exp(x)
  return e / (1 + e)
}

export function mean(vectors: readonly Vector[]): number[] {
  const first = vectors[0]
  if (first === undefined) return []
  const out = new Array<number>(first.length).fill(0)
  for (const vector of vectors) {
    for (let i = 0; i < out.length; i += 1) out[i] = (out[i] ?? 0) + (vector[i] ?? 0)
  }
  return out.map((value) => value / vectors.length)
}

/** L2-normalised mean of the vectors: the prototype of a class. */
export function centroid(vectors: readonly Vector[]): number[] {
  return normalize(mean(vectors))
}

/** `linear` choice head: `softmax(W·e + b)` with `W` shaped `[labels][dim]`. */
export function linearChoice(
  embedding: Vector,
  weights: readonly Vector[],
  bias: readonly number[],
): number[] {
  return softmax(weights.map((row, index) => dot(row, embedding) + (bias[index] ?? 0)))
}

/** `linear` binary head: `sigmoid(w·e + b)`. */
export function linearBinary(embedding: Vector, weights: Vector, bias: number): number {
  return sigmoid(dot(weights, embedding) + bias)
}

/** `prototype` choice head: `softmax(cos(e, c_k) / T)`. */
export function prototypeChoice(
  embedding: Vector,
  centroids: readonly Vector[],
  temperature: number,
): number[] {
  return softmax(centroids.map((c) => cosine(embedding, c) / temperature))
}

/** `prototype` binary head: `sigmoid((cos(e, c_pos) - cos(e, c_neg)) / T)`. */
export function prototypeBinary(
  embedding: Vector,
  positive: Vector,
  negative: Vector,
  temperature: number,
): number {
  return sigmoid((cosine(embedding, positive) - cosine(embedding, negative)) / temperature)
}

/** The seed centroids a prototype head needs. */
export interface ChoiceCentroids {
  readonly labels: string[]
  readonly centroids: number[][]
}
export interface BinaryCentroids {
  readonly positive: number[]
  readonly negative: number[]
}
export type QuestionCentroids = ChoiceCentroids | BinaryCentroids

/** A labelled embedding: one seed's vector and whatever labels it carries. */
export interface LabelledEmbedding {
  readonly embedding: Vector
  readonly labels: Readonly<Record<string, string | number | undefined>>
}

/**
 * Centroids for a choice question: one per label that has at least one example.
 * A label with no examples is dropped; the caller sees it missing from `labels`.
 */
export function buildChoiceCentroids(
  rows: readonly LabelledEmbedding[],
  key: string,
  labels: readonly string[],
): ChoiceCentroids {
  const kept: string[] = []
  const centroids: number[][] = []
  for (const label of labels) {
    const members = rows.filter((row) => row.labels[key] === label).map((row) => row.embedding)
    if (members.length === 0) continue
    kept.push(label)
    centroids.push(centroid(members))
  }
  return { labels: kept, centroids }
}

/** Centroids for a binary question, or `undefined` when either class has no examples. */
export function buildBinaryCentroids(
  rows: readonly LabelledEmbedding[],
  key: string,
): BinaryCentroids | undefined {
  const positive = rows.filter((row) => row.labels[key] === 1).map((row) => row.embedding)
  const negative = rows.filter((row) => row.labels[key] === 0).map((row) => row.embedding)
  if (positive.length === 0 || negative.length === 0) return undefined
  return { positive: centroid(positive), negative: centroid(negative) }
}
