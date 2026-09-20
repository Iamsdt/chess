import * as Comlink from 'comlink'

import { assertValid, type EngineInfo, EngineInfoSchema, parseValid } from '@/domain'

import { type EngineWorkerApi } from './engine.worker'
import {
  type EngineInitConfig,
  type SearchRequest,
  type SearchResult,
  SearchResultSchema,
  type SearchUpdate,
  SearchUpdateSchema,
} from './protocol'

/**
 * The main thread's handle on one engine worker.
 *
 * The pool talks to this interface and nothing else, which is why the pool can be
 * tested with a scripted client and no `Worker` at all.
 */
export interface EngineClient {
  readonly id: string
  init(config: EngineInitConfig): Promise<EngineInfo>
  search(request: SearchRequest, onUpdate: (update: SearchUpdate) => void): Promise<SearchResult>
  /** Ask the current search to end early; the `search` promise still settles. */
  stop(): Promise<void>
  dispose(): Promise<void>
}

/** How the pool makes an engine. Swapped in tests, and in the benchmark script. */
export type EngineClientFactory = (id: string) => Promise<EngineClient>

/**
 * Spawn the real worker and wrap it in Comlink.
 *
 * Why everything coming back is validated: the worker is a separate realm, and
 * after a deploy it can even be a *previous build* of the worker that the browser
 * kept alive. Types do not survive that; schemas do.
 */
export function createWorkerEngineClient(id: string): EngineClient {
  const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), {
    type: 'module',
    name: `engine-${id}`,
  })
  const remote = Comlink.wrap<EngineWorkerApi>(worker)

  return {
    id,
    async init(config: EngineInitConfig): Promise<EngineInfo> {
      const info: unknown = await remote.init(config)
      return assertValid(EngineInfoSchema, info, `engine client ${id}: init`)
    },
    async search(
      request: SearchRequest,
      onUpdate: (update: SearchUpdate) => void,
    ): Promise<SearchResult> {
      const result: unknown = await remote.search(
        request,
        Comlink.proxy((update: SearchUpdate) => {
          const parsed = parseValid(SearchUpdateSchema, update, `engine client ${id}: update`)
          // A malformed snapshot is dropped rather than shown: the search is still
          // running and the next snapshot is 80 ms away.
          if (parsed.ok) onUpdate(parsed.value)
          else console.warn(parsed.error.message, parsed.error.details)
        }),
      )
      return assertValid(SearchResultSchema, result, `engine client ${id}: search result`)
    },
    async stop(): Promise<void> {
      await remote.stop()
    },
    async dispose(): Promise<void> {
      try {
        await remote.dispose()
      } finally {
        remote[Comlink.releaseProxy]()
        worker.terminate()
      }
    },
  }
}
