import { afterEach, describe, expect, it, vi } from 'vitest'

import { type EngineEnvironment } from './capabilities'
import { EnginePool, type PoolSubmission } from './pool'
import { type SearchRequest } from './protocol'
import { createFakeEngineFleet, type FakeEngineOptions } from './testing/fake-engine'
import { START_REQUEST } from './testing/requests'

const flush = async (): Promise<void> => {
  for (let index = 0; index < 16; index += 1) await Promise.resolve()
}

/** Two cores: one engine at a time, which is where the lane rules are visible. */
const ONE_ENGINE: EngineEnvironment = {
  hardwareConcurrency: 2,
  deviceMemoryGb: 4,
  hasSharedArrayBuffer: true,
  crossOriginIsolated: true,
}

const EIGHT_CORE: EngineEnvironment = { ...ONE_ENGINE, hardwareConcurrency: 8 }

function setUp(
  environment: EngineEnvironment = ONE_ENGINE,
  options: { fake?: FakeEngineOptions; idleShutdownMs?: number } = {},
) {
  const fleet = createFakeEngineFleet(options.fake)
  const pool = new EnginePool({
    spawn: fleet.factory,
    environment,
    baseUrl: '/',
    idleShutdownMs: options.idleShutdownMs ?? 30_000,
  })
  return { fleet, pool }
}

function submission(request: Partial<SearchRequest>, extra: Partial<PoolSubmission> = {}) {
  const { id: _id, ...rest } = { ...START_REQUEST, ...request }
  return { request: rest, ...extra }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('EnginePool sizing', () => {
  it('gives the first engine the full thread budget and later ones half', async () => {
    const { fleet, pool } = setUp(EIGHT_CORE)
    const first = pool.submit(submission({ lane: 'interactive' }))
    const second = pool.submit(submission({ lane: 'batch' }))
    await flush()

    expect(fleet.clients).toHaveLength(2)
    expect(fleet.clients[0]?.config).toMatchObject({ threads: 4, hashMb: 32, build: 'mt' })
    expect(fleet.clients[1]?.config).toMatchObject({ threads: 2 })

    fleet.clients[0]?.current?.finish()
    fleet.clients[1]?.current?.finish()
    await expect(first).resolves.toMatchObject({ ok: true })
    await expect(second).resolves.toMatchObject({ ok: true })
    await pool.shutdown()
  })

  it('never starts more engines than the machine can carry', async () => {
    const { fleet, pool } = setUp(ONE_ENGINE)
    void pool.submit(submission({ lane: 'interactive' }))
    void pool.submit(submission({ lane: 'interactive' }))
    void pool.submit(submission({ lane: 'interactive' }))
    await flush()
    expect(fleet.clients).toHaveLength(1)
    await pool.shutdown()
  })
})

describe('EnginePool lanes', () => {
  it('runs the most urgent lane first when engines are busy', async () => {
    const { fleet, pool } = setUp(ONE_ENGINE)
    const running = pool.submit(submission({ lane: 'play' }))
    await flush()
    const batch = pool.submit(submission({ lane: 'batch' }))
    const interactive = pool.submit(submission({ lane: 'interactive' }))
    await flush()

    const client = fleet.clients[0]
    expect(client?.searches).toHaveLength(1)

    client?.current?.finish()
    await flush()
    // `interactive` queued after `batch` but outranks it.
    expect(client?.current?.request.lane).toBe('interactive')
    client?.current?.finish()
    await flush()
    expect(client?.current?.request.lane).toBe('batch')
    client?.current?.finish()

    await Promise.all([running, batch, interactive])
    await pool.shutdown()
  })

  it('takes the engine off a background search for a live move, then restarts it', async () => {
    const { fleet, pool } = setUp(ONE_ENGINE)
    const review = pool.submit(submission({ lane: 'batch' }))
    await flush()
    const client = fleet.clients[0]
    expect(client?.current?.request.lane).toBe('batch')

    const move = pool.submit(submission({ lane: 'play' }))
    await flush()
    // The fake engine honours `stop` the way Stockfish does: the search ends.
    expect(client?.searches[0]?.stopped).toBe(true)
    expect(client?.current?.request.lane).toBe('play')

    client?.current?.finish()
    await flush()
    const moveResult = await move
    expect(moveResult.ok).toBe(true)

    // The displaced review is running again, and only settles on its own result.
    expect(client?.current?.request.lane).toBe('batch')
    client?.current?.finish()
    const reviewResult = await review
    expect(reviewResult.ok).toBe(true)
    expect(pool.telemetry().searches.preempted).toBe(1)
    await pool.shutdown()
  })

  it('does not preempt an equal or more urgent lane', async () => {
    const { fleet, pool } = setUp(ONE_ENGINE)
    const first = pool.submit(submission({ lane: 'play' }))
    await flush()
    const second = pool.submit(submission({ lane: 'play' }))
    await flush()

    const client = fleet.clients[0]
    expect(client?.searches).toHaveLength(1)
    expect(client?.searches[0]?.stopped).toBe(false)

    client?.current?.finish()
    await flush()
    client?.current?.finish()
    await Promise.all([first, second])
    await pool.shutdown()
  })
})

describe('EnginePool cancellation', () => {
  it('answers at once and tells the engine to stop', async () => {
    const { fleet, pool } = setUp(ONE_ENGINE, { fake: { autoFinishOnStop: false } })
    const controller = new AbortController()
    const search = pool.submit(submission({ lane: 'interactive' }, { signal: controller.signal }))
    await flush()

    controller.abort()
    const result = await search
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('cancelled')
    expect(fleet.clients[0]?.searches[0]?.stopped).toBe(true)
    await pool.shutdown()
  })

  it('never starts a search that was cancelled before it got an engine', async () => {
    const { fleet, pool } = setUp(ONE_ENGINE)
    const controller = new AbortController()
    void pool.submit(submission({ lane: 'play' }))
    await flush()
    const queued = pool.submit(submission({ lane: 'play' }, { signal: controller.signal }))
    controller.abort()

    const result = await queued
    expect(result.ok).toBe(false)
    expect(fleet.clients[0]?.searches).toHaveLength(1)
    await pool.shutdown()
  })

  it('rejects an already-aborted signal without touching an engine', async () => {
    const { fleet, pool } = setUp(ONE_ENGINE)
    const result = await pool.submit(submission({ lane: 'play' }, { signal: AbortSignal.abort() }))
    expect(result.ok).toBe(false)
    expect(fleet.clients).toHaveLength(0)
    await pool.shutdown()
  })

  it('frees the engine for the next search once the cancelled one stops', async () => {
    const { fleet, pool } = setUp(ONE_ENGINE)
    const controller = new AbortController()
    void pool.submit(submission({ lane: 'interactive' }, { signal: controller.signal }))
    await flush()
    const next = pool.submit(submission({ lane: 'interactive' }))
    controller.abort()
    await flush()

    expect(fleet.clients[0]?.searches).toHaveLength(2)
    fleet.clients[0]?.current?.finish()
    await expect(next).resolves.toMatchObject({ ok: true })
    await pool.shutdown()
  })
})

describe('EnginePool timeouts', () => {
  it('stops a slow search and keeps what it found', async () => {
    vi.useFakeTimers()
    const { fleet, pool } = setUp(ONE_ENGINE)
    const search = pool.submit(submission({ lane: 'batch' }, { timeoutMs: 500 }))
    await flush()
    fleet.clients[0]?.current?.emit({ depth: 9 })

    await vi.advanceTimersByTimeAsync(600)
    const result = await search
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.stoppedEarly).toBe(true)
    expect(pool.telemetry().searches.timedOut).toBe(1)
    await pool.shutdown()
  })

  it('gives up on an engine that ignores stop', async () => {
    vi.useFakeTimers()
    const { pool } = setUp(ONE_ENGINE, { fake: { autoFinishOnStop: false } })
    const search = pool.submit(submission({ lane: 'batch' }, { timeoutMs: 500 }))
    await flush()

    await vi.advanceTimersByTimeAsync(3000)
    const result = await search
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('timeout')
    await pool.shutdown()
  })
})

describe('EnginePool lifecycle', () => {
  it('shuts an idle engine down and starts a fresh one on demand', async () => {
    vi.useFakeTimers()
    const { fleet, pool } = setUp(ONE_ENGINE, { idleShutdownMs: 1000 })
    const first = pool.submit(submission({ lane: 'interactive' }))
    await flush()
    fleet.clients[0]?.current?.finish()
    await first

    await vi.advanceTimersByTimeAsync(1500)
    expect(fleet.clients[0]?.disposed).toBe(true)

    const second = pool.submit(submission({ lane: 'interactive' }))
    await flush()
    expect(fleet.clients).toHaveLength(2)
    fleet.clients[1]?.current?.finish()
    await expect(second).resolves.toMatchObject({ ok: true })
    await pool.shutdown()
  })

  it('reports an engine that will not start as a value', async () => {
    const { pool } = setUp(ONE_ENGINE, { fake: { failInit: () => true } })
    const result = await pool.submit(submission({ lane: 'play' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('engine')
    expect(pool.telemetry().workers).toHaveLength(0)
    await pool.shutdown()
  })

  it('warms up before anything needs the engine', async () => {
    const { fleet, pool } = setUp(EIGHT_CORE)
    const info = await pool.warmUp()
    expect(info).toMatchObject({ ok: true })
    expect(fleet.clients).toHaveLength(1)
    expect(pool.capabilities().engine).toMatchObject({ threads: 4, multiThreaded: true })
    await pool.shutdown()
  })

  it('cancels everything it is holding when shut down', async () => {
    const { fleet, pool } = setUp(ONE_ENGINE, { fake: { autoFinishOnStop: false } })
    const running = pool.submit(submission({ lane: 'play' }))
    await flush()
    const queued = pool.submit(submission({ lane: 'play' }))

    await pool.shutdown()
    expect((await running).ok).toBe(false)
    expect((await queued).ok).toBe(false)
    expect(fleet.clients[0]?.disposed).toBe(true)
    expect((await pool.submit(submission({ lane: 'play' }))).ok).toBe(false)
  })
})

describe('EnginePool telemetry', () => {
  it('reports what is running and what is waiting', async () => {
    const { fleet, pool } = setUp(ONE_ENGINE)
    const seen: number[] = []
    const unsubscribe = pool.subscribeTelemetry((telemetry) => {
      seen.push(telemetry.workers.length)
    })

    const running = pool.submit(submission({ lane: 'play' }))
    await flush()
    const waiting = pool.submit(submission({ lane: 'batch' }))
    await flush()

    const telemetry = pool.telemetry()
    expect(telemetry.lanes.play.running).toBe(1)
    expect(telemetry.lanes.batch.queued).toBe(1)
    expect(telemetry.workers[0]).toMatchObject({ state: 'searching', lane: 'play', threads: 1 })
    expect(seen.length).toBeGreaterThan(0)

    unsubscribe()
    fleet.clients[0]?.current?.finish()
    await flush()
    fleet.clients[0]?.current?.finish()
    await Promise.all([running, waiting])
    expect(pool.telemetry().searches.completed).toBe(2)
    await pool.shutdown()
  })
})
