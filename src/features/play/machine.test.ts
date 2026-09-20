import { describe, expect, it } from 'vitest'

import { START_FEN, toFen, toGameId, toSquare, toTimestamp, toUci } from '@/domain'

import {
  canTakeBack,
  checkedKingSquare,
  claimableDrawOf,
  createPlayState,
  isEnginesTurn,
  isYourTurn,
  playReducer,
  promotesOn,
  buildLegalMoveMap,
} from './machine'

import type { PlayConfig, PlayEvent, PlayState } from './machine'

const GAME_ID = toGameId('game_test')
const T0 = toTimestamp(1_000_000)

function config(overrides: Partial<PlayConfig> = {}): PlayConfig {
  return {
    youPlay: 'white',
    yourName: 'You',
    yourRating: 1200,
    opponentRating: 1200,
    personality: 'solid',
    timeControl: { kind: 'increment', initialMs: 60_000, incrementMs: 2_000 },
    initialFen: START_FEN,
    trainingWheels: false,
    showEvaluation: false,
    allowTakebacks: true,
    ...overrides,
  }
}

function started(overrides: Partial<PlayConfig> = {}): PlayState {
  return playReducer(createPlayState(config(overrides), GAME_ID, T0), { type: 'start', at: T0 })
}

/** Why a helper: every test that plays a line needs the same fold, and writing it
 *  out each time is how a test file starts disagreeing with itself. */
function run(state: PlayState, events: readonly PlayEvent[]): PlayState {
  return events.reduce(playReducer, state)
}

const at = (ms: number) => toTimestamp(T0 + ms)

describe('the play machine', () => {
  it('starts in setup and only runs the clock once started', () => {
    const fresh = createPlayState(config(), GAME_ID, T0)
    expect(fresh.phase).toBe('setup')
    expect(fresh.clock.runningFor).toBeNull()

    const live = playReducer(fresh, { type: 'start', at: T0 })
    expect(live.phase).toBe('playing')
    expect(live.clock.runningFor).toBe('white')
    expect(isYourTurn(live)).toBe(true)
    expect(isEnginesTurn(live)).toBe(false)
  })

  it('refuses events that belong to another phase', () => {
    const fresh = createPlayState(config(), GAME_ID, T0)
    expect(playReducer(fresh, { type: 'user-move', move: 'e4', at: T0 })).toBe(fresh)
    const live = started()
    expect(playReducer(live, { type: 'start', at: T0 })).toBe(live)
  })

  it('plays a move, charges the mover and pays the increment', () => {
    const after = playReducer(started(), { type: 'user-move', move: 'e4', at: at(5_000) })
    expect(after.game.history).toHaveLength(1)
    expect(after.clock.whiteMs).toBe(60_000 - 5_000 + 2_000)
    expect(after.clock.blackMs).toBe(60_000)
    expect(after.clock.runningFor).toBe('black')
    expect(after.moveTimesMs).toEqual([5_000])
  })

  it('will not let the user move out of turn or play an illegal move', () => {
    const afterE4 = playReducer(started(), { type: 'user-move', move: 'e4', at: at(1_000) })
    expect(playReducer(afterE4, { type: 'user-move', move: 'e5', at: at(2_000) })).toBe(afterE4)

    const illegal = playReducer(started(), { type: 'user-move', move: 'e5', at: at(1_000) })
    expect(illegal.game.history).toHaveLength(0)
    expect(illegal.error).toMatch(/not legal/i)
  })

  it('only accepts an engine move on the engine`s turn', () => {
    const live = started()
    expect(playReducer(live, { type: 'engine-move', uci: toUci('e7e5'), at: at(1) })).toBe(live)
  })
})

describe('the blunder guard inside the machine', () => {
  // Black has just played Qh4; White to move. Nothing is hanging, so the guard
  // has to stay quiet on a normal developing move.
  const quiet = () => started({ trainingWheels: true })

  it('lets a safe move through untouched', () => {
    const after = playReducer(quiet(), { type: 'user-move', move: 'e4', at: at(1_000) })
    expect(after.pending).toBeNull()
    expect(after.game.history).toHaveLength(1)
  })

  it('holds a move that drops a piece until the player confirms it', () => {
    // 1. e4 e5 2. Bc4 Nc6 and now 3. Bxf7+? loses the bishop after ...Kxf7.
    const exposed = run(started({ trainingWheels: true }), [
      { type: 'user-move', move: 'e4', at: at(1_000) },
      { type: 'engine-move', uci: toUci('e7e5'), at: at(2_000) },
      { type: 'user-move', move: 'Nf3', at: at(3_000) },
      { type: 'engine-move', uci: toUci('b8c6'), at: at(4_000) },
    ])
    const held = playReducer(exposed, { type: 'user-move', move: 'Nxe5', at: at(5_000) })
    expect(held.pending).not.toBeNull()
    expect(held.game.history).toHaveLength(4)

    const dismissed = playReducer(held, { type: 'dismiss-pending' })
    expect(dismissed.pending).toBeNull()
    expect(dismissed.game.history).toHaveLength(4)

    const played = playReducer(held, { type: 'confirm-pending', at: at(6_000) })
    expect(played.pending).toBeNull()
    expect(played.game.history).toHaveLength(5)
  })

  it('stays quiet about a move the engine itself likes', () => {
    const exposed = run(started({ trainingWheels: true }), [
      { type: 'user-move', move: 'e4', at: at(1_000) },
      { type: 'engine-move', uci: toUci('e7e5'), at: at(2_000) },
      { type: 'user-move', move: 'Nf3', at: at(3_000) },
      { type: 'engine-move', uci: toUci('b8c6'), at: at(4_000) },
      { type: 'guard-context', trustedMoves: [toUci('f3e5')] },
    ])
    const played = playReducer(exposed, { type: 'user-move', move: 'Nxe5', at: at(5_000) })
    expect(played.pending).toBeNull()
    expect(played.game.history).toHaveLength(5)
  })
})

describe('takeback', () => {
  const played = () =>
    run(started(), [
      { type: 'user-move', move: 'e4', at: at(5_000) },
      { type: 'engine-move', uci: toUci('e7e5'), at: at(6_000) },
      { type: 'user-move', move: 'Nf3', at: at(9_000) },
      { type: 'engine-move', uci: toUci('b8c6'), at: at(10_000) },
    ])

  it('takes back the whole move pair and leaves it your turn', () => {
    const back = playReducer(played(), { type: 'takeback', at: at(11_000) })
    expect(back.game.history.map((move) => move.san)).toEqual(['e4', 'e5'])
    expect(back.game.turn).toBe('white')
    expect(isYourTurn(back)).toBe(true)
    expect(back.takebacks).toBe(1)
  })

  it('takes back only your move when the engine has not answered', () => {
    const half = run(started(), [
      { type: 'user-move', move: 'e4', at: at(5_000) },
      { type: 'engine-move', uci: toUci('e7e5'), at: at(6_000) },
      { type: 'user-move', move: 'Nf3', at: at(9_000) },
    ])
    const back = playReducer(half, { type: 'takeback', at: at(10_000) })
    expect(back.game.history.map((move) => move.san)).toEqual(['e4', 'e5'])
    expect(back.game.turn).toBe('white')
  })

  it('puts both clocks back to the ply it rewound to', () => {
    const before = played()
    const back = playReducer(before, { type: 'takeback', at: at(11_000) })
    const restored = before.clockAfterPly[2]
    expect(restored).toBeDefined()
    expect(back.clock.whiteMs).toBe(restored?.whiteMs)
    expect(back.clock.blackMs).toBe(restored?.blackMs)
    expect(back.clock.runningFor).toBe('white')
    expect(back.clockAfterPly).toHaveLength(3)
    expect(back.moveTimesMs).toHaveLength(2)
  })

  it('never desyncs: the position always replays from the moves that remain', () => {
    let state = played()
    for (let round = 0; round < 2; round += 1) {
      state = playReducer(state, { type: 'takeback', at: at(11_000 + round) })
      state = playReducer(state, { type: 'user-move', move: 'd4', at: at(12_000 + round) })
      state = playReducer(state, {
        type: 'engine-move',
        uci: toUci('d7d5'),
        at: at(13_000 + round),
      })
    }
    expect(state.game.history).toHaveLength(4)
    expect(state.clockAfterPly).toHaveLength(5)
    expect(state.moveTimesMs).toHaveLength(4)
    expect(state.game.fen).toBe(state.game.history[3]?.fenAfter)
  })

  it('is refused when the setup turned it off, and when there is nothing to undo', () => {
    const locked = run(started({ allowTakebacks: false }), [
      { type: 'user-move', move: 'e4', at: at(1_000) },
    ])
    expect(canTakeBack(locked)).toBe(false)
    expect(playReducer(locked, { type: 'takeback', at: at(2_000) })).toBe(locked)

    const empty = started()
    expect(canTakeBack(empty)).toBe(false)
    expect(playReducer(empty, { type: 'takeback', at: at(1) })).toBe(empty)
  })
})

describe('ending the game', () => {
  it('reports checkmate from the rules, not from a guess', () => {
    const mate = run(started(), [
      { type: 'user-move', move: 'e4', at: at(1) },
      { type: 'engine-move', uci: toUci('e7e5'), at: at(2) },
      { type: 'user-move', move: 'Bc4', at: at(3) },
      { type: 'engine-move', uci: toUci('b8c6'), at: at(4) },
      { type: 'user-move', move: 'Qh5', at: at(5) },
      { type: 'engine-move', uci: toUci('g8f6'), at: at(6) },
      { type: 'user-move', move: 'Qxf7#', at: at(7) },
    ])
    expect(mate.phase).toBe('game-over')
    expect(mate.result).toBe('1-0')
    expect(mate.termination).toBe('checkmate')
    expect(mate.clock.runningFor).toBeNull()
  })

  it('resigns for the side that asked', () => {
    const resigned = playReducer(started(), { type: 'resign', at: at(10) })
    expect(resigned.result).toBe('0-1')
    expect(resigned.termination).toBe('resignation')

    const asBlack = playReducer(started({ youPlay: 'black' }), { type: 'resign', at: at(10) })
    expect(asBlack.result).toBe('1-0')
  })

  it('flags on time and awards the game to the side still running', () => {
    const live = playReducer(started(), { type: 'user-move', move: 'e4', at: at(1_000) })
    const flagged = playReducer(live, { type: 'tick', at: at(1_000 + 61_000) })
    expect(flagged.phase).toBe('game-over')
    expect(flagged.termination).toBe('timeout')
    expect(flagged.result).toBe('1-0')
  })

  it('does not flag an untimed game', () => {
    const untimed = started({ timeControl: { kind: 'untimed' } })
    const later = playReducer(untimed, { type: 'tick', at: at(10_000_000) })
    expect(later.phase).toBe('playing')
  })

  it('agrees a draw only when the offer is answered', () => {
    const offered = playReducer(started(), { type: 'offer-draw' })
    expect(offered.drawOffer).toBe('pending')

    const declined = playReducer(offered, { type: 'draw-response', accepted: false, at: at(1) })
    expect(declined.drawOffer).toBe('declined')
    expect(declined.phase).toBe('playing')

    const agreed = playReducer(offered, { type: 'draw-response', accepted: true, at: at(1) })
    expect(agreed.result).toBe('1/2-1/2')
    expect(agreed.termination).toBe('agreement')
  })

  it('lets a threefold be claimed rather than forcing it', () => {
    const shuffled = run(started({ timeControl: { kind: 'untimed' } }), [
      { type: 'user-move', move: 'Nf3', at: at(1) },
      { type: 'engine-move', uci: toUci('g8f6'), at: at(2) },
      { type: 'user-move', move: 'Ng1', at: at(3) },
      { type: 'engine-move', uci: toUci('f6g8'), at: at(4) },
      { type: 'user-move', move: 'Nf3', at: at(5) },
      { type: 'engine-move', uci: toUci('g8f6'), at: at(6) },
      { type: 'user-move', move: 'Ng1', at: at(7) },
      { type: 'engine-move', uci: toUci('f6g8'), at: at(8) },
    ])
    expect(shuffled.phase).toBe('playing')
    expect(claimableDrawOf(shuffled)).toBe('threefold-repetition')

    const claimed = playReducer(shuffled, { type: 'claim-draw', at: at(9) })
    expect(claimed.result).toBe('1/2-1/2')
    expect(claimed.termination).toBe('threefold-repetition')
  })
})

describe('board selectors', () => {
  it('hands the board every legal destination', () => {
    const map = buildLegalMoveMap(started().game)
    expect(map.size).toBe(10)
    expect(map.get(toSquare('e2'))).toEqual(['e3', 'e4'])
  })

  it('knows when a move promotes', () => {
    const promoting = createPlayState(
      config({ initialFen: toFen('8/P6k/8/8/8/8/6K1/8 w - - 0 1') }),
      GAME_ID,
      T0,
    )
    expect(promotesOn(promoting.game, toSquare('a7'), toSquare('a8'))).toBe(true)
    expect(promotesOn(started().game, toSquare('e2'), toSquare('e4'))).toBe(false)
  })

  it('finds the king to flag when it is in check', () => {
    const checked = run(started({ timeControl: { kind: 'untimed' } }), [
      { type: 'user-move', move: 'e4', at: at(1) },
      { type: 'engine-move', uci: toUci('e7e5'), at: at(2) },
      { type: 'user-move', move: 'Bc4', at: at(3) },
      { type: 'engine-move', uci: toUci('a7a6'), at: at(4) },
      { type: 'user-move', move: 'Bxf7+', at: at(5) },
    ])
    expect(checkedKingSquare(checked.game)).toBe('e8')
    expect(checkedKingSquare(started().game)).toBeNull()
  })
})
