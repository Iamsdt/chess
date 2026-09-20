import { describe, expect, it } from 'vitest'

import { toFen, toSquare, START_FEN } from '@/domain'

import {
  diffPlacements,
  fileIndexOf,
  findSquare,
  isLightSquare,
  orderedSquares,
  parsePlacement,
  pieceCodeFor,
  pieceColorOf,
  rankIndexOf,
  screenColumn,
  screenRow,
  sideToMove,
  SQUARES,
  squareAt,
  squareFromScreen,
  stepSquare,
} from './placement'

const sq = (name: string) => toSquare(name)

describe('geometry', () => {
  it('mints all 64 squares once', () => {
    expect(SQUARES).toHaveLength(64)
    expect(new Set(SQUARES.map(String)).size).toBe(64)
  })

  it('indexes files and ranks from the square name', () => {
    expect(fileIndexOf(sq('a1'))).toBe(0)
    expect(rankIndexOf(sq('a1'))).toBe(0)
    expect(fileIndexOf(sq('h8'))).toBe(7)
    expect(rankIndexOf(sq('h8'))).toBe(7)
    expect(squareAt(4, 3)).toBe('e4')
    expect(squareAt(-1, 0)).toBeNull()
    expect(squareAt(0, 8)).toBeNull()
  })

  it('puts a dark square in the bottom-left corner', () => {
    // "White on the right": a1 is dark and h1 is light on every real chessboard.
    // `prototype/assets/board.js` has this parity inverted; see `isLightSquare`.
    expect(isLightSquare(sq('a1'))).toBe(false)
    expect(isLightSquare(sq('h1'))).toBe(true)
    expect(isLightSquare(sq('h8'))).toBe(false)
    expect(isLightSquare(sq('e4'))).toBe(true)
  })

  it('puts a1 bottom-left for white and top-right for black', () => {
    expect([screenColumn(sq('a1'), 'white'), screenRow(sq('a1'), 'white')]).toEqual([0, 7])
    expect([screenColumn(sq('a1'), 'black'), screenRow(sq('a1'), 'black')]).toEqual([7, 0])
  })

  it('paints squares in reading order, flip included', () => {
    expect(orderedSquares('white')[0]).toBe('a8')
    expect(orderedSquares('white')[63]).toBe('h1')
    expect(orderedSquares('black')[0]).toBe('h1')
    expect(orderedSquares('black')[63]).toBe('a8')
  })

  it('steps the cursor in screen space, not file space', () => {
    expect(stepSquare(sq('e4'), 'white', 0, -1)).toBe('e5')
    expect(stepSquare(sq('e4'), 'black', 0, -1)).toBe('e3')
    expect(stepSquare(sq('a1'), 'white', -1, 0)).toBeNull()
    expect(stepSquare(sq('h8'), 'white', 0, -1)).toBeNull()
  })

  it('resolves screen coordinates back to squares', () => {
    expect(squareFromScreen(0, 0, 'white')).toBe('a8')
    expect(squareFromScreen(0, 0, 'black')).toBe('h1')
    expect(squareFromScreen(8, 0, 'white')).toBeNull()
  })

  it('looks squares up without re-validating them', () => {
    expect(findSquare('e4')).toBe('e4')
    expect(findSquare('z9')).toBeNull()
    expect(findSquare(null)).toBeNull()
    expect(findSquare(undefined)).toBeNull()
  })
})

describe('parsePlacement', () => {
  it('reads the starting position', () => {
    const placement = parsePlacement(START_FEN)
    expect(placement.size).toBe(32)
    expect(placement.get(sq('e1'))).toBe('wK')
    expect(placement.get(sq('e8'))).toBe('bK')
    expect(placement.get(sq('a2'))).toBe('wP')
    expect(placement.get(sq('e4'))).toBeUndefined()
  })

  it('reads the side to move', () => {
    expect(sideToMove(START_FEN)).toBe('white')
    expect(sideToMove(toFen('4k3/8/8/8/8/8/8/4K3 b - - 0 1'))).toBe('black')
  })

  it('spells codes the way the artwork files are named', () => {
    expect(pieceCodeFor('white', 'n')).toBe('wN')
    expect(pieceCodeFor('black', 'q')).toBe('bQ')
    expect(pieceColorOf('bQ')).toBe('black')
    expect(pieceColorOf('wQ')).toBe('white')
  })
})

describe('diffPlacements', () => {
  const after = (fen: string) => parsePlacement(toFen(fen))

  it('pairs an ordinary move', () => {
    const before = parsePlacement(START_FEN)
    const next = after('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
    expect(diffPlacements(before, next)).toEqual([{ code: 'wP', from: 'e2', to: 'e4' }])
  })

  it('pairs both pieces of a castle', () => {
    const before = after('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    const next = after('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1')
    expect(diffPlacements(before, next).sort((a, b) => a.from.localeCompare(b.from))).toEqual([
      { code: 'wK', from: 'e1', to: 'g1' },
      { code: 'wR', from: 'h1', to: 'f1' },
    ])
  })

  it('treats a promotion as an appearance, not a slide', () => {
    const before = after('8/4P3/8/8/8/8/8/4K2k w - - 0 1')
    const next = after('4Q3/8/8/8/8/8/8/4K2k b - - 0 1')
    // The pawn vanishes and a queen appears; nothing legitimately slides.
    expect(diffPlacements(before, next)).toEqual([])
  })

  it('prefers the nearest candidate when two identical pieces could have moved', () => {
    const before = after('4k3/8/8/8/R6R/8/8/4K3 w - - 0 1')
    const next = after('4k3/8/8/8/1R5R/8/8/4K3 b - - 1 1')
    expect(diffPlacements(before, next)).toEqual([{ code: 'wR', from: 'a4', to: 'b4' }])
  })
})
