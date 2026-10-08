import { describe, expect, it } from 'vitest'

import { toFen, toSquare } from '@/domain'

import { attackersOf, hangingPieces, squareControl } from './attacks'

describe('attacks', () => {
  it('finds a piece attacked and undefended', () => {
    // The white knight on f3 is attacked by the bishop on g4 and nothing guards it.
    const fen = toFen('4k3/8/8/8/6b1/5N2/8/4K3 w - - 0 1')
    expect(hangingPieces(fen, 'white')).toEqual([
      { square: toSquare('f3'), type: 'n', color: 'white' },
    ])
    expect(attackersOf(fen, toSquare('f3'), 'black')).toEqual([toSquare('g4')])
  })

  it('marks contested squares', () => {
    const fen = toFen('4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1')
    const control = new Map(squareControl(fen).map((entry) => [entry.square, entry.side]))
    expect(control.get(toSquare('e4'))).toBe('contested')
    expect(control.get(toSquare('b5'))).toBe('white')
  })
})
