import { describe, expect, it } from 'vitest'

import {
  type EngineEnvironment,
  engineScriptUrl,
  engineWasmUrl,
  planEngineResources,
} from './capabilities'

const isolated: EngineEnvironment = {
  hardwareConcurrency: 8,
  deviceMemoryGb: 8,
  hasSharedArrayBuffer: true,
  crossOriginIsolated: true,
}

describe('planEngineResources', () => {
  it('uses min(hardwareConcurrency - 1, 4) threads under cross-origin isolation', () => {
    expect(planEngineResources(isolated)).toMatchObject({
      build: 'mt',
      multiThreaded: true,
      threads: 4,
      batchThreads: 2,
      maxWorkers: 3,
    })
    expect(planEngineResources({ ...isolated, hardwareConcurrency: 4 })).toMatchObject({
      threads: 3,
      batchThreads: 1,
      maxWorkers: 2,
    })
    expect(planEngineResources({ ...isolated, hardwareConcurrency: 2 })).toMatchObject({
      threads: 1,
      maxWorkers: 1,
    })
  })

  it('falls back to the single-threaded build without SharedArrayBuffer', () => {
    expect(planEngineResources({ ...isolated, hasSharedArrayBuffer: false })).toMatchObject({
      build: 'st',
      multiThreaded: false,
      threads: 1,
      batchThreads: 1,
    })
  })

  it('falls back when SharedArrayBuffer exists but the page is not isolated', () => {
    // Why this case matters: Firefox exposes the constructor without isolation,
    // and the multi-threaded build would fail at first `postMessage`.
    expect(planEngineResources({ ...isolated, crossOriginIsolated: false })).toMatchObject({
      build: 'st',
      multiThreaded: false,
    })
  })

  it('sizes the hash from reported memory, with a floor and a ceiling', () => {
    expect(planEngineResources({ ...isolated, deviceMemoryGb: null }).hashMb).toBe(16)
    expect(planEngineResources({ ...isolated, deviceMemoryGb: 0.5 }).hashMb).toBe(16)
    expect(planEngineResources({ ...isolated, deviceMemoryGb: 4 }).hashMb).toBe(32)
    expect(planEngineResources({ ...isolated, deviceMemoryGb: 8 }).hashMb).toBe(64)
    expect(planEngineResources({ ...isolated, deviceMemoryGb: 64 }).hashMb).toBe(128)
  })

  it('never plans fewer than one thread or one worker', () => {
    const plan = planEngineResources({ ...isolated, hardwareConcurrency: 1 })
    expect(plan.threads).toBe(1)
    expect(plan.batchThreads).toBe(1)
    expect(plan.maxWorkers).toBe(1)
  })
})

describe('engine asset URLs', () => {
  it('resolves both builds against the app base', () => {
    expect(engineScriptUrl('mt', '/')).toBe('/engine/stockfish-19-lite.js')
    expect(engineWasmUrl('mt', '/')).toBe('/engine/stockfish-19-lite.wasm')
    expect(engineScriptUrl('st', '/chess/')).toBe('/chess/engine/stockfish-19-lite-single.js')
    expect(engineWasmUrl('st', '/chess')).toBe('/chess/engine/stockfish-19-lite-single.wasm')
  })
})
