import { describe, expect, it } from 'vitest'

import { toSquare as sq } from '@/domain'

import {
  ALL_SQUARES,
  fileIndex,
  parseSquareGuess,
  pickSquare,
  rankIndex,
  squareAt,
} from './vision-squares'

describe('square helpers', () => {
  it('lists all 64 squares file by file', () => {
    expect(ALL_SQUARES).toHaveLength(64)
    expect(new Set(ALL_SQUARES).size).toBe(64)
    expect(ALL_SQUARES[0]).toBe('a1')
    expect(ALL_SQUARES[63]).toBe('h8')
  })

  it('converts between squares and indices', () => {
    expect(fileIndex(sq('e4'))).toBe(4)
    expect(rankIndex(sq('e4'))).toBe(3)
    expect(squareAt(4, 3)).toBe('e4')
    expect(squareAt(8, 0)).toBeNull()
    expect(squareAt(0, -1)).toBeNull()
  })

  it('reads a guess leniently and rejects nonsense', () => {
    expect(parseSquareGuess(' E4 ')).toBe('e4')
    expect(parseSquareGuess('e9')).toBeNull()
    expect(parseSquareGuess('')).toBeNull()
    expect(parseSquareGuess('e44')).toBeNull()
  })

  it('picks from the random source and never repeats the last square', () => {
    expect(pickSquare(() => 0, null)).toBe('a1')
    expect(pickSquare(() => 0.999, null)).toBe('h8')
    expect(pickSquare(() => 0.5, null)).toBe('e1')
    expect(pickSquare(() => 0.5, sq('e1'))).toBe('e2')
    expect(pickSquare(() => 0.999, sq('h8'))).toBe('a1')
  })
})
