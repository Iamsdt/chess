import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeEngineLine, START_FEN, toFen, toUci } from '@/domain'
import { createEngine } from '@/engine'
import type { EngineEnvironment } from '@/engine'
import { createFakeEngineFleet, type FakeEngineFleet } from '@/engine/testing/fake-engine'

import { useEngineAnalysis } from './use-engine-analysis'

const ENVIRONMENT: EngineEnvironment = {
  hardwareConcurrency: 8,
  deviceMemoryGb: 8,
  hasSharedArrayBuffer: true,
  crossOriginIsolated: true,
}

/** The fake engine settles on microtasks; this drains enough of them to see it. */
const flush = async (): Promise<void> => {
  await act(async () => {
    for (let index = 0; index < 32; index += 1) await Promise.resolve()
  })
}

function setUp() {
  const fleet = createFakeEngineFleet({ autoFinishOnStop: false })
  return {
    fleet,
    engine: createEngine({ spawn: fleet.factory, environment: ENVIRONMENT, baseUrl: '/' }),
  }
}

/** The search the pool actually started, once it has started one. */
async function liveSearch(fleet: FakeEngineFleet) {
  await waitFor(() => {
    expect(fleet.clients[0]?.current).not.toBeNull()
  })
  const search = fleet.clients[0]?.current
  if (search === undefined || search === null) throw new Error('no search started')
  return search
}

describe('useEngineAnalysis', () => {
  it('searches the position on the interactive lane', async () => {
    const { fleet, engine } = setUp()
    renderHook(() =>
      useEngineAnalysis({ engine, fen: START_FEN, enabled: true, multiPv: 3, depth: 20 }),
    )

    const search = await liveSearch(fleet)
    expect(search.request).toMatchObject({
      lane: 'interactive',
      multiPv: 3,
      depth: 20,
      fen: START_FEN,
    })
    await engine.shutdown()
  })

  it('reports nothing at all while the engine is switched off', async () => {
    const { fleet, engine } = setUp()
    const { result } = renderHook(() =>
      useEngineAnalysis({ engine, fen: START_FEN, enabled: false, multiPv: 3, depth: 20 }),
    )

    await flush()
    expect(result.current.status).toBe('off')
    expect(fleet.clients).toHaveLength(0)
    await engine.shutdown()
  })

  it('paints each snapshot as it arrives', async () => {
    const { fleet, engine } = setUp()
    const { result } = renderHook(() =>
      useEngineAnalysis({ engine, fen: START_FEN, enabled: true, multiPv: 1, depth: 20 }),
    )

    const search = await liveSearch(fleet)
    await act(async () => {
      search.emit({ depth: 12, lines: [makeEngineLine({ depth: 12, pv: [toUci('e2e4')] })] })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.depth).toBe(12)
    })
    expect(result.current.status).toBe('searching')
    expect(result.current.lines[0]?.pv[0]).toBe('e2e4')
    await engine.shutdown()
  })

  it('stops the search the moment the screen goes away', async () => {
    const { fleet, engine } = setUp()
    const { unmount } = renderHook(() =>
      useEngineAnalysis({ engine, fen: START_FEN, enabled: true, multiPv: 3, depth: 20 }),
    )

    const search = await liveSearch(fleet)
    expect(search.stopped).toBe(false)

    const before = performance.now()
    unmount()
    const elapsed = performance.now() - before

    // The abort runs inside React's synchronous teardown, so by the time `unmount`
    // returns the engine has already been told to stop. This is the S19 merge gate.
    expect(search.stopped).toBe(true)
    expect(elapsed).toBeLessThan(5)
    await engine.shutdown()
  })

  it('stops the old search before starting one for the new position', async () => {
    const { fleet, engine } = setUp()
    const { rerender } = renderHook(
      ({ fen }: { fen: typeof START_FEN }) =>
        useEngineAnalysis({ engine, fen, enabled: true, multiPv: 3, depth: 20 }),
      { initialProps: { fen: START_FEN } },
    )

    const first = await liveSearch(fleet)
    rerender({ fen: toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1') })
    expect(first.stopped).toBe(true)

    await flush()
    const searches = fleet.clients.flatMap((client) => client.searches)
    expect(searches).toHaveLength(2)
    expect(searches[1]?.request.fen).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    )
    await engine.shutdown()
  })

  it('does not paint a result that arrives after the position changed', async () => {
    const { fleet, engine } = setUp()
    const { result, rerender } = renderHook(
      ({ fen }: { fen: typeof START_FEN }) =>
        useEngineAnalysis({ engine, fen, enabled: true, multiPv: 1, depth: 20 }),
      { initialProps: { fen: START_FEN } },
    )

    const first = await liveSearch(fleet)
    rerender({ fen: toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1') })
    await act(async () => {
      first.emit({ depth: 30, lines: [makeEngineLine({ depth: 30 })] })
      await Promise.resolve()
    })

    expect(result.current.depth).toBe(0)
    expect(result.current.status).toBe('searching')
    await engine.shutdown()
  })
})
