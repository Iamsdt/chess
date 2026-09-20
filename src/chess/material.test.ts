import { describe, expect, it } from 'vitest'

import { START_FEN, toFen, toSquare } from '@/domain'

import {
  capturedPieces,
  countMaterial,
  materialBalance,
  pieceAt,
  PIECE_VALUES,
  staticExchangeEvaluation,
} from './material'

function see(fen: string, uci: string): number {
  const result = staticExchangeEvaluation(toFen(fen), uci)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('countMaterial', () => {
  it('counts a full board', () => {
    const count = countMaterial(START_FEN)
    expect(count.white).toEqual({ p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 })
    expect(count.black).toEqual(count.white)
    expect(count.whitePoints).toBe(39)
    expect(count.blackPoints).toBe(39)
  })

  it('leaves the king out of the points, because it is never traded', () => {
    expect(PIECE_VALUES.k).toBe(0)
    const bare = countMaterial(toFen('7k/8/8/8/8/8/8/7K w - - 0 1'))
    expect(bare.whitePoints).toBe(0)
  })
})

describe('materialBalance', () => {
  it('is level at the start', () => {
    const balance = materialBalance(START_FEN)
    expect(balance.points).toBe(0)
    expect(balance.leader).toBeNull()
    expect(balance.advantage).toBe(0)
  })

  it('names the leader and the margin', () => {
    // Black is missing a knight and three pawns.
    const balance = materialBalance(toFen('rnbqkb1r/pp3ppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'))
    expect(balance.points).toBe(3 + 3)
    expect(balance.leader).toBe('white')
    expect(balance.advantage).toBe(6)
  })

  it('reports the imbalance per piece, which is what the review prints', () => {
    const balance = materialBalance(
      toFen('rnbqkb1r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    )
    expect(balance.byPiece.n).toBe(1)
    expect(balance.byPiece.p).toBe(0)
  })

  it('gives Black a negative balance, so the sign is always from White', () => {
    const balance = materialBalance(
      toFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKB1R b KQkq - 0 1'),
    )
    expect(balance.points).toBe(-3)
    expect(balance.leader).toBe('black')
  })
})

describe('capturedPieces', () => {
  it('finds nothing at the start', () => {
    expect(capturedPieces(START_FEN)).toEqual({ white: [], black: [] })
  })

  it('lists what each side has taken', () => {
    const captured = capturedPieces(
      toFen('rnbqkb1r/pppppppp/8/8/8/8/PPPPP1PP/RNBQKBNR w KQkq - 0 1'),
    )
    expect(captured.white).toEqual(['n'])
    expect(captured.black).toEqual(['p'])
  })
})

describe('pieceAt', () => {
  it("reads a piece in this app's vocabulary", () => {
    expect(pieceAt(START_FEN, toSquare('e1'))).toEqual({ color: 'white', type: 'k' })
    expect(pieceAt(START_FEN, toSquare('d8'))).toEqual({ color: 'black', type: 'q' })
  })

  it('returns null for an empty square', () => {
    expect(pieceAt(START_FEN, toSquare('e4'))).toBeNull()
  })
})

describe('staticExchangeEvaluation', () => {
  it('is zero for a quiet move', () => {
    expect(see(START_FEN, 'e2e4')).toBe(0)
  })

  it('wins the piece when nothing defends it', () => {
    // A black knight on e5, defended by nothing, taken by a white rook.
    expect(see('4k3/8/8/4n3/8/8/8/4RK2 w - - 0 1', 'e1e5')).toBe(300)
  })

  it('is level when a capture is recaptured by an equal piece', () => {
    // Pawn takes pawn, pawn takes back.
    expect(see('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1', 'd7d5')).toBe(0)
    expect(see('4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1', 'e5d6')).toBe(100)
  })

  it('sees the defender and prices a losing capture as a loss', () => {
    // Rook takes a pawn defended by a pawn: a pawn won for a rook given.
    expect(see('6k1/3p4/4p3/8/8/8/8/4RK2 w - - 0 1', 'e1e6')).toBe(100 - 500)
  })

  it('counts an attacker that only appears once the piece in front of it moves', () => {
    // Pawn takes, pawn recaptures, and the rook behind the pawn takes back.
    expect(see('4k3/3p4/4p3/3P4/8/8/8/4RK2 w - - 0 1', 'd5e6')).toBe(100)
  })

  it('does not let a king capture into a defended square', () => {
    // The king must not "win" the pawn, because the rook recaptures.
    expect(see('4k3/8/8/8/8/8/4pK2/4r3 w - - 0 1', 'f2e2')).toBe(100 - 100_000)
  })

  it('prices a promotion at what the pawn becomes', () => {
    expect(see('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7a8q')).toBe(900 - 100)
  })

  it('handles en passant, where the captured pawn is not on the destination', () => {
    expect(see('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5d6')).toBe(100)
  })

  it('reports a sacrifice as a loss, which is what makes brilliance detectable', () => {
    // The classic Greek gift: bishop takes a pawn defended by the king.
    const sacrifice = see(
      'rnbq1rk1/ppp1bppp/4pn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQK2R w KQ - 0 1',
      'd3h7',
    )
    expect(sacrifice).toBe(100 - 300)
  })

  it('returns an error for a move with no piece on it', () => {
    const empty = staticExchangeEvaluation(START_FEN, 'e4e5')
    expect(empty.ok).toBe(false)
    if (empty.ok) return
    expect(empty.error.message).toContain('e4')
  })
})
