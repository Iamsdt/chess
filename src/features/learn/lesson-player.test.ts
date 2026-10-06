import { describe, expect, it } from 'vitest'

import {
  START_FEN,
  makeLesson,
  makeLessonStep,
  toFen,
  toLessonStepId,
  toSan,
  toSquare,
} from '@/domain'
import type { Lesson, LessonStep } from '@/domain'

import {
  hintLadder,
  initialState,
  isFinalStep,
  judgeMove,
  legalMoveMap,
  playerReducer,
  positionAfter,
  summarise,
  type PlayerEvent,
} from './lesson-player'

const sq = toSquare

function moveStep(overrides: Partial<LessonStep> = {}): LessonStep {
  return makeLessonStep({
    id: toLessonStepId('s-move'),
    index: 1,
    kind: 'move',
    fen: START_FEN,
    orientation: 'white',
    expectedMoves: [toSan('e4')],
    alternativeMoves: [toSan('d4')],
    hints: [],
    ...overrides,
  })
}

function lessonOf(...steps: LessonStep[]): Lesson {
  return makeLesson({ steps: steps.map((step, index) => ({ ...step, index })) })
}

const info = makeLessonStep({ id: toLessonStepId('s-info'), kind: 'info', expectedMoves: [] })

describe('judgeMove', () => {
  it('accepts the expected move, whatever suffix the author wrote', () => {
    const step = moveStep({ expectedMoves: [toSan('e4')] })
    expect(judgeMove(step, { from: sq('e2'), to: sq('e4') })).toMatchObject({
      verdict: 'correct',
      san: 'e4',
    })
    const withCheck = moveStep({
      fen: toFen('rnbqkbnr/ppp2ppp/8/3pp3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3'),
      expectedMoves: [toSan('Qh5+')],
    })
    expect(judgeMove(withCheck, { from: sq('d1'), to: sq('h5') }).verdict).toBe('correct')
  })

  it('hands back the position after a good move', () => {
    const result = judgeMove(moveStep(), { from: sq('e2'), to: sq('e4') })
    expect(result.fenAfter).toContain('4P3')
  })

  it('treats a listed alternative as its own verdict, not a mistake', () => {
    expect(judgeMove(moveStep(), { from: sq('d2'), to: sq('d4') }).verdict).toBe('alternative')
  })

  it('calls any other legal move wrong and reports it back', () => {
    expect(judgeMove(moveStep(), { from: sq('a2'), to: sq('a3') })).toMatchObject({
      verdict: 'wrong',
      san: 'a3',
    })
  })

  it('does not call an illegal move wrong: it never happened', () => {
    expect(judgeMove(moveStep(), { from: sq('e2'), to: sq('e5') }).verdict).toBe('illegal')
  })
})

describe('legalMoveMap and positionAfter', () => {
  it('lists where each piece can go', () => {
    const map = legalMoveMap(START_FEN)
    expect(map.get(sq('e2'))).toEqual(expect.arrayContaining([sq('e3'), sq('e4')]))
    expect(map.get(sq('e1'))).toBeUndefined()
    expect(map.get(sq('g1'))).toHaveLength(2)
  })

  it('shows the answer position for a move step and the same one for a read step', () => {
    expect(positionAfter(moveStep())).toContain('4P3')
    expect(positionAfter(info)).toBe(info.fen)
  })
})

describe('hintLadder', () => {
  it('has no ladder for a step that is only read', () => {
    expect(hintLadder(info)).toEqual([])
  })

  it('uses the author’s hint first, then the piece, then the move', () => {
    const rungs = hintLadder(
      moveStep({ expectedMoves: [toSan('Nf3')], hints: ['Develop toward the centre.'] }),
    )
    expect(rungs.map((r) => r.label)).toEqual(['Nudge', 'The piece', 'The move'])
    expect(rungs[0]?.text).toBe('Develop toward the centre.')
    expect(rungs[1]?.text).toBe('Move your knight.')
    expect(rungs[2]?.text).toBe('Play Nf3.')
  })

  it('still has three rungs when the author wrote no hint, and names pawns and castling', () => {
    expect(hintLadder(moveStep())[1]?.text).toBe('Move your pawn.')
    expect(hintLadder(moveStep({ expectedMoves: [toSan('O-O')] }))[1]?.text).toBe(
      'This is a castling move.',
    )
  })
})

describe('playerReducer', () => {
  const lesson = lessonOf(info, moveStep(), moveStep({ expectedMoves: [toSan('d4')] }), info)
  const run = (events: PlayerEvent[], from = initialState(lesson)) =>
    events.reduce((state, event) => playerReducer(lesson, state, event), from)

  it('starts an info step already done, and a move step open', () => {
    expect(initialState(lesson).solved).toBe(true)
    expect(initialState(lesson, 1).solved).toBe(false)
  })

  it('clamps a stale start index into the lesson', () => {
    expect(initialState(lesson, 99).index).toBe(3)
    expect(initialState(lesson, -4).index).toBe(0)
  })

  it('solves a move step first try when nothing went wrong', () => {
    const state = run([
      { type: 'go', index: 1 },
      { type: 'move', verdict: 'correct', san: 'e4' },
    ])
    expect(state.solved).toBe(true)
    expect(state.results[1]).toEqual({ firstTry: true, hints: 0, misses: 0 })
  })

  it('counts misses and alternatives and keeps the step open', () => {
    const state = run([
      { type: 'go', index: 1 },
      { type: 'move', verdict: 'wrong', san: 'a3' },
      { type: 'move', verdict: 'alternative', san: 'd4' },
    ])
    expect(state).toMatchObject({ solved: false, misses: 2 })
    expect(state.feedback?.verdict).toBe('alternative')
  })

  it('ignores illegal moves entirely', () => {
    const before = run([{ type: 'go', index: 1 }])
    expect(run([{ type: 'move', verdict: 'illegal', san: undefined }], before)).toEqual(before)
  })

  it('takes a hint at a time up to three, and a hint ends first-try credit', () => {
    const state = run([
      { type: 'go', index: 1 },
      { type: 'hint' },
      { type: 'hint' },
      { type: 'hint' },
      { type: 'hint' },
      { type: 'move', verdict: 'correct', san: 'e4' },
    ])
    expect(state.hintsShown).toBe(3)
    expect(state.results[1]).toEqual({ firstTry: false, hints: 3, misses: 0 })
  })

  it('gives no hints on a step that is only read, and none after it is solved', () => {
    expect(run([{ type: 'hint' }]).hintsShown).toBe(0)
    const solved = run([
      { type: 'go', index: 1 },
      { type: 'move', verdict: 'correct', san: 'e4' },
      { type: 'hint' },
    ])
    expect(solved.hintsShown).toBe(0)
  })

  it('shows a step already solved as solved when going back to it', () => {
    const state = run([
      { type: 'go', index: 1 },
      { type: 'move', verdict: 'correct', san: 'e4' },
      { type: 'go', index: 2 },
      { type: 'go', index: 1 },
    ])
    expect(state.solved).toBe(true)
    expect(state.results[1]?.firstTry).toBe(true)
  })

  it('clears feedback on retry', () => {
    const state = run([
      { type: 'go', index: 1 },
      { type: 'move', verdict: 'wrong', san: 'a3' },
      { type: 'retry' },
    ])
    expect(state.feedback).toBeNull()
    expect(state.misses).toBe(1)
  })
})

describe('summarise and isFinalStep', () => {
  const lesson = lessonOf(info, moveStep(), moveStep(), info)

  it('totals move steps, first tries, hints and misses', () => {
    expect(
      summarise(lesson, {
        1: { firstTry: true, hints: 0, misses: 0 },
        2: { firstTry: false, hints: 2, misses: 1 },
      }),
    ).toEqual({ moveSteps: 2, firstTry: 1, hints: 2, misses: 1 })
  })

  it('knows the last step is the completion card', () => {
    expect(isFinalStep(lesson, 2)).toBe(false)
    expect(isFinalStep(lesson, 3)).toBe(true)
  })
})
