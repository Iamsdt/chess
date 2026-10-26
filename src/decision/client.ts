import * as Comlink from 'comlink'

import { defineKvKey, kvRepo } from '@/data'

import { resolveQuestions, SeedsSchema, BUILTIN_MANIFEST, type Manifest } from './contract'
import { centroidCacheHash, CentroidSetSchema } from './evaluate'
import seedsJson from './seeds.json'

import type { DecisionWorkerApi, WorkerDecision, WorkerLoadResult } from './decision.worker'

/** What the engine knows after a successful load. */
export type DecisionClientLoad = Pick<
  WorkerLoadResult,
  'backend' | 'dim' | 'loadMs' | 'unavailable'
>

/**
 * The main thread's handle on the decision worker.
 *
 * The engine talks to this interface and nothing else, so it is tested with a scripted client and
 * no `Worker`. Seeds and the centroid cache are handled here, on the main thread, because the
 * worker is storage-free.
 */
export interface DecisionClient {
  load(manifest: Manifest, onProgress: (fraction: number) => void): Promise<DecisionClientLoad>
  embed(texts: readonly string[]): Promise<number[][]>
  decide(text: string): Promise<WorkerDecision>
  dispose(): void
}

const KV_PREFIX = 'decision-centroids:'

/**
 * Embedding the seeds takes a couple of seconds on a laptop, so it happens once per
 * (encoder, seeds) pair and the result is cached in IndexedDB under a key that names both.
 */
export function createWorkerDecisionClient(): DecisionClient {
  const worker = new Worker(new URL('./decision.worker.ts', import.meta.url), {
    type: 'module',
    name: 'decision',
  })
  const remote = Comlink.wrap<DecisionWorkerApi>(worker)

  return {
    async load(manifest, onProgress) {
      const seeds = SeedsSchema.parse(seedsJson)
      const { questions } = resolveQuestions(manifest, BUILTIN_MANIFEST)
      const key = defineKvKey(
        `${KV_PREFIX}${centroidCacheHash(manifest.encoder, seeds, questions)}`,
        CentroidSetSchema,
      )
      const cached = (await kvRepo.get(key)) ?? null
      const result = await remote.load(
        { manifest, seeds, cachedCentroids: cached },
        Comlink.proxy(onProgress),
      )
      if (result.centroidsComputed) await kvRepo.set(key, result.centroids)
      return {
        backend: result.backend,
        dim: result.dim,
        loadMs: result.loadMs,
        unavailable: result.unavailable,
      }
    },
    embed: (texts) => remote.embed([...texts]),
    decide: (text) => remote.decide(text),
    dispose() {
      remote[Comlink.releaseProxy]()
      worker.terminate()
    },
  }
}
