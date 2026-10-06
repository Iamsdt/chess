import { describe, expect, it } from 'vitest'

import { makeMoveRecord, toFen, toGameId, toSan, toUci, type MoveRecord } from '@/domain'

import {
  formatEval,
  keyMomentsOf,
  movePairs,
  outcomeFor,
  outcomeWord,
  plural,
  positionAt,
} from './review-model'

const FEN_A = toFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
const FEN_B = toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
const FEN_C = toFen('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2')

function move(ply: number, overrides: Partial<MoveRecord> = {}): MoveRecord {
  return makeMoveRecord({
    gameId: toGameId('g'),
    ply,
    moveNumber: Math.floor(ply / 2) + 1,
    color: ply % 2 === 0 ? 'white' : 'black',
    san: toSan('e4'),
    uci: toUci('e2e4'),
    ...overrides,
  })
}

describe('positionAt', () => {
  const moves = [
    move(0, { fenBefore: FEN_A, fenAfter: FEN_B }),
    move(1, { fenBefore: FEN_B, fenAfter: FEN_C }),
  ]

  it('is the starting position at ply 0 and the position after each move after that', () => {
    expect(positionAt(moves, 0)).toBe(FEN_A)
    expect(positionAt(moves, 1)).toBe(FEN_B)
    expect(positionAt(moves, 2)).toBe(FEN_C)
  })

  it('stays inside the game', () => {
    expect(positionAt(moves, -3)).toBe(FEN_A)
    expect(positionAt(moves, 99)).toBe(FEN_C)
    expect(positionAt([], 0)).toBeUndefined()
  })
})

describe('outcomeFor', () => {
  it('reads the result from the side the user played', () => {
    expect(outcomeFor({ result: '1-0', youPlay: 'white' })).toBe('won')
    expect(outcomeFor({ result: '1-0', youPlay: 'black' })).toBe('lost')
    expect(outcomeFor({ result: '0-1', youPlay: 'black' })).toBe('won')
    expect(outcomeFor({ result: '1/2-1/2', youPlay: 'black' })).toBe('drew')
    expect(outcomeFor({ result: '*', youPlay: 'white' })).toBe('unfinished')
    expect(outcomeWord('won')).toBe('Won')
    expect(outcomeWord('drew')).toBe('Drawn')
  })
})

describe('formatEval', () => {
  it('writes centipawns in pawns from White’s side', () => {
    expect(formatEval({ kind: 'cp', value: 34 }, 'white')).toBe('+0.3')
    expect(formatEval({ kind: 'cp', value: 34 }, 'black')).toBe('−0.3')
    expect(formatEval({ kind: 'cp', value: 0 }, 'white')).toBe('0.0')
    expect(formatEval({ kind: 'cp', value: -125 }, 'white')).toBe('−1.3')
  })

  it('writes mates, and says nothing for a position that was never evaluated', () => {
    expect(formatEval({ kind: 'mate', moves: 3 }, 'white')).toBe('M3')
    expect(formatEval({ kind: 'mate', moves: 3 }, 'black')).toBe('−M3')
    expect(formatEval({ kind: 'mate', moves: -2 }, 'white')).toBe('−M2')
    expect(formatEval(undefined, 'white')).toBe('—')
  })
})

describe('keyMomentsOf', () => {
  const scored = (ply: number, quality: MoveRecord['quality'], before: number, after: number) =>
    move(ply, {
      quality,
      // Mover's view before; after is the opponent's view, so a drop for the mover is a rise here.
      evalBefore: { kind: 'cp', value: before },
      evalAfter: { kind: 'cp', value: after },
    })

  it('picks the user’s costliest mistakes, in game order, and nobody else’s', () => {
    const moves = [
      scored(0, 'blunder', 100, 300), // user (white): from +1.0 to −3.0 for them
      scored(1, 'blunder', 100, 300), // opponent: never listed
      scored(2, 'mistake', 100, 150),
      scored(4, 'best', 100, -100),
      scored(6, 'blunder', 200, 600),
    ]
    const moments = keyMomentsOf(moves, 'white', 2)
    expect(moments.map((m) => m.ply)).toEqual([0, 6])
    expect(moments[0]?.swing).toBeGreaterThan(30)
  })

  it('skips moves that were never evaluated', () => {
    expect(keyMomentsOf([move(0, { quality: 'blunder', evalBefore: undefined })], 'white')).toEqual(
      [],
    )
  })
})

describe('movePairs', () => {
  it('pairs white and black by move number and leaves a half-move open', () => {
    const pairs = movePairs([move(0), move(1), move(2)])
    expect(pairs).toHaveLength(2)
    expect(pairs[0]?.white?.ply).toBe(0)
    expect(pairs[0]?.black?.ply).toBe(1)
    expect(pairs[1]?.white?.ply).toBe(2)
    expect(pairs[1]?.black).toBeUndefined()
  })
})

describe('plural', () => {
  it('counts', () => {
    expect(plural(1, 'blunder')).toBe('1 blunder')
    expect(plural(3, 'mistake')).toBe('3 mistakes')
    expect(plural(0, 'miss', 'misses')).toBe('0 misses')
  })
})
