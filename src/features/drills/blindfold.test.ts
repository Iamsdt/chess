import { describe, expect, it } from 'vitest'

import { createGame, playMoves } from '@/chess'
import { START_FEN, toSquare as sq } from '@/domain'

import {
  BLINDFOLD_LINES,
  blindfoldAnswer,
  blindfoldFinalFen,
  pickLine,
  playLine,
  trackPiece,
} from './blindfold'

function history(moves: readonly string[]) {
  const start = createGame(START_FEN)
  if (!start.ok) throw new Error('start')
  const played = playMoves(start.value, moves)
  if (!played.ok) throw new Error(played.error.message)
  return played.value.history
}

describe('following a piece', () => {
  it('follows a knight across several moves', () => {
    expect(trackPiece(history(['Nf3', 'Nc6', 'Ng5']), sq('g1'))).toBe(sq('g5'))
  })

  it('leaves a piece that never moved where it was', () => {
    expect(trackPiece(history(['e4', 'e5']), sq('b1'))).toBe(sq('b1'))
  })

  it('follows a rook through castling', () => {
    const line = history(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'Nf6'])
    expect(trackPiece(line, sq('h1'))).toBe(sq('f1'))
    expect(trackPiece(line, sq('e1'))).toBe(sq('g1'))
    expect(trackPiece(line, sq('a1'))).toBe(sq('a1'))
  })

  it('follows a rook through long castling', () => {
    const line = history(['d4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7', 'O-O-O'])
    expect(trackPiece(line, sq('a1'))).toBe(sq('d1'))
  })

  it('reports a captured piece as gone', () => {
    expect(trackPiece(history(['e4', 'd5', 'exd5']), sq('d7'))).toBeNull()
  })
})

describe('the blindfold lines', () => {
  it.each(BLINDFOLD_LINES.map((line) => [line.id, line] as const))(
    '%s is legal and its answer is a square',
    (_id, line) => {
      expect(playLine(line)).not.toBeNull()
      expect(blindfoldAnswer(line)).not.toBeNull()
      expect(blindfoldFinalFen(line)).not.toBeNull()
    },
  )

  it('computes the expected answers', () => {
    const answers = Object.fromEntries(
      BLINDFOLD_LINES.map((line) => [line.id, blindfoldAnswer(line)]),
    )
    expect(answers).toEqual({
      'ruy-knight': 'f3',
      'ruy-bishop': 'a4',
      'italian-knight': 'd5',
      'sicilian-knight': 'd4',
      'queens-gambit-rook': 'f8',
      'queens-gambit-bishop': 'g5',
    })
  })

  it('has a piece on the starting square of every tracked piece', () => {
    for (const line of BLINDFOLD_LINES) {
      const piece = line.fen.split(' ')[0] ?? ''
      expect(piece.length).toBeGreaterThan(0)
    }
  })

  it('picks without repeating the previous line', () => {
    const first = pickLine(() => 0.2, null)
    expect(pickLine(() => 0.2, first).id).not.toBe(first.id)
  })

  it('returns null for a line that cannot be played', () => {
    const broken = { ...BLINDFOLD_LINES[0], moves: ['e5'] } as (typeof BLINDFOLD_LINES)[number]
    expect(playLine(broken)).toBeNull()
    expect(blindfoldAnswer(broken)).toBeNull()
    expect(blindfoldFinalFen(broken)).toBeNull()
  })
})
