import { describe, expect, it, vi } from 'vitest'

import { UciDriver, type UciTransport } from './driver'
import { type EngineInitConfig, type SearchUpdate } from './protocol'
import { START_REQUEST } from './testing/requests'

/** Let every queued microtask run, which is how the driver advances a step. */
const flush = async (): Promise<void> => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve()
}

function createRecordingTransport(): {
  transport: UciTransport
  sent: string[]
  emit: (...lines: string[]) => void
  isTerminated: () => boolean
} {
  const sent: string[] = []
  const handlers = new Set<(line: string) => void>()
  let terminated = false
  return {
    sent,
    isTerminated: () => terminated,
    emit: (...lines: string[]) => {
      for (const line of lines) for (const handler of [...handlers]) handler(line)
    },
    transport: {
      send: (command) => {
        sent.push(command)
      },
      subscribe: (handler) => {
        handlers.add(handler)
        return () => handlers.delete(handler)
      },
      terminate: () => {
        terminated = true
      },
    },
  }
}

const CONFIG: EngineInitConfig = {
  build: 'mt',
  scriptUrl: '/engine/stockfish-19-lite.js',
  threads: 4,
  hashMb: 64,
  updateIntervalMs: 0,
}

interface Session {
  driver: UciDriver
  sent: string[]
  emit: (...lines: string[]) => void
  isTerminated: () => boolean
}

/** Run the handshake so each test can start where the interesting part begins. */
async function openSession(
  overrides: Partial<EngineInitConfig> = {},
  options: { threadsMax?: number } = {},
): Promise<Session> {
  const harness = createRecordingTransport()
  const driver = new UciDriver(harness.transport, { updateIntervalMs: 0 })
  const init = driver.initialise({ ...CONFIG, ...overrides })
  await flush()
  harness.emit(
    'id name Stockfish 19 Lite WASM Multithreaded',
    `option name Threads type spin default 1 min 1 max ${String(options.threadsMax ?? 32)}`,
    'option name Hash type spin default 16 min 1 max 33554432',
    'uciok',
  )
  await flush()
  harness.emit('readyok')
  await flush()
  harness.emit('readyok')
  await init
  harness.sent.length = 0
  return { driver, sent: harness.sent, emit: harness.emit, isTerminated: harness.isTerminated }
}

describe('UciDriver.initialise', () => {
  it('handshakes, sizes the engine and reports what loaded', async () => {
    const harness = createRecordingTransport()
    const driver = new UciDriver(harness.transport, { updateIntervalMs: 0 })
    const init = driver.initialise(CONFIG)

    await flush()
    expect(harness.sent).toEqual(['uci'])

    harness.emit(
      'id name Stockfish 19 Lite WASM Multithreaded',
      'option name Threads type spin default 1 min 1 max 32',
      'uciok',
    )
    await flush()
    expect(harness.sent).toEqual([
      'uci',
      'setoption name Threads value 4',
      'setoption name Hash value 64',
      'isready',
    ])

    harness.emit('readyok')
    await flush()
    expect(harness.sent).toContain('ucinewgame')

    harness.emit('readyok')
    await expect(init).resolves.toEqual({
      name: 'Stockfish 19 Lite WASM Multithreaded',
      multiThreaded: true,
      threads: 4,
      hashMb: 64,
    })
  })

  it('believes the engine, not the plan, about how many threads it has', async () => {
    // The single-threaded build advertises `max 1`, so asking for four is a
    // fallback that reports itself honestly rather than a broken engine.
    const harness = createRecordingTransport()
    const driver = new UciDriver(harness.transport, { updateIntervalMs: 0 })
    const init = driver.initialise(CONFIG)
    await flush()
    harness.emit(
      'id name Stockfish 19 Lite WASM',
      'option name Threads type spin default 1 min 1 max 1',
      'uciok',
    )
    await flush()
    harness.emit('readyok')
    await flush()
    harness.emit('readyok')
    await expect(init).resolves.toMatchObject({ multiThreaded: false, threads: 1 })
  })

  it('gives up when the engine never answers', async () => {
    vi.useFakeTimers()
    try {
      const harness = createRecordingTransport()
      const driver = new UciDriver(harness.transport, { handshakeTimeoutMs: 100 })
      const init = driver.initialise(CONFIG)
      const assertion = expect(init).rejects.toThrow(/did not answer/)
      await vi.advanceTimersByTimeAsync(200)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('UciDriver.search', () => {
  it('sets options, sends the position and streams snapshots', async () => {
    const session = await openSession()
    const updates: SearchUpdate[] = []
    const search = session.driver.search({ ...START_REQUEST, multiPv: 2 }, (update) => {
      updates.push(update)
    })

    await flush()
    expect(session.sent).toEqual([
      'setoption name MultiPV value 2',
      'setoption name UCI_ShowWDL value true',
      'setoption name UCI_LimitStrength value false',
      'setoption name Skill Level value 20',
      'isready',
    ])

    session.emit('readyok')
    await flush()
    expect(session.sent.slice(-2)).toEqual([`position fen ${START_REQUEST.fen}`, 'go depth 12'])

    session.emit(
      'info depth 8 multipv 1 score cp 23 wdl 44 948 8 nodes 6418 nps 377529 time 17 pv e2e4 e7e5',
      'info depth 8 multipv 2 score cp 21 nodes 6418 nps 377529 time 17 pv d2d4 g8f6',
    )
    await flush()
    expect(updates.at(-1)?.lines.map((line) => line.multipv)).toEqual([1, 2])
    expect(updates.at(-1)?.nps).toBe(377529)

    session.emit('bestmove e2e4 ponder e7e5')
    const result = await search
    expect(result).toMatchObject({
      bestMove: 'e2e4',
      ponder: 'e7e5',
      depth: 8,
      stoppedEarly: false,
      score: { kind: 'cp', value: 23 },
    })
    expect(result.lines).toHaveLength(2)
  })

  it('re-sends only the options that changed', async () => {
    const session = await openSession()
    const first = session.driver.search(START_REQUEST, () => undefined)
    await flush()
    session.emit('readyok')
    await flush()
    session.emit('bestmove e2e4')
    await first

    session.sent.length = 0
    const second = session.driver.search({ ...START_REQUEST, id: 'search-2' }, () => undefined)
    await flush()
    expect(session.sent).toEqual([`position fen ${START_REQUEST.fen}`, 'go depth 12'])
    session.emit('bestmove e2e4')
    await second
  })

  it('ignores a fail-high score instead of showing a line that was never true', async () => {
    const session = await openSession()
    const updates: SearchUpdate[] = []
    const search = session.driver.search(START_REQUEST, (update) => {
      updates.push(update)
    })
    await flush()
    session.emit('readyok')
    await flush()

    session.emit('info depth 9 multipv 1 score cp 900 lowerbound nodes 12 nps 100 pv e2e4')
    await flush()
    expect(updates.at(-1)?.lines).toEqual([])

    session.emit('bestmove e2e4')
    await search
  })

  it('reports a stopped search as a shorter answer, not a failure', async () => {
    const session = await openSession()
    const search = session.driver.search(START_REQUEST, () => undefined)
    await flush()
    session.emit('readyok')
    await flush()
    session.emit('info depth 6 multipv 1 score cp 12 pv e2e4')
    session.driver.stop()
    expect(session.sent).toContain('stop')

    session.emit('bestmove e2e4')
    await expect(search).resolves.toMatchObject({ stoppedEarly: true, depth: 6 })
  })

  it('carries a score through a position with no legal move', async () => {
    const session = await openSession()
    const search = session.driver.search(START_REQUEST, () => undefined)
    await flush()
    session.emit('readyok')
    await flush()
    session.emit('info depth 0 score mate 0')
    session.emit('bestmove (none)')
    await expect(search).resolves.toMatchObject({
      bestMove: null,
      lines: [],
      score: { kind: 'mate', moves: 0 },
    })
  })

  it('refuses a second search on the same engine', async () => {
    const session = await openSession()
    const first = session.driver.search(START_REQUEST, () => undefined)
    await flush()
    session.emit('readyok')
    await flush()
    await expect(session.driver.search(START_REQUEST, () => undefined)).rejects.toThrow(
      /already running/,
    )
    session.emit('bestmove e2e4')
    await first
  })

  it('refuses a search with no limit, which would never end', async () => {
    const session = await openSession()
    const { depth: _depth, ...unlimited } = START_REQUEST
    await expect(session.driver.search(unlimited, () => undefined)).rejects.toThrow(
      /depth, movetime or nodes/,
    )
  })

  it('fails the search it was in the middle of when disposed', async () => {
    const session = await openSession()
    const search = session.driver.search(START_REQUEST, () => undefined)
    await flush()
    session.emit('readyok')
    await flush()
    session.driver.dispose()
    await expect(search).rejects.toThrow(/disposed/)
    expect(session.isTerminated()).toBe(true)
  })
})
