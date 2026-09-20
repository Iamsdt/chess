import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { gamesRepo, newGameId } from '@/data'
import { START_FEN, toTimestamp, toUci } from '@/domain'

import { createPlayState, playReducer } from './machine'
import {
  createSavedGame,
  findResumableGameId,
  loadResumableGame,
  resumePlayState,
  saveGame,
  toGameMeta,
  toMoveRecords,
  toPgn,
} from './persistence'

import type { PlayConfig, PlayEvent, PlayState } from './machine'

const T0 = toTimestamp(1_700_000_000_000)
const at = (ms: number) => toTimestamp(T0 + ms)

const RESUME = { trainingWheels: true, showEvaluation: false, allowTakebacks: true }

function config(overrides: Partial<PlayConfig> = {}): PlayConfig {
  return {
    youPlay: 'white',
    yourName: 'You',
    yourRating: 1180,
    opponentRating: 1200,
    personality: 'tricky',
    timeControl: { kind: 'increment', initialMs: 600_000, incrementMs: 5_000 },
    initialFen: START_FEN,
    trainingWheels: true,
    showEvaluation: false,
    allowTakebacks: true,
    ...overrides,
  }
}

function started(overrides: Partial<PlayConfig> = {}): PlayState {
  return playReducer(createPlayState(config(overrides), newGameId(), T0), { type: 'start', at: T0 })
}

function run(state: PlayState, events: readonly PlayEvent[]): PlayState {
  return events.reduce(playReducer, state)
}

const OPENING: readonly PlayEvent[] = [
  { type: 'user-move', move: 'e4', at: at(4_000) },
  { type: 'engine-move', uci: toUci('c7c5'), at: at(5_000) },
  { type: 'user-move', move: 'Nf3', at: at(9_000) },
  { type: 'engine-move', uci: toUci('d7d6'), at: at(10_000) },
]

beforeEach(async () => {
  await gamesRepo.clear()
})

describe('what a saved game carries', () => {
  it('describes both players, the clock and the opening', () => {
    const meta = toGameMeta(run(started(), OPENING), at(11_000))
    expect(meta.source).toBe('sparring')
    expect(meta.youPlay).toBe('white')
    expect(meta.white.kind).toBe('you')
    expect(meta.black.kind).toBe('engine')
    expect(meta.black.engineLevel).toBe(1200)
    expect(meta.black.personality).toBe('tricky')
    expect(meta.plyCount).toBe(4)
    expect(meta.result).toBe('*')
    expect(meta.termination).toBe('in-progress')
    expect(meta.opening?.name).toMatch(/Sicilian/)
  })

  it('stores the clock each side had after its own move', () => {
    const rows = toMoveRecords(run(started(), OPENING))
    expect(rows).toHaveLength(4)
    expect(rows[0]?.color).toBe('white')
    expect(rows[0]?.clockMs).toBe(600_000 - 4_000 + 5_000)
    expect(rows[0]?.timeSpentMs).toBe(4_000)
    expect(rows[1]?.color).toBe('black')
    expect(rows[1]?.clockMs).toBe(600_000 - 1_000 + 5_000)
  })

  it('marks a game that had takebacks instead of hiding them', () => {
    const rewound = playReducer(run(started(), OPENING), { type: 'takeback', at: at(11_000) })
    expect(toGameMeta(rewound, at(12_000)).tags).toContain('takeback')
  })

  it('writes a PGN that names the players and the result', () => {
    const pgn = toPgn(playReducer(run(started(), OPENING), { type: 'resign', at: at(11_000) }))
    expect(pgn).toContain('[White "You"]')
    expect(pgn).toContain('[Black "Stockfish 1200"]')
    expect(pgn).toContain('[Result "0-1"]')
    expect(pgn).toContain('1. e4 c5')
  })
})

describe('autosave and resume', () => {
  it('finds the game that was left unfinished, and only that one', async () => {
    const finished = playReducer(run(started(), OPENING), { type: 'resign', at: at(11_000) })
    await saveGame(finished)
    expect(await findResumableGameId()).toBeNull()

    const live = run(started(), OPENING)
    await saveGame(live)
    expect(await findResumableGameId()).toBe(live.gameId)
  })

  it('round-trips a game through storage without changing it', async () => {
    const live = run(started(), OPENING)
    expect((await saveGame(live)).ok).toBe(true)

    const resumed = await loadResumableGame(RESUME)
    expect(resumed.ok).toBe(true)
    if (!resumed.ok || resumed.value === null) return

    expect(resumed.value.gameId).toBe(live.gameId)
    expect(resumed.value.phase).toBe('playing')
    expect(resumed.value.game.fen).toBe(live.game.fen)
    expect(resumed.value.game.history.map((move) => move.san)).toEqual(
      live.game.history.map((move) => move.san),
    )
    expect(resumed.value.config.opponentRating).toBe(1200)
    expect(resumed.value.config.personality).toBe('tricky')
    expect(resumed.value.clock.whiteMs).toBe(live.clock.whiteMs)
    expect(resumed.value.clock.blackMs).toBe(live.clock.blackMs)
    expect(resumed.value.clock.runningFor).toBe(live.game.turn)
  })

  it('carries the help toggles from settings, not from the game row', async () => {
    await saveGame(run(started(), OPENING))
    const resumed = await loadResumableGame({
      trainingWheels: false,
      showEvaluation: true,
      allowTakebacks: false,
    })
    expect(resumed.ok).toBe(true)
    if (!resumed.ok || resumed.value === null) return
    expect(resumed.value.config.trainingWheels).toBe(false)
    expect(resumed.value.config.showEvaluation).toBe(true)
    expect(resumed.value.config.allowTakebacks).toBe(false)
  })

  it('keeps playing from a resumed game exactly where it stopped', async () => {
    await saveGame(run(started(), OPENING))
    const resumed = await loadResumableGame(RESUME)
    expect(resumed.ok).toBe(true)
    if (!resumed.ok || resumed.value === null) return

    const next = playReducer(resumed.value, { type: 'user-move', move: 'd4', at: at(20_000) })
    expect(next.game.history).toHaveLength(5)
    expect(next.game.history[4]?.san).toBe('d4')
  })

  it('answers with an error rather than a half game when the moves do not replay', () => {
    const live = run(started(), OPENING)
    const broken = {
      meta: toGameMeta(live, at(11_000)),
      moves: toMoveRecords(live).map((move, index) =>
        index === 2 ? { ...move, uci: toUci('a1a8') } : move,
      ),
    }
    const resumed = resumePlayState(broken, RESUME)
    expect(resumed.ok).toBe(false)
  })

  it('retires the previous unfinished game when a new one starts', async () => {
    const first = run(started(), OPENING)
    await saveGame(first)

    const second = started({ youPlay: 'black' })
    expect((await createSavedGame(second)).ok).toBe(true)

    expect(await findResumableGameId()).toBe(second.gameId)
    const retired = await gamesRepo.get(first.gameId)
    expect(retired?.termination).toBe('abandoned')
  })

  it('reports nothing to resume on a fresh device', async () => {
    const resumed = await loadResumableGame(RESUME)
    expect(resumed).toEqual({ ok: true, value: null })
  })
})
