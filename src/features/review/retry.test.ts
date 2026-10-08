import { describe, expect, it } from 'vitest'

import { makeMoveRecord, toUci } from '@/domain'

import { alternativeLoss, canRetry, judgeKnownAttempt, retryMessage, verdictForLoss } from './retry'

/** Black to move, 40% to win by the engine's count, played g8f6 where g8e7 was better. */
const mistake = makeMoveRecord({
  color: 'black',
  uci: toUci('g8f6'),
  quality: 'blunder',
  bestMove: toUci('g8e7'),
  evalBefore: { kind: 'cp', value: 0 },
})

describe('canRetry', () => {
  it('accepts the user’s own costly move when the review kept the better one', () => {
    expect(canRetry(mistake, 'black')).toBe(true)
  })

  it('refuses the opponent’s moves, good moves, and moves with nothing to compare', () => {
    expect(canRetry(mistake, 'white')).toBe(false)
    expect(canRetry({ ...mistake, quality: 'best' }, 'black')).toBe(false)
    expect(canRetry({ ...mistake, quality: undefined }, 'black')).toBe(false)
    expect(canRetry({ ...mistake, bestMove: undefined }, 'black')).toBe(false)
    expect(canRetry({ ...mistake, evalBefore: undefined }, 'black')).toBe(false)
  })
})

describe('judgeKnownAttempt', () => {
  it('knows the engine’s move and the move already played without asking anyone', () => {
    expect(judgeKnownAttempt(toUci('g8e7'), mistake)).toBe('best')
    expect(judgeKnownAttempt(toUci('g8f6'), mistake)).toBe('repeat')
    expect(judgeKnownAttempt(toUci('d7d6'), mistake)).toBe('unknown')
  })
})

describe('alternativeLoss', () => {
  it('counts what the alternative gives away, from the mover’s side', () => {
    // After the alternative White is to move and the engine says White is +9: Black is lost.
    const bad = alternativeLoss(mistake, { kind: 'cp', value: 900 })
    // White is to move and sees an equal game: nothing was lost.
    const fine = alternativeLoss(mistake, { kind: 'cp', value: 0 })
    expect(bad).toBeGreaterThan(40)
    expect(fine).toBe(0)
  })

  it('is unknown without the evaluation from before the move', () => {
    expect(alternativeLoss({ ...mistake, evalBefore: undefined }, { kind: 'cp', value: 0 })).toBe(
      undefined,
    )
  })

  it('never reports a negative loss for a move better than the original position', () => {
    expect(alternativeLoss(mistake, { kind: 'cp', value: -300 })).toBe(0)
  })
})

describe('verdictForLoss', () => {
  it('forgives less than an inaccuracy and no more', () => {
    expect(verdictForLoss(0)).toBe('good')
    expect(verdictForLoss(4.9)).toBe('good')
    expect(verdictForLoss(5)).toBe('worse')
  })
})

describe('retryMessage', () => {
  it('names the engine’s move only where it is known', () => {
    expect(retryMessage('best', 'Nge7')).toContain('Nge7')
    expect(retryMessage('good', 'Nge7')).toContain('Nge7')
    expect(retryMessage('worse', 'Nge7')).not.toContain('Nge7')
    expect(retryMessage('repeat', 'Nge7')).not.toContain('Nge7')
    expect(retryMessage('best', undefined)).toContain('the engine’s move')
  })
})
