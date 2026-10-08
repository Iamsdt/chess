import { describe, expect, it } from 'vitest'

import { START_FEN, toSan } from '@/domain'

import { narrate } from './narrate'

describe('narrate', () => {
  it('speaks a move in full at the lowest level', () => {
    expect(narrate(toSan('Nf3'), START_FEN, 'full')).toBe('knight from g1 to f3')
    expect(narrate(toSan('Nf3'), START_FEN, 'piece')).toBe('knight to f3')
    expect(narrate(toSan('Nf3'), START_FEN, 'san')).toBe('Nf3')
  })

  it('reads castling and bad moves safely', () => {
    expect(narrate(toSan('O-O'), START_FEN, 'full')).toBe('castles kingside')
    expect(narrate(toSan('Qh5'), START_FEN, 'full')).toBe('Qh5')
  })
})
