import { describe, expect, it } from 'vitest'

import { makeCoachContext } from '@/domain'

import {
  asksForSolution,
  correctionFor,
  createAnswerGuard,
  createEvidence,
  extractEvalClaims,
  extractLines,
  findSpoilers,
  recordToolEvidence,
  splitSentences,
  validateLines,
  verifyEvalClaims,
} from './guardrails'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function claimsOf(text: string) {
  return extractEvalClaims(text).map((claim) => [claim.kind, claim.value, claim.signed])
}

describe('extractEvalClaims', () => {
  it('finds signed pawn evaluations in both minus spellings', () => {
    expect(claimsOf('White is better at +0.8 here.')).toEqual([['cp', 0.8, true]])
    expect(claimsOf('That drops to −1.5 after Qxd5.')).toEqual([['cp', -1.5, true]])
    expect(claimsOf('about -2,3 by now')).toEqual([['cp', -2.3, true]])
  })

  it('finds worded, centipawn and mate claims', () => {
    expect(claimsOf('The engine gives an eval of 2.3 for White.')).toEqual([['cp', 2.3, false]])
    expect(claimsOf('Roughly 80 cp ahead.')).toEqual([['cp', 0.8, false]])
    expect(claimsOf('That is -120 centipawns.')).toEqual([['cp', -1.2, true]])
    expect(claimsOf('There is a mate in 3.')).toEqual([['mate', 3, false]])
    expect(claimsOf('Stockfish shows -M4 for Black.')).toEqual([['mate', -4, true]])
  })

  it('ignores move numbers, ratings, percentages, clocks and counts', () => {
    const quiet = [
      'On move 14. Nxe5 wins a pawn.',
      'Your rating went from 1480 to 1512 (+32).',
      'You found it in 3 candidates after 12 moves.',
      'Accuracy was +4.5% this week.',
      'You had +2.5 seconds on the clock at 1:23.',
      'The game ended 1-0 after a 3-2 pawn majority fight.',
      'An evaluation of 3 candidates is plenty.',
      'The Nf3+ 1.5 hours later.',
    ]
    for (const text of quiet) expect(extractEvalClaims(text), text).toEqual([])
  })
})

describe('verifyEvalClaims', () => {
  const evidence = () => {
    const e = createEvidence()
    recordToolEvidence(e, {}, { summary: 'depth 18 · +0.8 · Nf3 best', mate: -3 }, undefined)
    return e
  }

  it('accepts a claim a tool result backs, within the tolerance', () => {
    expect(verifyEvalClaims(extractEvalClaims('It is +0.8.'), evidence())).toEqual([])
    expect(verifyEvalClaims(extractEvalClaims('Call it +0.9.'), evidence())).toEqual([])
  })

  it('rejects an invented evaluation, a wrong sign and an unbacked mate', () => {
    expect(verifyEvalClaims(extractEvalClaims('It is +2.5.'), evidence())).toHaveLength(1)
    expect(verifyEvalClaims(extractEvalClaims('It is -0.8.'), evidence())).toHaveLength(1)
    expect(verifyEvalClaims(extractEvalClaims('Mate in 5.'), evidence())).toHaveLength(1)
  })

  it('lets an unsigned magnitude match either side, and a mate match its own moves', () => {
    expect(verifyEvalClaims(extractEvalClaims('an eval of 0.8'), evidence())).toEqual([])
    expect(verifyEvalClaims(extractEvalClaims('Black has mate in 3.'), evidence())).toEqual([])
    expect(verifyEvalClaims(extractEvalClaims('-M3'), evidence())).toEqual([])
    expect(verifyEvalClaims(extractEvalClaims('+M3'), evidence())).toHaveLength(1)
  })

  it('reads engine-shaped scores and centipawn fields, but not the model-written tool input', () => {
    const e = createEvidence()
    recordToolEvidence(
      e,
      { note: 'the engine says +9.9' },
      { lines: [{ score: { kind: 'cp', value: 35 } }], evalCp: -120 },
      undefined,
    )
    expect(verifyEvalClaims(extractEvalClaims('+0.35'), e)).toEqual([])
    expect(verifyEvalClaims(extractEvalClaims('-1.2'), e)).toEqual([])
    expect(verifyEvalClaims(extractEvalClaims('+9.9'), e)).toHaveLength(1)
  })
})

describe('extractLines and validateLines', () => {
  it('extracts multi-move sequences, with or without move numbers', () => {
    expect(extractLines('Try 1. e4 e5 2. Nf3 Nc6 here.').map((l) => l.moves)).toEqual([
      ['e4', 'e5', 'Nf3', 'Nc6'],
    ])
    expect(extractLines('After Nxe5 Qxe5 Bxf7+ it is over.').map((l) => l.moves)).toEqual([
      ['Nxe5', 'Qxe5', 'Bxf7'],
    ])
  })

  it('ignores a lone move, candidate lists and prose', () => {
    expect(extractLines('Nf3 is natural, and so is the bishop on c4.')).toEqual([])
    expect(extractLines('Candidates: Nf3, d4 or c4.')).toEqual([])
    expect(extractLines('On move 14. Nxe5 wins.')).toEqual([])
  })

  it('accepts a legal line from the opening, and flags an illegal one', () => {
    const [legal] = extractLines('1. e4 e5 2. Nf3 Nc6')
    const [illegal] = extractLines('1. e4 e5 2. Nf6 Nc6')
    expect(validateLines(legal ? [legal] : [], [START])).toEqual([])
    expect(validateLines(illegal ? [illegal] : [], [START])).toHaveLength(1)
  })

  it('accepts a line from any known start, or a stretch of a tool-supplied line', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const lines = extractLines('Then e5 Nf3 Nc6 follows.')
    expect(validateLines(lines, [START])).toHaveLength(1)
    expect(validateLines(lines, [START, afterE4])).toEqual([])
    expect(validateLines(lines, [START], [['d4', 'e5', 'Nf3', 'Nc6', 'Bb5']])).toEqual([])
  })
})

describe('findSpoilers', () => {
  const evidence = () => {
    const e = createEvidence()
    recordToolEvidence(e, {}, { bestMove: 'Qh7+', summary: 'Qh7+ best' }, undefined)
    return e
  }
  const puzzle = makeCoachContext({
    spoilerGuard: true,
    activePuzzle: { id: 'p1' as never, theme: 'mate', rating: 1200 },
  })

  it('flags the best move when a puzzle is active and the guard is on', () => {
    expect(findSpoilers('Play Qh7 now.', evidence(), puzzle, 'hint?')).toEqual(['Qh7'])
    expect(findSpoilers('Look at the h-file.', evidence(), puzzle, 'hint?')).toEqual([])
  })

  it('stands down without a puzzle, without the guard, or when asked outright', () => {
    const e = evidence()
    expect(findSpoilers('Play Qh7.', e, makeCoachContext({ spoilerGuard: true }), 'hi')).toEqual([])
    expect(findSpoilers('Play Qh7.', e, { ...puzzle, spoilerGuard: false }, 'hi')).toEqual([])
    expect(findSpoilers('Play Qh7.', e, puzzle, 'Just tell me the answer')).toEqual([])
    expect(asksForSolution('what is the best move?')).toBe(true)
    expect(asksForSolution('give me a hint')).toBe(false)
  })
})

describe('splitSentences', () => {
  it('does not split inside move numbers, decimals or abbreviations', () => {
    const { sentences, rest } = splitSentences(
      'Try 1. e4 e5 2. Nf3, i.e. the Italian. It is +0.8. Next',
    )
    expect(sentences).toEqual(['Try 1. e4 e5 2. Nf3, i.e. the Italian. ', 'It is +0.8. '])
    expect(rest).toBe('Next')
  })
})

describe('createAnswerGuard', () => {
  const options = (context = makeCoachContext()) => ({
    context,
    userText: 'why?',
    thread: ['why?'],
  })

  it('releases clean sentences as they complete and holds the unfinished one', () => {
    const guard = createAnswerGuard(options())
    expect(guard.push('Knights love ')).toEqual({ released: '', problems: [] })
    expect(guard.push('the centre. They ')).toEqual({
      released: 'Knights love the centre. ',
      problems: [],
    })
    expect(guard.flush()).toEqual({ released: 'They ', problems: [] })
  })

  it('withholds a sentence with an invented evaluation and explains why', () => {
    const guard = createAnswerGuard(options())
    const step = guard.push('Fine opening. White stands at +2.5 now. ')
    expect(step.released).toBe('Fine opening. ')
    expect(step.problems).toHaveLength(1)
    expect(step.problems[0]?.kind).toBe('eval')
    expect(correctionFor(step.problems)).toContain('You stated "+2.5"')
  })

  it('passes the same sentence once a tool has returned that evaluation', () => {
    const guard = createAnswerGuard(options())
    guard.recordTool({}, { summary: '+2.5 · Qh5 best' })
    expect(guard.push('White stands at +2.5 now. ').problems).toEqual([])
  })

  it('catches an illegal line', () => {
    const guard = createAnswerGuard(options())
    const step = guard.push('Then 1. e4 e5 2. Nf6 Nc6 is forced. ')
    expect(step.problems.map((p) => p.kind)).toEqual(['line'])
  })
})
