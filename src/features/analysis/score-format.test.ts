import { describe, expect, it } from 'vitest'

import type { EngineScore } from '@/domain'

import { describeScore, displayPawns, formatScore, whiteShare } from './score-format'

const cp = (value: number): EngineScore => ({ kind: 'cp', value })
const mate = (moves: number): EngineScore => ({ kind: 'mate', moves })

describe('formatScore', () => {
  it('always reads from White s point of view, whoever is to move', () => {
    expect(formatScore(cp(22), 'white')).toBe('+0.22')
    expect(formatScore(cp(22), 'black')).toBe('-0.22')
  })

  it('prints a mate as a mate, never as a huge number of pawns', () => {
    expect(formatScore(mate(4), 'white')).toBe('M4')
    expect(formatScore(mate(-3), 'white')).toBe('-M3')
    expect(formatScore(mate(4), 'black')).toBe('-M4')
  })

  it('clamps what it shows, because +40 and +80 mean the same thing', () => {
    expect(formatScore(cp(9000), 'white')).toBe('+10.00')
    expect(displayPawns(cp(-9000), 'white')).toBe(-10)
  })
})

describe('whiteShare', () => {
  it('splits the bar evenly at zero', () => {
    expect(whiteShare(cp(0), 'white')).toBeCloseTo(0.5)
  })

  it('fills the bar for a forced mate', () => {
    expect(whiteShare(mate(2), 'white')).toBe(1)
    expect(whiteShare(mate(-2), 'white')).toBe(0)
  })

  it('keeps small advantages distinguishable and large ones not', () => {
    const small = whiteShare(cp(200), 'white') - whiteShare(cp(100), 'white')
    const large = whiteShare(cp(900), 'white') - whiteShare(cp(800), 'white')
    expect(small).toBeGreaterThan(large)
  })
})

describe('describeScore', () => {
  it('says what the number means in words', () => {
    expect(describeScore(cp(10), 'white')).toBe('about equal')
    expect(describeScore(cp(-80), 'white')).toBe('Black is slightly better')
    expect(describeScore(cp(250), 'white')).toBe('White is clearly better')
    expect(describeScore(cp(600), 'white')).toBe('White is winning')
    expect(describeScore(mate(3), 'black')).toBe('mate in 3 for Black')
  })
})
