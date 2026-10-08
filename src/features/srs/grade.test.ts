import { describe, expect, it } from 'vitest'

import { EASY_WITHIN_MS, gradeAttempt, HARD_AFTER_MS } from './grade'

const clean = { solved: true, wrongMoves: 0, hintUsed: null, durationMs: 15_000 } as const

describe('gradeAttempt', () => {
  it('is Good for an unaided find at a normal pace', () => {
    expect(gradeAttempt(clean)).toBe('good')
  })

  it('is Easy for a quick unaided find, but not on a first sighting', () => {
    expect(gradeAttempt({ ...clean, durationMs: EASY_WITHIN_MS })).toBe('easy')
    expect(gradeAttempt({ ...clean, durationMs: EASY_WITHIN_MS, firstSighting: true })).toBe('good')
  })

  it('is Hard when it took a long time', () => {
    expect(gradeAttempt({ ...clean, durationMs: HARD_AFTER_MS })).toBe('hard')
  })

  it('is Hard with a nudge or a square, Again with the move shown', () => {
    expect(gradeAttempt({ ...clean, hintUsed: 'nudge' })).toBe('hard')
    expect(gradeAttempt({ ...clean, hintUsed: 'square' })).toBe('hard')
    expect(gradeAttempt({ ...clean, hintUsed: 'move' })).toBe('again')
  })

  it('is Again for a wrong move or an unsolved position', () => {
    expect(gradeAttempt({ ...clean, wrongMoves: 1 })).toBe('again')
    expect(gradeAttempt({ ...clean, solved: false })).toBe('again')
  })
})
