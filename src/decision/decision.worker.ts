import * as Comlink from 'comlink'

import type { DecisionProbs, DecisionQuestionKey } from '@/domain'

// onnxruntime-web's CPU build, served by us. transformers.js would otherwise fetch these from a
// CDN, which the CSP (`script-src 'self'`) refuses. `?url` makes Vite emit them as hashed assets.
import ortFactoryUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url'
import ortWasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url'

import {
  BUILTIN_MANIFEST,
  MAX_TOKENS,
  resolveQuestions,
  type Manifest,
  type ResolvedQuestion,
  type SeedRow,
  DEFAULT_REMOTE_HOST,
} from './contract'
import {
  CentroidSetSchema,
  computeCentroids,
  evaluateEmbedding,
  type CentroidSet,
} from './evaluate'
import { normalize } from './heads'

/**
 * The decision model's worker: loads the encoder, embeds text and runs the heads.
 *
 * Why a worker: the encoder is ~23 MB of int8 weights and a forward pass is a few milliseconds of
 * pure CPU. Neither belongs on the main thread (CONTRIBUTING: nothing heavier than ~5 ms).
 *
 * Why the caller passes seeds and any cached centroids in: persistence is `@/data`'s job and the
 * main thread already has it, so this file stays storage-free.
 */

export interface WorkerLoadConfig {
  readonly manifest: Manifest
  readonly seeds: readonly SeedRow[]
  /** A previously computed centroid set for this exact encoder + seeds, or `null`. */
  readonly cachedCentroids: unknown
}

export interface WorkerLoadResult {
  readonly backend: 'wasm'
  /** Output width of the encoder. */
  readonly dim: number
  readonly loadMs: number
  readonly centroids: CentroidSet
  /** True when the centroids were computed now and the caller should cache them. */
  readonly centroidsComputed: boolean
  readonly unavailable: readonly DecisionQuestionKey[]
}

export interface WorkerDecision {
  readonly probs: DecisionProbs
  readonly latencyMs: number
  readonly modelId: string
}

type Extractor = (
  texts: string | string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>

interface LoadedModel {
  readonly extractor: Extractor
  readonly manifest: Manifest
  readonly questions: readonly ResolvedQuestion[]
  readonly centroids: CentroidSet
}

let loaded: LoadedModel | undefined

function absolute(url: string): string {
  return new URL(url, self.location.href).href
}

/** Folds per-file download events into one 0..1 number. */
function createProgressTracker(report: (fraction: number) => void) {
  const files = new Map<string, { loaded: number; total: number }>()
  return (event: unknown): void => {
    if (typeof event !== 'object' || event === null) return
    const info = event as { status?: unknown; file?: unknown; loaded?: unknown; total?: unknown }
    if (typeof info.file !== 'string') return
    if (
      info.status === 'progress' &&
      typeof info.loaded === 'number' &&
      typeof info.total === 'number'
    ) {
      files.set(info.file, { loaded: info.loaded, total: info.total })
    } else if (info.status === 'done') {
      const known = files.get(info.file)
      if (known) files.set(info.file, { loaded: known.total, total: known.total })
    } else {
      return
    }
    let have = 0
    let want = 0
    for (const entry of files.values()) {
      have += entry.loaded
      want += entry.total
    }
    if (want > 0) report(Math.min(1, have / want))
  }
}

async function embedWith(extractor: Extractor, texts: readonly string[]): Promise<number[][]> {
  const output = await extractor([...texts], { pooling: 'mean', normalize: true })
  return output.tolist().map((row) => normalize(row))
}

const api = {
  async load(
    config: WorkerLoadConfig,
    onProgress: (fraction: number) => void,
  ): Promise<WorkerLoadResult> {
    const started = performance.now()
    const { manifest } = config
    const { pipeline, env } = await import('@huggingface/transformers')

    // Weights come from the Hub (or the manifest's host) and are kept by the browser's Cache API.
    env.allowLocalModels = false
    env.allowRemoteModels = true
    env.useBrowserCache = true
    env.remoteHost = manifest.encoder.remoteHost ?? DEFAULT_REMOTE_HOST
    const wasm = env.backends.onnx.wasm
    if (wasm !== undefined) {
      wasm.wasmPaths = { mjs: absolute(ortFactoryUrl), wasm: absolute(ortWasmUrl) }
      // One thread: the model is tiny, and a thread pool needs cross-origin isolation.
      wasm.numThreads = 1
      wasm.proxy = false
    }

    const extractor = (await pipeline('feature-extraction', manifest.encoder.model, {
      dtype: manifest.encoder.dtype as 'q8',
      device: 'wasm',
      progress_callback: createProgressTracker(onProgress),
    })) as unknown as Extractor
    // The shared contract reads at most 128 tokens. The tokenizer's `model_max_length` is a
    // getter over its config, and the config is the only place the truncation length is read.
    const tokenizer = (
      extractor as unknown as { tokenizer?: { _tokenizerConfig?: { model_max_length?: number } } }
    ).tokenizer
    if (tokenizer?._tokenizerConfig !== undefined) {
      tokenizer._tokenizerConfig.model_max_length = MAX_TOKENS
    }

    const probe = await embedWith(extractor, ['hello'])
    const dim = probe[0]?.length ?? 0

    const { questions, unavailable } = resolveQuestions(manifest, BUILTIN_MANIFEST)
    for (const question of questions) {
      if (question.head.type !== 'linear') continue
      const first = question.head.weights[0]
      const width = typeof first === 'number' ? question.head.weights.length : (first?.length ?? 0)
      if (width !== dim) {
        throw new Error(
          `The "${question.key}" head expects ${String(width)}-wide embeddings but ${manifest.encoder.model} produces ${String(dim)}`,
        )
      }
    }

    let centroids: CentroidSet = {}
    let centroidsComputed = false
    const cached = CentroidSetSchema.safeParse(config.cachedCentroids)
    const needsCentroids = questions.some((question) => question.head.type === 'prototype')
    if (needsCentroids) {
      if (cached.success) {
        centroids = cached.data
      } else {
        const vectors = await embedWith(
          extractor,
          config.seeds.map((seed) => seed.text),
        )
        centroids = computeCentroids(config.seeds, vectors, questions)
        centroidsComputed = true
      }
    }

    loaded = { extractor, manifest, questions, centroids }
    onProgress(1)
    return {
      backend: 'wasm',
      dim,
      loadMs: Math.round(performance.now() - started),
      centroids,
      centroidsComputed,
      unavailable,
    }
  },

  async embed(texts: string[]): Promise<number[][]> {
    if (loaded === undefined) throw new Error('The decision model is not loaded')
    return embedWith(loaded.extractor, texts)
  },

  async decide(text: string): Promise<WorkerDecision> {
    if (loaded === undefined) throw new Error('The decision model is not loaded')
    const started = performance.now()
    const [embedding] = await embedWith(loaded.extractor, [text])
    if (embedding === undefined) throw new Error('The encoder returned nothing')
    const { probs } = evaluateEmbedding(embedding, loaded.questions, loaded.centroids)
    return {
      probs,
      latencyMs: Math.round((performance.now() - started) * 10) / 10,
      modelId: loaded.manifest.id,
    }
  },
}

export type DecisionWorkerApi = typeof api

Comlink.expose(api)
