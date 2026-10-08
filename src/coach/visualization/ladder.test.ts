import { describe, expect, it } from 'vitest'

import { initialLadder, plies, recordAnswer, spanOf, stepDown, type LadderState } from './ladder'

const answer = (state: LadderState, correct: boolean, length = 4) =>
  recordAnswer(state, { plies: length, correct })

describe('ladder', () => {
  it('raises one dial after three right in a row', () => {
    let step = answer(initialLadder(), true)
    step = answer(step.state, true)
    expect(step.change).toBeNull()
    step = answer(step.state, true)
    expect(step.change).toMatchObject({ direction: 'up', dial: 'length' })
    expect(plies(step.state.dials)).toBe(6)
    expect(step.state.streak).toBe(0)
  })

  it('does not raise on a streak that was broken', () => {
    let step = answer(initialLadder(), true)
    step = answer(step.state, true)
    step = answer(step.state, false)
    step = answer(step.state, true)
    expect(step.change).toBeNull()
  })

  it('lowers one dial after two misses', () => {
    let step = answer(initialLadder({ length: 3 }), false)
    expect(step.change).toBeNull()
    step = answer(step.state, false)
    expect(step.change).toMatchObject({ direction: 'down', dial: 'length' })
    expect(step.change?.reason).toContain('Two misses')
    expect(plies(step.state.dials)).toBe(6)
  })

  it('says nothing can go lower at the floor', () => {
    const floor = initialLadder({ length: 0, view: 0, pieces: 0, narration: 0 })
    expect(stepDown(floor).change).toBeNull()
  })

  it('measures span as the longest line held at 80% or better', () => {
    expect(spanOf([])).toBe(0)
    expect(
      spanOf([
        { plies: 4, correct: true },
        { plies: 8, correct: true },
        { plies: 8, correct: false },
        { plies: 6, correct: true },
      ]),
    ).toBe(6)
    expect(spanOf([{ plies: 12, correct: true }])).toBe(12)
  })
})
