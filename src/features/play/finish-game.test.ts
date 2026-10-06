import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { clearAllData, KV_KEYS, kvRepo, profileRepo, sessionsRepo } from '@/data'
import { createProfile, START_FEN, toGameId, toTimestamp, toUci } from '@/domain'

import { settleFinishedGame } from './finish-game'
import { createPlayState, playReducer } from './machine'

import type { PlayConfig, PlayEvent, PlayState } from './machine'

const T0 = toTimestamp(Date.now() - 600_000)
const at = (ms: number) => toTimestamp(T0 + ms)

function config(overrides: Partial<PlayConfig> = {}): PlayConfig {
  return {
    youPlay: 'white',
    yourName: 'You',
    yourRating: 1200,
    opponentRating: 1200,
    personality: 'solid',
    timeControl: { kind: 'increment', initialMs: 600_000, incrementMs: 0 },
    initialFen: START_FEN,
    trainingWheels: false,
    showEvaluation: false,
    allowTakebacks: true,
    ...overrides,
  }
}

/** e4 e5 Nf3 Nc6, then you resign: four plies, a loss, thirty seconds per move of yours. */
function resignedGame(id: string, plies: 'long' | 'short' = 'long'): PlayState {
  const events: PlayEvent[] =
    plies === 'long'
      ? [
          { type: 'user-move', move: 'e4', at: at(30_000) },
          { type: 'engine-move', uci: toUci('e7e5'), at: at(31_000) },
          { type: 'user-move', move: 'Nf3', at: at(61_000) },
          { type: 'engine-move', uci: toUci('b8c6'), at: at(62_000) },
          { type: 'resign', at: at(70_000) },
        ]
      : [
          { type: 'user-move', move: 'e4', at: at(5_000) },
          { type: 'resign', at: at(6_000) },
        ]
  const start = playReducer(createPlayState(config(), toGameId(id), T0), { type: 'start', at: T0 })
  return events.reduce(playReducer, start)
}

describe('settleFinishedGame', () => {
  beforeEach(async () => {
    await clearAllData()
    await profileRepo.save(
      createProfile({ displayName: 'Ada', skillLevel: 'club', timeZone: 'UTC' }),
    )
  })

  it('applies the Elo change, records a session and starts the streak', async () => {
    const result = await settleFinishedGame(resignedGame('g1'))
    expect(result).toEqual({ rating: 1184, applied: true })

    expect((await profileRepo.get())?.sparringRating).toBe(1184)
    const sessions = await sessionsRepo.listByKind('sparring')
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ state: 'completed', durationMs: 60_000, itemsCorrect: 0 })
    expect((await kvRepo.get(KV_KEYS.streak))?.current).toBe(1)
  })

  it('counts a game once, however many times it is reopened', async () => {
    const game = resignedGame('g2')
    await settleFinishedGame(game)
    expect(await settleFinishedGame(game)).toEqual({ rating: undefined, applied: false })

    expect((await profileRepo.get())?.sparringRating).toBe(1184)
    expect(await sessionsRepo.listByKind('sparring')).toHaveLength(1)
  })

  it('does not rate a game abandoned in its first moves, but still counts the practice', async () => {
    const result = await settleFinishedGame(resignedGame('g3', 'short'))
    expect(result.rating).toBeUndefined()
    expect((await profileRepo.get())?.sparringRating).toBe(1200)
    expect(await sessionsRepo.listByKind('sparring')).toHaveLength(1)
  })

  it('does nothing for a game still in progress', async () => {
    const live = playReducer(createPlayState(config(), toGameId('g4'), T0), {
      type: 'start',
      at: T0,
    })
    expect(await settleFinishedGame(live)).toEqual({ rating: undefined, applied: false })
    expect(await sessionsRepo.listByKind('sparring')).toHaveLength(0)
  })

  it('still records practice when there is no profile yet', async () => {
    await clearAllData()
    const result = await settleFinishedGame(resignedGame('g5'))
    expect(result.rating).toBeUndefined()
    expect(await sessionsRepo.listByKind('sparring')).toHaveLength(1)
  })
})
