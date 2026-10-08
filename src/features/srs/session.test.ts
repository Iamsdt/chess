import { describe, expect, it } from 'vitest'

import { toSquare, toTimestamp } from '@/domain'

import { lineItem } from './fixtures'
import {
  currentItem,
  progressDots,
  reduceSession,
  startSession,
  summarise,
  totalCards,
  type ReviewAction,
  type ReviewSessionState,
} from './session'

const T = 1_800_000_000_000
const SQUARE = (name: string) => toSquare(name)

const play = (from: string, to: string, at: number): ReviewAction => ({
  type: 'play',
  move: { from: SQUARE(from), to: SQUARE(to) },
  at,
})

function run(state: ReviewSessionState, actions: readonly ReviewAction[]): ReviewSessionState {
  return actions.reduce(reduceSession, state)
}

/** Plays the whole line correctly: Qf3+, the scripted Kg1, then Qe2. */
function solveLine(state: ReviewSessionState, at: number): ReviewSessionState {
  return run(state, [play('f6', 'f3', at), { type: 'reply', at }, play('f3', 'e2', at)])
}

describe('starting', () => {
  it('opens the first position on the solving phase', () => {
    const state = startSession([lineItem('a')], T)
    expect(state.phase).toBe('solving')
    expect(state.solve?.userColor).toBe('black')
    expect(currentItem(state)?.card.id).toBe('a')
  })

  it('is immediately done with nothing to review', () => {
    expect(startSession([], T).phase).toBe('done')
  })

  it('skips a position that cannot be opened', () => {
    const broken = lineItem('broken')
    const state = startSession(
      [{ ...broken, mistake: { ...broken.mistake, solution: [] } }, lineItem('ok')],
      T,
    )
    expect(currentItem(state)?.card.id).toBe('ok')
  })
})

describe('a correct recall', () => {
  it('accepts the line, plays the forced reply, and closes with a grade', () => {
    let state = startSession([lineItem('a')], T)
    state = run(state, [play('f6', 'f3', T + 9_000)])
    expect(state.phase).toBe('solving')
    expect(state.solve?.status).toBe('replying')
    state = run(state, [{ type: 'reply', at: T + 9_500 }])
    expect(state.solve?.status).toBe('solving')
    state = run(state, [play('f3', 'e2', T + 12_000)])
    expect(state.phase).toBe('recap')
    expect(state.outcome?.solved).toBe(true)
    // 12 s, unaided, first sighting of a new card: Good (Easy is held back on a first look).
    expect(state.outcome?.grade).toBe('good')
    expect(state.outcome?.card.state).toBe('learning')
    expect(state.outcome?.card.reps).toBe(1)
  })

  it('does not requeue a recalled card', () => {
    const state = solveLine(startSession([lineItem('a')], T), T + 12_000)
    expect(state.items).toHaveLength(1)
  })
})

describe('a miss', () => {
  it('ends the attempt on a wrong move and grades it Again', () => {
    const state = run(startSession([lineItem('a')], T), [play('f6', 'e7', T + 4_000)])
    expect(state.phase).toBe('recap')
    expect(state.outcome?.solved).toBe(false)
    expect(state.outcome?.grade).toBe('again')
    expect(state.outcome?.card.state).toBe('learning')
    expect(state.outcome?.card.due).toBe(T + 4_000 + 60_000)
  })

  it('asking to be shown the answer is a miss too', () => {
    const state = run(startSession([lineItem('a')], T), [{ type: 'give-up', at: T + 2_000 }])
    expect(state.outcome?.grade).toBe('again')
  })

  it('gives a missed card exactly one second look in the same sitting', () => {
    let state = startSession([lineItem('a')], T)
    state = run(state, [play('f6', 'e7', T + 1_000), { type: 'next', at: T + 2_000 }])
    expect(state.items).toHaveLength(2)
    expect(totalCards(state)).toBe(1)
    expect(state.phase).toBe('solving')
    expect(currentItem(state)?.card.state).toBe('learning')

    state = run(state, [play('f6', 'e7', T + 3_000), { type: 'next', at: T + 4_000 }])
    expect(state.items).toHaveLength(2)
    expect(state.phase).toBe('done')
  })
})

describe('hints', () => {
  it('a nudge makes a correct recall Hard', () => {
    let state = startSession([lineItem('a')], T)
    state = run(state, [{ type: 'hint', level: 'nudge' }])
    expect(state.hint?.text).toBeTruthy()
    state = solveLine(state, T + 10_000)
    expect(state.outcome?.grade).toBe('hard')
  })

  it('being shown the move makes it Again even when played correctly', () => {
    let state = startSession([lineItem('a')], T)
    state = run(state, [
      { type: 'hint', level: 'nudge' },
      { type: 'hint', level: 'square' },
      { type: 'hint', level: 'move' },
    ])
    state = solveLine(state, T + 10_000)
    expect(state.outcome?.solved).toBe(true)
    expect(state.outcome?.grade).toBe('again')
  })
})

describe('time', () => {
  it('a slow unaided find is Hard', () => {
    const state = solveLine(startSession([lineItem('a')], T), T + 60_000)
    expect(state.outcome?.grade).toBe('hard')
  })

  it('a quick find on a card seen before is Easy', () => {
    const seen = lineItem('a', {
      state: 'review',
      stability: 5,
      difficulty: 5,
      reps: 3,
      lastReviewedAt: toTimestamp(T - 5 * 86_400_000),
      scheduledDays: 5,
    })
    const state = solveLine(startSession([seen], T), T + 5_000)
    expect(state.outcome?.grade).toBe('easy')
  })
})

describe('moving on', () => {
  it('ignores moves once the recap is showing', () => {
    const recap = solveLine(startSession([lineItem('a'), lineItem('b')], T), T + 12_000)
    expect(reduceSession(recap, play('f6', 'e7', T + 20_000))).toBe(recap)
  })

  it('advances to the next card and restarts the clock', () => {
    let state = solveLine(startSession([lineItem('a'), lineItem('b')], T), T + 12_000)
    state = run(state, [{ type: 'next', at: T + 15_000 }])
    expect(currentItem(state)?.card.id).toBe('b')
    expect(state.startedAtMs).toBe(T + 15_000)
    expect(state.outcome).toBeNull()
    state = solveLine(state, T + 15_000 + 9_000)
    expect(state.outcome?.durationMs).toBe(9_000)
  })

  it('finishes after the last card and summarises the sitting', () => {
    let state = startSession([lineItem('a'), lineItem('b')], T)
    state = solveLine(state, T + 12_000)
    state = run(state, [{ type: 'next', at: T + 13_000 }, play('f6', 'e7', T + 20_000)])
    state = run(state, [{ type: 'next', at: T + 21_000 }])
    // The missed card comes round once more; recall it this time.
    state = solveLine(state, T + 30_000)
    state = run(state, [{ type: 'next', at: T + 31_000 }])
    expect(state.phase).toBe('done')
    const summary = summarise(state)
    expect(summary.attempted).toBe(3)
    expect(summary.recalled).toBe(2)
    expect(summary.toRevisit).toBe(1)
  })

  it('draws one dot per queued attempt', () => {
    let state = startSession([lineItem('a'), lineItem('b')], T)
    expect(progressDots(state)).toEqual(['current', 'todo'])
    state = solveLine(state, T + 12_000)
    expect(progressDots(state)).toEqual(['solved', 'todo'])
  })
})
