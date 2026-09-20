import { describe, expect, it } from 'vitest'

import { START_FEN, toFen, toSquare } from '@/domain'

import {
  describeMove,
  describePiece,
  describePieceType,
  describePosition,
  describePremove,
  describeRejection,
  describeSelection,
  describeSquare,
} from './announce'
import { parsePlacement } from './placement'

const sq = (name: string) => toSquare(name)
const start = parsePlacement(START_FEN)

describe('announce', () => {
  it('names pieces and squares', () => {
    expect(describePiece('bN')).toBe('black knight')
    expect(describePieceType('q')).toBe('queen')
    expect(describeSquare(sq('e1'), 'wK')).toBe('e1, white king')
    expect(describeSquare(sq('e4'), undefined)).toBe('e4, empty')
  })

  it('counts the destinations a selection offers', () => {
    expect(describeSelection(sq('g1'), 'wN', 2)).toBe(
      'Selected white knight on g1. 2 moves available.',
    )
    expect(describeSelection(sq('g1'), 'wN', 1)).toContain('1 move available')
  })

  it('says nothing about the count when the count is unknowable', () => {
    expect(describeSelection(sq('g1'), 'wN', null)).toBe('Selected white knight on g1.')
  })

  it('describes a quiet move and a capture', () => {
    expect(describeMove({ from: sq('g1'), to: sq('f3') }, start)).toBe('White knight g1 to f3.')
    const capture = parsePlacement(
      toFen('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2'),
    )
    expect(describeMove({ from: sq('e4'), to: sq('d5') }, capture)).toBe(
      'White pawn e4 takes black pawn on d5.',
    )
  })

  it('mentions the promotion piece', () => {
    const position = parsePlacement(toFen('8/4P3/8/8/8/8/8/4K2k w - - 0 1'))
    expect(describeMove({ from: sq('e7'), to: sq('e8'), promotion: 'r' }, position)).toBe(
      'White pawn e7 to e8. Promotes to rook.',
    )
  })

  it('explains a rejection in terms of the move attempted', () => {
    expect(describeRejection(sq('e2'), sq('e5'))).toBe('e2 to e5 is not a legal move.')
  })

  it('confirms a stored premove', () => {
    expect(describePremove({ from: sq('e2'), to: sq('e4') }, start)).toBe(
      'Premove set: white pawn e2 to e4.',
    )
  })

  it('announces check only when the caller reports one', () => {
    expect(describePosition(null)).toBeNull()
    expect(describePosition(sq('e1'))).toBe('Check on e1.')
  })
})
