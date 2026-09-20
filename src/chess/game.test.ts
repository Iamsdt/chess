import { describe, expect, it } from 'vitest'

import { START_FEN, toSquare, toUci } from '@/domain'

import {
  applyMove,
  createGame,
  isCheck,
  isGameOver,
  isLegalMove,
  legalMoves,
  legalMovesFrom,
  playMoves,
  positionsOf,
  repetitionCount,
  resultOf,
  terminationOf,
  undoMove,
  type ChessGame,
} from './game'

function start(fen?: string): ChessGame {
  const game = createGame(fen)
  if (!game.ok) throw new Error(`fixture is not a legal position: ${game.error.message}`)
  return game.value
}

function play(from: ChessGame, ...moves: string[]): ChessGame {
  const played = playMoves(from, moves)
  if (!played.ok) throw new Error(`fixture moves are not legal: ${played.error.message}`)
  return played.value
}

describe('createGame', () => {
  it('starts from the standard array by default', () => {
    const game = start()
    expect(game.fen).toBe(START_FEN)
    expect(game.turn).toBe('white')
    expect(game.ply).toBe(0)
    expect(game.history).toEqual([])
  })

  it('refuses an illegal position as a value', () => {
    const game = createGame('not a fen')
    expect(game.ok).toBe(false)
  })

  it('keeps the move number of a position set up mid-game', () => {
    const game = start('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R b KQkq - 7 23')
    expect(game.moveNumber).toBe(23)
    expect(game.halfmoveClock).toBe(7)
    expect(game.turn).toBe('black')
  })
})

describe('applyMove', () => {
  it('leaves the game it was given exactly as it was', () => {
    const before = start()
    const after = applyMove(before, 'e4')
    expect(after.ok).toBe(true)
    expect(before.fen).toBe(START_FEN)
    expect(before.ply).toBe(0)
    expect(before.history).toHaveLength(0)
  })

  it('accepts SAN, UCI and a pair of squares alike', () => {
    const base = start()
    const san = applyMove(base, 'e4')
    const uci = applyMove(base, toUci('e2e4'))
    const squares = applyMove(base, { from: toSquare('e2'), to: toSquare('e4') })
    expect(san.ok && uci.ok && squares.ok).toBe(true)
    if (!san.ok || !uci.ok || !squares.ok) return
    expect(uci.value.fen).toBe(san.value.fen)
    expect(squares.value.fen).toBe(san.value.fen)
  })

  it('records everything the move list needs', () => {
    const game = play(start(), 'e4', 'd5', 'exd5')
    const capture = game.history[2]
    expect(capture).toBeDefined()
    if (capture === undefined) return
    expect(capture.san).toBe('exd5')
    expect(capture.uci).toBe('e4d5')
    expect(capture.color).toBe('white')
    expect(capture.captured).toBe('p')
    expect(capture.isCapture).toBe(true)
    expect(capture.ply).toBe(2)
    expect(capture.moveNumber).toBe(2)
  })

  it('records a promotion as the piece it became', () => {
    const game = play(start('8/P6k/8/8/8/8/7K/8 w - - 0 1'), 'a8=Q')
    const move = game.history[0]
    expect(move?.promotion).toBe('q')
    expect(move?.uci).toBe('a7a8q')
    expect(move?.piece).toBe('p')
  })

  it('flags a checking move', () => {
    const game = play(start('7k/P7/8/8/8/8/8/7K w - - 0 1'), 'a8=Q+')
    expect(game.history[0]?.isCheck).toBe(true)
    expect(game.history[0]?.isCheckmate).toBe(false)
  })

  it('flags castling and en passant', () => {
    const castled = play(start(), 'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O')
    expect(castled.history[6]?.isCastle).toBe(true)

    const enPassant = play(start(), 'e4', 'a6', 'e5', 'd5', 'exd6')
    expect(enPassant.history[4]?.isEnPassant).toBe(true)
  })

  it('returns an error for an illegal move rather than throwing', () => {
    const illegal = applyMove(start(), 'e5')
    expect(illegal.ok).toBe(false)
    if (illegal.ok) return
    expect(illegal.error.code).toBe('validation')
  })

  it('leaves the game usable after a rejected move', () => {
    const game = start()
    expect(applyMove(game, 'Ke2').ok).toBe(false)
    const legal = applyMove(game, 'e4')
    expect(legal.ok && legal.value.ply).toBe(1)
  })
})

describe('undoMove', () => {
  it('returns the previous position exactly', () => {
    const before = play(start(), 'e4', 'e5')
    const after = play(before, 'Nf3')
    const undone = undoMove(after)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(undone.value.fen).toBe(before.fen)
    expect(undone.value.history).toHaveLength(2)
    expect(undone.value.turn).toBe('white')
  })

  it('errors at the start of the game instead of doing nothing', () => {
    const undone = undoMove(start())
    expect(undone.ok).toBe(false)
    if (undone.ok) return
    expect(undone.error.code).toBe('conflict')
  })

  it('keeps the branch the caller undid into playable', () => {
    const game = play(start(), 'e4', 'e5', 'Nf3')
    const undone = undoMove(game)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    const other = applyMove(undone.value, 'Bc4')
    expect(other.ok).toBe(true)
    // The original is untouched by the branch taken from its parent.
    expect(game.history[2]?.san).toBe('Nf3')
  })
})

describe('legal moves', () => {
  it('offers twenty moves in the starting position', () => {
    expect(legalMoves(start())).toHaveLength(20)
  })

  it('offers the four promotions from one pawn push', () => {
    const moves = legalMovesFrom(start('8/P6k/8/8/8/8/7K/8 w - - 0 1'), toSquare('a7'))
    expect(moves.map((move) => move.promotion).sort()).toEqual(['b', 'n', 'q', 'r'])
  })

  it('offers nothing once the game is over', () => {
    const mate = play(start(), 'f3', 'e5', 'g4', 'Qh4#')
    expect(legalMoves(mate)).toHaveLength(0)
  })

  it('answers isLegalMove without the caller having to build the move', () => {
    const game = start()
    expect(isLegalMove(game, 'e4')).toBe(true)
    expect(isLegalMove(game, 'e5')).toBe(false)
    // Asking must not consume the game.
    expect(game.ply).toBe(0)
  })
})

describe('status', () => {
  it('reports checkmate and who won', () => {
    const mate = play(start(), 'f3', 'e5', 'g4', 'Qh4#')
    expect(mate.status).toEqual({ kind: 'checkmate', winner: 'black' })
    expect(isGameOver(mate)).toBe(true)
    expect(isCheck(mate)).toBe(true)
    expect(resultOf(mate)).toBe('0-1')
    expect(terminationOf(mate)).toBe('checkmate')
  })

  it('reports stalemate as a draw', () => {
    const stalemate = start('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(stalemate.status).toEqual({ kind: 'draw', reason: 'stalemate' })
    expect(resultOf(stalemate)).toBe('1/2-1/2')
    expect(terminationOf(stalemate)).toBe('stalemate')
  })

  it('reports insufficient material as a draw', () => {
    const drawn = start('7k/8/6K1/8/8/8/8/5B2 w - - 0 1')
    expect(drawn.status).toEqual({ kind: 'draw', reason: 'insufficient-material' })
    expect(terminationOf(drawn)).toBe('insufficient-material')
  })

  it('reports check without ending the game', () => {
    const checked = play(start(), 'e4', 'f5', 'Qh5+')
    expect(checked.status).toEqual({
      kind: 'in-progress',
      inCheck: true,
      claimableDraw: null,
    })
    expect(isCheck(checked)).toBe(true)
    expect(isGameOver(checked)).toBe(false)
    expect(resultOf(checked)).toBe('*')
  })

  it('offers a threefold claim without forcing it', () => {
    const repeated = play(start(), 'Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8')
    expect(repeated.status).toEqual({
      kind: 'in-progress',
      inCheck: false,
      claimableDraw: 'threefold-repetition',
    })
    expect(isGameOver(repeated)).toBe(false)
    // A claim is the caller's decision, so the termination is still "playing".
    expect(terminationOf(repeated)).toBe('in-progress')
  })

  it('offers a fifty-move claim from the clock in the FEN', () => {
    const stale = start('7k/8/8/3r4/8/8/3R4/7K w - - 100 80')
    expect(stale.status).toEqual({
      kind: 'in-progress',
      inCheck: false,
      claimableDraw: 'fifty-move-rule',
    })
  })
})

describe('repetitionCount', () => {
  it('counts the starting position once before anything is played', () => {
    expect(repetitionCount(start())).toBe(1)
  })

  it('counts a position each time it is reached', () => {
    const once = play(start(), 'Nf3', 'Nf6', 'Ng1', 'Ng8')
    expect(repetitionCount(once)).toBe(2)
    const twice = play(once, 'Nf3', 'Nf6', 'Ng1', 'Ng8')
    expect(repetitionCount(twice)).toBe(3)
  })

  it('does not count positions that differ only in castling rights', () => {
    const bare = start('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    const moved = play(bare, 'Ke2', 'Ke7', 'Ke1', 'Ke8')
    // The pieces stand where they started, but neither side may castle any more.
    expect(repetitionCount(moved)).toBe(1)
  })
})

describe('positionsOf', () => {
  it('lists the starting position and one per half-move', () => {
    const game = play(start(), 'e4', 'e5', 'Nf3')
    const positions = positionsOf(game)
    expect(positions).toHaveLength(4)
    expect(positions[0]).toBe(START_FEN)
    expect(positions[3]).toBe(game.fen)
  })
})

describe('the instance cache is invisible', () => {
  it('gives the same answers whether or not a state has been queried before', () => {
    const played = play(start(), 'e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6')
    // Rebuild the same game through a path that never cached the intermediate states.
    const replayed = play(start(), ...played.history.map((move) => move.san))
    expect(replayed.fen).toBe(played.fen)
    expect(
      legalMoves(replayed)
        .map((move) => move.san)
        .sort(),
    ).toEqual(
      legalMoves(played)
        .map((move) => move.san)
        .sort(),
    )
    expect(replayed.status).toEqual(played.status)
  })

  it('answers correctly for a state whose instance was taken by a later move', () => {
    const parent = play(start(), 'e4', 'e5')
    const child = play(parent, 'Nf3')
    expect(child.ply).toBe(3)
    // `parent` lost its cached instance to `child`; it must still be right.
    expect(legalMoves(parent)).toHaveLength(29)
    expect(parent.turn).toBe('white')
  })
})
