import { describe, expect, it } from 'vitest'

import { START_FEN, toSquare } from '@/domain'

import {
  availableCastling,
  castlingField,
  castlingFromField,
  clearPieces,
  EMPTY_SETUP,
  enPassantChoices,
  placePiece,
  SETUP_SQUARES,
  setupFromFen,
  setupProblems,
  setupToFen,
  startSetup,
  type SetupState,
} from './setup-position'

const ITALIAN = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7'

/** Two lone kings, the smallest legal board the dialog can produce. */
function bareKings(): SetupState {
  const withWhite = placePiece(EMPTY_SETUP, toSquare('e1'), 'wK')
  return placePiece(withWhite, toSquare('e8'), 'bK')
}

describe('reading and writing a position', () => {
  it('knows all 64 squares, in the order a FEN spells them', () => {
    expect(SETUP_SQUARES).toHaveLength(64)
    expect(SETUP_SQUARES[0]).toBe('a8')
    expect(SETUP_SQUARES[63]).toBe('h1')
  })

  it('round-trips a real position without changing a field', () => {
    const setup = setupFromFen(ITALIAN)
    expect(setup.ok).toBe(true)
    if (!setup.ok) return
    expect(setup.value.sideToMove).toBe('white')
    expect(setup.value.halfmoveClock).toBe(2)
    expect(setup.value.fullmoveNumber).toBe(7)
    expect(setup.value.placement.size).toBe(32)

    const written = setupToFen(setup.value)
    expect(written.ok).toBe(true)
    if (!written.ok) return
    expect(written.value).toBe(ITALIAN)
  })

  it('opens on the starting position', () => {
    const written = setupToFen(startSetup())
    expect(written.ok).toBe(true)
    if (!written.ok) return
    expect(written.value).toBe(START_FEN)
  })

  it('rejects a FEN that is not six fields', () => {
    expect(setupFromFen('not a fen').ok).toBe(false)
  })

  it('spells castling rights in the standard order', () => {
    expect(
      castlingField({ whiteKing: false, whiteQueen: true, blackKing: true, blackQueen: false }),
    ).toBe('Qk')
    expect(castlingField({ ...castlingFromField('-') })).toBe('-')
    expect(castlingFromField('KQkq')).toEqual({
      whiteKing: true,
      whiteQueen: true,
      blackKing: true,
      blackQueen: true,
    })
  })
})

describe('validation the dialog shows', () => {
  it('accepts two lone kings', () => {
    expect(setupProblems(bareKings())).toEqual([])
    expect(setupToFen(bareKings()).ok).toBe(true)
  })

  it('asks for the missing king by name', () => {
    const noBlackKing = placePiece(EMPTY_SETUP, toSquare('e1'), 'wK')
    expect(setupProblems(noBlackKing)).toEqual(['Black needs a king.'])
    const written = setupToFen(noBlackKing)
    expect(written.ok).toBe(false)
    if (written.ok) return
    expect(written.error.message).toBe('Black needs a king.')
  })

  it('refuses a second king for the same side', () => {
    const twoWhiteKings = placePiece(bareKings(), toSquare('a1'), 'wK')
    expect(setupProblems(twoWhiteKings)).toContain('White has more than one king.')
  })

  it('refuses a pawn on the first or the last rank', () => {
    const backRankPawn = placePiece(bareKings(), toSquare('a1'), 'wP')
    expect(setupProblems(backRankPawn)).toContain(
      'A pawn cannot stand on the first or the last rank.',
    )
  })

  it('refuses a castling right the pieces cannot support', () => {
    const claimed: SetupState = { ...bareKings(), castling: castlingFromField('K') }
    expect(setupProblems(claimed)).toContain(
      'White cannot castle short without the king on e1 and a rook on h1.',
    )
  })

  it('reports what castling the pieces could support', () => {
    const start = startSetup()
    expect(availableCastling(start.placement)).toEqual({
      whiteKing: true,
      whiteQueen: true,
      blackKing: true,
      blackQueen: true,
    })
    const movedKing = placePiece(start, toSquare('e1'), null)
    expect(availableCastling(movedKing.placement).whiteKing).toBe(false)
  })

  it('hands back the rules layer\u2019s own refusal when the position is unreachable', () => {
    // Black is in check with White to move, which no legal game can produce.
    const withRook = placePiece(bareKings(), toSquare('e7'), 'wR')
    expect(setupProblems(withRook)).toEqual([])
    const written = setupToFen(withRook)
    expect(written.ok).toBe(false)
    if (written.ok) return
    expect(written.error.message).toBe("Black is in check but it is not Black's move.")
  })
})

describe('en passant', () => {
  it('offers only squares a pawn could have just moved past', () => {
    const setup = setupFromFen('rnbqkbnr/pp1ppppp/8/2p5/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 2')
    expect(setup.ok).toBe(true)
    if (!setup.ok) return
    expect(enPassantChoices(setup.value)).toEqual(['c6'])
  })

  it('offers nothing when no pawn is on the double-step rank', () => {
    expect(enPassantChoices(startSetup())).toEqual([])
  })

  it('forgets the square whenever a piece moves, so it cannot go stale', () => {
    const setup = setupFromFen('rnbqkbnr/pp1ppppp/8/2p5/8/8/PPPPPPPP/RNBQKBNR w KQkq c6 0 2')
    expect(setup.ok).toBe(true)
    if (!setup.ok) return
    expect(setup.value.enPassant).toBe('c6')
    expect(placePiece(setup.value, toSquare('a3'), 'wN').enPassant).toBeNull()
  })
})

describe('clearing the board', () => {
  it('drops every piece and every castling right', () => {
    const cleared = clearPieces(startSetup())
    expect(cleared.placement.size).toBe(0)
    expect(castlingField(cleared.castling)).toBe('-')
    expect(setupProblems(cleared)).toEqual(['White needs a king.', 'Black needs a king.'])
  })
})
