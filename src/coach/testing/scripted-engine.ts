import {
  createEngine,
  type Engine,
  type EngineEnvironment,
  type SearchRequest,
  type SearchResult,
} from '@/engine'
import { createFakeEngineFleet } from '@/engine/testing/fake-engine'

/**
 * A real `Engine` over the fake worker fleet that answers every search from a script.
 *
 * Why: the coach tools call `engine.evaluate` dozens of times per answer. Driving the fake
 * fleet by hand (as the engine's own tests do) would bury each test in `finish()` calls;
 * here the test says what the engine thinks of a position and the tool runs unchanged.
 */

export type EngineScript = (request: SearchRequest) => Partial<Omit<SearchResult, 'id'>>

export interface ScriptedEngine {
  readonly engine: Engine
  /** Every request the tools made, in order. */
  readonly requests: readonly SearchRequest[]
  dispose(): Promise<void>
}

const ENVIRONMENT: EngineEnvironment = {
  hardwareConcurrency: 8,
  deviceMemoryGb: 8,
  hasSharedArrayBuffer: true,
  crossOriginIsolated: true,
}

export function createScriptedEngine(script: EngineScript): ScriptedEngine {
  const fleet = createFakeEngineFleet()
  const engine = createEngine({ spawn: fleet.factory, environment: ENVIRONMENT, baseUrl: '/' })
  const requests: SearchRequest[] = []
  const answered = new Set<string>()

  const timer = setInterval(() => {
    for (const client of fleet.clients) {
      for (const search of client.searches) {
        if (search.finished || answered.has(search.request.id)) continue
        answered.add(search.request.id)
        requests.push(search.request)
        search.finish(script(search.request))
      }
    }
  }, 1)

  return {
    engine,
    requests,
    async dispose() {
      clearInterval(timer)
      await engine.shutdown()
    },
  }
}
