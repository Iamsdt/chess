import { describe, expect, it } from 'vitest'

import { type EngineLine, makeEngineLine, START_FEN, toUci } from '@/domain'

import { type EngineEnvironment } from './capabilities'
import { createEngine } from './engine'
import { createFakeEngineFleet, type FakeEngineFleet } from './testing/fake-engine'

const flush = async (): Promise<void> => {
  for (let index = 0; index < 16; index += 1) await Promise.resolve()
}

const ENVIRONMENT: EngineEnvironment = {
  hardwareConcurrency: 8,
  deviceMemoryGb: 8,
  hasSharedArrayBuffer: true,
  crossOriginIsolated: true,
}

function setUp(): { fleet: FakeEngineFleet; engine: ReturnType<typeof createEngine> } {
  const fleet = createFakeEngineFleet()
  const engine = createEngine({ spawn: fleet.factory, environment: ENVIRONMENT, baseUrl: '/' })
  return { fleet, engine }
}

const liveSearch = (fleet: FakeEngineFleet, index = 0) => fleet.clients[index]?.current

describe('engine.bestMove', () => {
  it('asks the play lane for a move and returns the line it came from', async () => {
    const { fleet, engine } = setUp()
    const pending = engine.bestMove(START_FEN)
    await flush()

    const search = liveSearch(fleet)
    expect(search?.request).toMatchObject({
      lane: 'play',
      multiPv: 1,
      movetimeMs: 1000,
      showWdl: true,
      strength: { elo: null },
    })

    search?.finish({ lines: [makeEngineLine({ pv: [toUci('d2d4'), toUci('d7d5')] })] })
    const result = await pending
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.move).toBe('d2d4')
    expect(result.value.eval).toMatchObject({ fen: START_FEN, lane: 'play' })
    expect(result.value.eval.engine).toMatchObject({ threads: 4, multiThreaded: true })
    await engine.shutdown()
  })

  it('applies the strength dial until it is changed', async () => {
    const { fleet, engine } = setUp()
    engine.setStrength(1500)
    const first = engine.bestMove(START_FEN)
    await flush()
    expect(liveSearch(fleet)?.request.strength).toEqual({ elo: 1500 })
    liveSearch(fleet)?.finish()
    await first

    const second = engine.bestMove(START_FEN, { elo: 2400 })
    await flush()
    expect(liveSearch(fleet)?.request.strength).toEqual({ elo: 2400 })
    liveSearch(fleet)?.finish()
    await second

    engine.setStrength(null)
    const third = engine.bestMove(START_FEN)
    await flush()
    expect(liveSearch(fleet)?.request.strength).toEqual({ elo: null })
    liveSearch(fleet)?.finish()
    await third
    await engine.shutdown()
  })

  it('needs several lines before a personality can choose between them', async () => {
    const { fleet, engine } = setUp()
    const pending = engine.bestMove(START_FEN, { personality: 'aggressive' })
    await flush()
    expect(liveSearch(fleet)?.request.multiPv).toBe(3)

    const lines: EngineLine[] = [
      makeEngineLine({
        multipv: 1,
        score: { kind: 'cp', value: 30 },
        pv: [toUci('e2e4')],
        wdl: { win: 200, draw: 780, loss: 20 },
      }),
      makeEngineLine({
        multipv: 2,
        score: { kind: 'cp', value: 20 },
        pv: [toUci('g1f3')],
        wdl: { win: 420, draw: 380, loss: 200 },
      }),
    ]
    liveSearch(fleet)?.finish({ lines, bestMove: toUci('e2e4') })

    const result = await pending
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.move).toBe('g1f3')
      expect(result.value.line?.multipv).toBe(2)
      // Pondering only makes sense on the move the engine itself expects.
      expect(result.value.ponder).toBeNull()
    }
    await engine.shutdown()
  })

  it('reports a finished position as no move rather than an error', async () => {
    const { fleet, engine } = setUp()
    const pending = engine.bestMove(START_FEN)
    await flush()
    liveSearch(fleet)?.finish({
      lines: [],
      bestMove: null,
      score: { kind: 'mate', moves: 0 },
      depth: 0,
    })
    const result = await pending
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.move).toBeNull()
    await engine.shutdown()
  })
})

describe('engine.analyse', () => {
  it('streams snapshots on the interactive lane and returns the finished evaluation', async () => {
    const { fleet, engine } = setUp()
    const iterator = engine.analyse(START_FEN, { multiPv: 2 })

    const first = iterator.next()
    await flush()
    expect(liveSearch(fleet)?.request).toMatchObject({ lane: 'interactive', multiPv: 2, depth: 22 })

    liveSearch(fleet)?.emit({ depth: 12, lines: [makeEngineLine({ depth: 12 })] })
    const firstYield = await first
    expect(firstYield.done).toBe(false)
    expect(firstYield.value).toHaveLength(1)

    const second = iterator.next()
    liveSearch(fleet)?.finish({ depth: 22 })
    const final = await second
    expect(final.done).toBe(true)
    const returned = final.value
    expect(returned).toMatchObject({ ok: true })
    if (typeof returned === 'object' && 'ok' in returned && returned.ok) {
      expect(returned.value).toMatchObject({ depth: 22, lane: 'interactive' })
    }
    await engine.shutdown()
  })

  it('stops the engine when the consumer stops listening', async () => {
    const { fleet, engine } = setUp()
    const seen: number[] = []
    const loop = (async () => {
      for await (const lines of engine.analyse(START_FEN)) {
        seen.push(lines.length)
        break
      }
    })()

    await flush()
    liveSearch(fleet)?.emit({ depth: 8 })
    await loop

    expect(seen).toEqual([1])
    expect(fleet.clients[0]?.searches[0]?.stopped).toBe(true)
    await engine.shutdown()
  })

  it('stops the engine when the abort signal fires', async () => {
    const { fleet, engine } = setUp()
    const controller = new AbortController()
    const iterator = engine.analyse(START_FEN, { signal: controller.signal })
    const first = iterator.next()
    await flush()

    controller.abort()
    const settled = await first
    expect(settled.done).toBe(true)
    expect(fleet.clients[0]?.searches[0]?.stopped).toBe(true)
    await engine.shutdown()
  })
})

describe('engine.evaluate', () => {
  it('runs on the batch lane so a review cannot delay a move', async () => {
    const { fleet, engine } = setUp()
    const pending = engine.evaluate(START_FEN)
    await flush()
    expect(liveSearch(fleet)?.request).toMatchObject({ lane: 'batch', multiPv: 1, depth: 16 })

    liveSearch(fleet)?.finish({ depth: 16, nodes: 120_000, nps: 900_000, timeMs: 133 })
    const result = await pending
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({ lane: 'batch', depth: 16, nps: 900_000 })
      expect(result.value.computedAt).toBeGreaterThan(0)
    }
    await engine.shutdown()
  })

  it('returns a failure value when the engine cannot start', async () => {
    const fleet = createFakeEngineFleet({ failInit: () => true })
    const engine = createEngine({ spawn: fleet.factory, environment: ENVIRONMENT, baseUrl: '/' })
    const result = await engine.evaluate(START_FEN)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('engine')
    await engine.shutdown()
  })
})

describe('engine.capabilities', () => {
  it('reports the plan without starting an engine', () => {
    const { fleet, engine } = setUp()
    expect(engine.plannedCapabilities()).toMatchObject({
      build: 'mt',
      threads: 4,
      maxWorkers: 3,
      engine: null,
    })
    expect(fleet.clients).toHaveLength(0)
  })

  it('reports the engine that actually loaded once one has', async () => {
    const { engine } = setUp()
    const capabilities = await engine.capabilities()
    expect(capabilities.ok).toBe(true)
    if (capabilities.ok) {
      expect(capabilities.value.engine).toMatchObject({ multiThreaded: true, threads: 4 })
    }
    expect(engine.telemetry().workers).toHaveLength(1)
    await engine.shutdown()
  })
})
