import * as Comlink from 'comlink'

import { assertValid, type EngineInfo } from '@/domain'

import { UciDriver } from './driver'
import {
  type EngineInitConfig,
  EngineInitConfigSchema,
  type SearchRequest,
  SearchRequestSchema,
  type SearchResult,
  type SearchUpdate,
} from './protocol'
import { createStockfishTransport } from './stockfish-transport'

/**
 * S07 · the worker that owns one Stockfish instance.
 *
 * Everything expensive happens here: the WASM compile, the pthread pool, the UCI
 * line parsing and the coalescing of `info` records into snapshots. The main
 * thread only ever sees a handful of validated objects per second.
 *
 * Why the arguments are re-validated even though Comlink types them: they arrive
 * as structured-cloned `unknown` from another realm. §5 — every worker message is
 * checked before it is trusted.
 */

/** The shape `Comlink.wrap` sees on the main thread. */
export interface EngineWorkerApi {
  init(config: EngineInitConfig): Promise<EngineInfo>
  search(request: SearchRequest, onUpdate: (update: SearchUpdate) => void): Promise<SearchResult>
  stop(): Promise<void>
  dispose(): Promise<void>
}

class EngineWorkerHost implements EngineWorkerApi {
  #driver: UciDriver | undefined
  #fatal: Error | undefined

  async init(config: EngineInitConfig): Promise<EngineInfo> {
    const valid = assertValid(EngineInitConfigSchema, config, 'engine worker: init config')
    if (this.#driver !== undefined) throw new Error('engine worker: already initialised')

    const transport = createStockfishTransport(valid.scriptUrl, (error) => {
      this.#fatal = error
    })
    const driver = new UciDriver(transport, { updateIntervalMs: valid.updateIntervalMs })
    this.#driver = driver
    try {
      return await driver.initialise(valid)
    } catch (cause) {
      driver.dispose()
      this.#driver = undefined
      throw this.#fatal ?? cause
    }
  }

  async search(
    request: SearchRequest,
    onUpdate: (update: SearchUpdate) => void,
  ): Promise<SearchResult> {
    const driver = this.#driver
    if (driver === undefined) throw new Error('engine worker: search before init')
    const valid = assertValid(SearchRequestSchema, request, 'engine worker: search request')
    // The callback is a Comlink proxy: calling it posts a message and does not
    // wait, which is what keeps the search running at the engine's pace rather
    // than the main thread's.
    return driver.search(valid, onUpdate)
  }

  async stop(): Promise<void> {
    this.#driver?.stop()
    return Promise.resolve()
  }

  async dispose(): Promise<void> {
    this.#driver?.dispose()
    this.#driver = undefined
    return Promise.resolve()
  }
}

Comlink.expose(new EngineWorkerHost())
