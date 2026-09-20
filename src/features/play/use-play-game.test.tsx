import 'fake-indexeddb/auto'

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { gamesRepo, newGameId, settingsRepo } from '@/data'
import {
  domainError,
  err,
  makeEngineEval,
  ok,
  START_FEN,
  toJobId,
  toSquare,
  toTimestamp,
  toUci,
} from '@/domain'
import type { EngineEval, EngineLine, Result, Uci } from '@/domain'

import { createPlayState, playReducer } from './machine'
import { createSavedGame } from './persistence'
import { PlayPortsContext } from './ports'
import { usePlayGame } from './use-play-game'

import type { PlayConfig, PlayState } from './machine'
import type { EnginePort, PlayPorts } from './ports'
import type { ReactNode } from 'react'

const T0 = toTimestamp(1_700_000_000_000)

/** An engine that answers instantly with a move we chose, and analyses nothing —
 *  the guard's static half is what the screen actually depends on. */
function fakeEngine(reply: Uci): EnginePort {
  return {
    bestMove: (fen) =>
      Promise.resolve(
        ok({
          move: reply,
          ponder: null,
          line: null,
          eval: makeEngineEval({ fen, score: { kind: 'cp', value: 20 } }),
        }),
      ),
    analyse: (): AsyncGenerator<readonly EngineLine[], Result<EngineEval>, void> =>
      (async function* stream(): AsyncGenerator<readonly EngineLine[], Result<EngineEval>, void> {
        // One empty snapshot, then nothing: the guard has to work without lines.
        await Promise.resolve()
        yield []
        return err(domainError('cancelled', 'no analysis in this test'))
      })(),
  }
}

function config(overrides: Partial<PlayConfig> = {}): PlayConfig {
  return {
    youPlay: 'white',
    yourName: 'You',
    yourRating: 1200,
    opponentRating: 1200,
    personality: 'solid',
    timeControl: { kind: 'untimed' },
    initialFen: START_FEN,
    trainingWheels: false,
    showEvaluation: false,
    allowTakebacks: true,
    ...overrides,
  }
}

async function seedGame(overrides: Partial<PlayConfig> = {}): Promise<PlayState> {
  const state = playReducer(createPlayState(config(overrides), newGameId(), T0), {
    type: 'start',
    at: T0,
  })
  await createSavedGame(state)
  return state
}

function wrapper(ports: PlayPorts) {
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <PlayPortsContext value={ports}>{children}</PlayPortsContext>
  }
}

function ports(overrides: Partial<PlayPorts> = {}): PlayPorts {
  return {
    engine: fakeEngine(toUci('e7e5')),
    queue: { enqueueGameReview: vi.fn(() => Promise.resolve(ok(toJobId('job_1')))) },
    random: () => 0.99,
    ...overrides,
  }
}

beforeEach(async () => {
  await gamesRepo.clear()
  await settingsRepo.clear()
})

describe('usePlayGame', () => {
  it('reports an empty screen when there is nothing to resume', async () => {
    const { result } = renderHook(() => usePlayGame(), { wrapper: wrapper(ports()) })
    await waitFor(() => {
      expect(result.current.load.status).toBe('empty')
    })
  })

  it('picks up the game that was saved, as if the page had just been reloaded', async () => {
    const seeded = await seedGame()
    const { result } = renderHook(() => usePlayGame(), { wrapper: wrapper(ports()) })

    await waitFor(() => {
      expect(result.current.load.status).toBe('ready')
    })
    const load = result.current.load
    expect(load.status === 'ready' && load.state.gameId).toBe(seeded.gameId)
  })

  it('lets you move and answers with the engine`s reply', async () => {
    await seedGame()
    const { result } = renderHook(() => usePlayGame(), { wrapper: wrapper(ports()) })
    await waitFor(() => {
      expect(result.current.load.status).toBe('ready')
    })

    act(() => {
      result.current.actions.play({ from: toSquare('e2'), to: toSquare('e4') })
    })

    await waitFor(() => {
      const load = result.current.load
      expect(load.status === 'ready' ? load.state.game.history.length : 0).toBe(2)
    })
    const load = result.current.load
    expect(load.status === 'ready' ? load.state.game.history[1]?.san : '').toBe('e5')
  })

  it('queues the review exactly once when the game ends', async () => {
    await seedGame()
    const enqueue = vi.fn(() => Promise.resolve(ok(toJobId('job_review'))))
    const { result, rerender } = renderHook(() => usePlayGame(), {
      wrapper: wrapper(ports({ queue: { enqueueGameReview: enqueue } })),
    })
    await waitFor(() => {
      expect(result.current.load.status).toBe('ready')
    })

    act(() => {
      result.current.actions.resign()
    })

    await waitFor(() => {
      expect(result.current.review.status).toBe('queued')
    })
    rerender()
    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(enqueue).toHaveBeenCalledWith(expect.stringMatching(/^game_/))
  })

  it('says so, calmly, when the queue is not there yet', async () => {
    await seedGame()
    const enqueue = vi.fn(() =>
      Promise.resolve(err(domainError('io', 'S11 has not replaced the job queue seam yet.'))),
    )
    const { result } = renderHook(() => usePlayGame(), {
      wrapper: wrapper(ports({ queue: { enqueueGameReview: enqueue } })),
    })
    await waitFor(() => {
      expect(result.current.load.status).toBe('ready')
    })

    act(() => {
      result.current.actions.resign()
    })

    await waitFor(() => {
      expect(result.current.review.status).toBe('failed')
    })
    const load = result.current.load
    expect(load.status === 'ready' && load.state.phase).toBe('game-over')
  })

  it('autosaves after every move, so a reload loses nothing', async () => {
    const seeded = await seedGame()
    const { result } = renderHook(() => usePlayGame(), { wrapper: wrapper(ports()) })
    await waitFor(() => {
      expect(result.current.load.status).toBe('ready')
    })

    act(() => {
      result.current.actions.play({ from: toSquare('e2'), to: toSquare('e4') })
    })
    await waitFor(() => {
      const load = result.current.load
      expect(load.status === 'ready' ? load.state.game.history.length : 0).toBe(2)
    })

    await waitFor(async () => {
      const stored = await gamesRepo.getWithMoves(seeded.gameId)
      expect(stored?.moves).toHaveLength(2)
    })
  })
})
