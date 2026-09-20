import { describe, expect, it } from 'vitest'

import { makePuzzle, toFen, toPuzzleId, toSquare, toUci } from '@/domain'
import type { Puzzle } from '@/domain'

import { HINT_RUNGS, hintFor, nextRung } from './hints'
import { createSolve, type SolveState } from './solution'

function solve(puzzle: Puzzle = makePuzzle()): SolveState {
  const state = createSolve(puzzle)
  if (!state.ok) throw new Error(state.error.message)
  return state.value
}

describe('the hint ladder', () => {
  it('climbs nudge, square, move, and stops', () => {
    expect(HINT_RUNGS.map((rung) => rung.level)).toEqual(['nudge', 'square', 'move'])
    expect(nextRung(null)?.level).toBe('nudge')
    expect(nextRung('nudge')?.level).toBe('square')
    expect(nextRung('square')?.level).toBe('move')
    expect(nextRung('move')).toBeNull()
  })

  it('says which rung costs the rating, and it is only the last one', () => {
    expect(HINT_RUNGS.filter((rung) => rung.endsRating).map((rung) => rung.level)).toEqual(['move'])
  })
})

describe('what each rung says', () => {
  it('nudges toward the check when the move is one', () => {
    // The fixture puzzle's first move, Qf3+, is a check.
    const hint = hintFor(solve(), 'nudge')

    expect(hint.text).toMatch(/check/i)
    expect(hint.focus).toEqual([])
    expect(hint.endsRating).toBe(false)
  })

  it('nudges toward the capture when the move takes something', () => {
    const capture = makePuzzle({
      id: toPuzzleId('capture'),
      fen: toFen('4k3/8/8/3p4/4B3/8/8/4K3 w - - 0 1'),
      solution: [toUci('e4d5')],
      theme: 'hangingPiece',
      prompt: 'White to move.',
    })

    expect(hintFor(solve(capture), 'nudge').text).toMatch(/capture/i)
  })

  it('falls back to the theme when the move is quiet', () => {
    const quiet = makePuzzle({
      id: toPuzzleId('quiet'),
      fen: toFen('4k3/8/8/8/8/8/4B3/4K3 w - - 0 1'),
      solution: [toUci('e2c4')],
      theme: 'pin',
      prompt: 'White to move.',
    })

    expect(hintFor(solve(quiet), 'nudge').text).toBe(
      'Something of theirs cannot move without exposing what is behind it.',
    )
  })

  it('circles the square the move lands on, without naming the piece', () => {
    const hint = hintFor(solve(), 'square')

    expect(hint.focus).toEqual([toSquare('f3')])
    expect(hint.text).toContain('f3')
    expect(hint.endsRating).toBe(false)
  })

  it('names the move in the notation the board speaks, and says it ends the rating', () => {
    const hint = hintFor(solve(), 'move')

    expect(hint.text).toContain('Qf3+')
    expect(hint.focus).toEqual([toSquare('f6'), toSquare('f3')])
    expect(hint.endsRating).toBe(true)
  })

  it('never shames: no rung mentions what the user missed or got wrong', () => {
    for (const rung of HINT_RUNGS) {
      const hint = hintFor(solve(), rung.level)
      expect(hint.text).not.toMatch(/wrong|failed|should have|mistake/i)
    }
  })
})
