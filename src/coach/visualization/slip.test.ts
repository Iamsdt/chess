import { describe, expect, it } from 'vitest'

import { FOLLOW_LINE_CARD } from '@/coach/fixtures/visualization-fixtures'
import { toSquare } from '@/domain'

import { findSlip } from './slip'

const base = {
  fen: FOLLOW_LINE_CARD.fen,
  moves: FOLLOW_LINE_CARD.moves,
  start: toSquare('f1'),
}

describe('findSlip', () => {
  it('is null for the right answer', () => {
    expect(findSlip({ ...base, answer: toSquare('a4') })).toBeNull()
  })

  it('blames the move after the square the user stopped on', () => {
    const slip = findSlip({ ...base, answer: toSquare('b5') })
    expect(slip).toMatchObject({ ply: 2, san: 'Ba4', label: '4.' })
    expect(slip?.explanation).toBe('The bishop went from b5 to a4 on move 4; you left it on b5.')
  })

  it('blames the first move when the user kept the piece at home', () => {
    expect(findSlip({ ...base, answer: toSquare('f1') })).toMatchObject({ ply: 0, san: 'Bb5' })
  })

  it('falls back to the nearest move when the piece never stood there', () => {
    const slip = findSlip({ ...base, answer: toSquare('b4') })
    expect(slip?.san).toBe('Bb5')
  })

  it('follows a rook through castling', () => {
    const slip = findSlip({
      fen: FOLLOW_LINE_CARD.fen,
      moves: FOLLOW_LINE_CARD.moves,
      start: toSquare('h1'),
      answer: toSquare('h1'),
    })
    expect(slip).toMatchObject({ san: 'O-O', from: 'h1', to: 'f1' })
    expect(slip?.explanation).toContain('rook')
  })
})
