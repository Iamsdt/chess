import { describe, expect, it } from 'vitest'

import { makePuzzle, toFen, toPuzzleId, toSquare, toUci, type Puzzle } from '@/domain'

import {
  createSolve,
  expectedMove,
  isPromotionMove,
  isUserTurn,
  legalMoveMap,
  markMissed,
  playOpponentReply,
  playUserMove,
  solutionSan,
  solveShapes,
  withHint,
  type SolveState,
} from './solution'

/** The fixture puzzle is row 1 of `band_bishop.csv`: Black plays Qf3+, Kg1, Qxe2. */
const puzzle = makePuzzle()

function solve(target: Puzzle = puzzle): SolveState {
  const state = createSolve(target)
  if (!state.ok) throw new Error(`the fixture puzzle does not load: ${state.error.message}`)
  return state.value
}

const move = (uci: string) => ({
  from: toSquare(uci.slice(0, 2)),
  to: toSquare(uci.slice(2, 4)),
})

describe('starting a puzzle', () => {
  it('opens on the position before the first move, with the user to play', () => {
    const state = solve()

    expect(state.game.fen).toBe(puzzle.fen)
    expect(state.userColor).toBe('black')
    expect(state.status).toBe('solving')
    expect(isUserTurn(state)).toBe(true)
    expect(expectedMove(state)).toBe(puzzle.solution[0])
  })

  it('refuses a puzzle whose position or line is broken, rather than throwing', () => {
    const noLine = createSolve(makePuzzle({ solution: [] }))

    expect(noLine.ok).toBe(false)
  })

  it('offers the board every legal move and no others', () => {
    const map = legalMoveMap(solve().game)

    expect(map.get(toSquare('f6'))).toContain(toSquare('f3'))
    expect(map.get(toSquare('a7'))).toEqual([toSquare('a6'), toSquare('a5')])
    expect(map.has(toSquare('d5'))).toBe(false)
  })
})

describe('playing the line', () => {
  it('walks the whole solution, playing the opponent replies back', () => {
    const [first, second, third] = puzzle.solution
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(third).toBeDefined()

    const opening = playUserMove(solve(), move(String(first)))
    expect(opening.verdict).toBe('correct')
    expect(opening.state.status).toBe('replying')

    const replied = playOpponentReply(opening.state)
    expect(replied.status).toBe('solving')
    expect(replied.lastMove).toEqual(move(String(second)))

    const finished = playUserMove(replied, move(String(third)))
    expect(finished.verdict).toBe('solved')
    expect(finished.state.status).toBe('solved')
    expect(finished.state.played).toHaveLength(2)
  })

  it('leaves the position untouched when the move is not the idea', () => {
    const state = solve()
    const attempt = playUserMove(state, move('a7a6'))

    expect(attempt.verdict).toBe('missed')
    expect(attempt.state.game.fen).toBe(state.game.fen)
    expect(attempt.state.wrongMoves).toBe(1)
    expect(attempt.state.status).toBe('solving')
    expect(attempt.state.played).toEqual([toUci('a7a6')])
  })

  it('accepts any mate, because a second mate in one is still a solution', () => {
    // Two rooks, one back rank: Rb8# and Re8# both finish it. The line names one of them.
    const twoMates = makePuzzle({
      id: toPuzzleId('two-mates'),
      fen: toFen('6k1/5ppp/8/8/8/8/5PPP/1R2R1K1 w - - 0 1'),
      solution: [toUci('b1b8')],
      prompt: 'White to move.',
    })
    const other = playUserMove(solve(twoMates), move('e1e8'))

    expect(other.verdict).toBe('solved')
    expect(other.state.status).toBe('solved')
  })

  it('stops accepting moves once the puzzle is over', () => {
    const solved = markMissed(solve())
    const after = playUserMove(solved, move('f6f3'))

    expect(after.verdict).toBe('missed')
    expect(after.state.status).toBe('missed')
  })

  it('knows when a move needs the promotion picker', () => {
    const promoting = solve(
      makePuzzle({
        id: toPuzzleId('promote'),
        fen: toFen('8/4P3/8/8/8/8/6k1/4K3 w - - 0 1'),
        solution: [toUci('e7e8q')],
        prompt: 'White to move.',
      }),
    )

    expect(isPromotionMove(promoting.game, toSquare('e7'), toSquare('e8'))).toBe(true)
    expect(isPromotionMove(solve().game, toSquare('f6'), toSquare('f3'))).toBe(false)
  })
})

describe('what the screen reads off the state', () => {
  it('names the line in SAN for the explanation and the replay', () => {
    const line = solutionSan(puzzle)

    expect(line.ok).toBe(true)
    if (line.ok) expect(line.value).toHaveLength(puzzle.solution.length)
  })

  it('highlights the last move and flags a king in check', () => {
    const [first] = puzzle.solution
    const played = playUserMove(solve(), move(String(first)))
    const shapes = solveShapes(played.state, { focus: [toSquare('e2')] })

    expect(shapes.highlight).toEqual([toSquare('f6'), toSquare('f3')])
    expect(shapes.focus).toEqual([toSquare('e2')])
    expect(shapes.check).toBe(toSquare('g2'))
  })

  it('remembers the highest hint rung reached and never walks it back', () => {
    const climbed = withHint(withHint(solve(), 'square'), 'nudge')

    expect(climbed.hintUsed).toBe('square')
    expect(climbed.hintCount).toBe(2)
    expect(withHint(climbed, 'move').hintCount).toBe(3)
  })
})
