import { describe, expect, it } from 'vitest'

import { describeOutcome, outcomeHeadline, starsLabel } from './outcome-copy'

import type { DrillOutcome } from './endgame-session'

const success = (overrides: Partial<Extract<DrillOutcome, { kind: 'success' }>>): DrillOutcome => ({
  kind: 'success',
  how: 'checkmate',
  moves: 10,
  stars: 3,
  overPar: false,
  ...overrides,
})

describe('what a finished drill says', () => {
  it('says nothing while the drill is in play', () => {
    expect(describeOutcome({ kind: 'playing' }, 10)).toBeNull()
    expect(outcomeHeadline({ kind: 'playing' })).toBeNull()
  })

  it('celebrates a mate at par', () => {
    expect(describeOutcome(success({}), 10)).toBe('Checkmate in 10 moves. At or under par 10.')
    expect(outcomeHeadline(success({}))).toBe('Drill complete · 3 of 3 stars')
  })

  it('names a win over par as technically won, with the margin', () => {
    const over = success({ moves: 13, stars: 2, overPar: true })
    expect(describeOutcome(over, 10)).toBe(
      'Checkmate in 13 moves: technically won, 3 moves over par 10.',
    )
    expect(outcomeHeadline(over)).toBe('Won, over par · 2 of 3 stars')
    const byOne = success({ moves: 11, stars: 2, overPar: true })
    expect(describeOutcome(byOne, 10)).toContain('1 move over par')
  })

  it('describes promotion, held and drawn finishes', () => {
    expect(describeOutcome(success({ how: 'promotion', moves: 4 }), 4)).toBe(
      'Promoted and held the queen in 4 moves. At or under par 4.',
    )
    expect(describeOutcome(success({ how: 'held', moves: 15, stars: 2 }), 15)).toBe(
      'You held for 15 moves. The draw is yours.',
    )
    expect(describeOutcome(success({ how: 'drawn' }), 15)).toBe(
      'Draw secured. You held the position.',
    )
    expect(outcomeHeadline(success({ how: 'held', stars: 2 }))).toBe('Draw held · 2 of 3 stars')
  })

  it('explains each way to fail', () => {
    const failures = [
      'checkmated',
      'stalemate',
      'repetition',
      'fifty-move',
      'insufficient-material',
      'material-lost',
    ] as const
    const texts = failures.map((reason) =>
      describeOutcome({ kind: 'failed', reason, moves: 3 }, 10),
    )
    expect(new Set(texts).size).toBe(failures.length)
    for (const text of texts) expect(text).toMatch(/\.$/)
    expect(outcomeHeadline({ kind: 'failed', reason: 'stalemate', moves: 3 })).toBe('Drill failed')
  })

  it('labels stars for assistive tech', () => {
    expect(starsLabel(2)).toBe('2 of 3 stars')
  })
})
