import { toAttemptId, toPuzzleId, toSessionId } from '../ids'
import { toFen, toUci } from '../primitives'

import { FIXTURE_NOW, fixtureTimeAfter, withOverrides } from './base'

import type { Puzzle, PuzzleAttempt } from '../puzzle'

/**
 * A puzzle and an attempt at it.
 *
 * The puzzle is row 1 of `public/quiz/band_bishop.csv` copied verbatim, so any
 * test that asserts against the real dataset asserts against the same shape.
 */
export function makePuzzle(overrides?: Partial<Puzzle>): Puzzle {
  return withOverrides<Puzzle>(
    {
      id: toPuzzleId('lc_pTK5y'),
      fen: toFen('5r2/p4rk1/1p1p1qpp/3Qb3/2P1N3/6P1/PP2RPKP/R7 b - - 6 21'),
      solution: [toUci('f6f3'), toUci('g2g1'), toUci('f3e2')],
      band: 'bishop',
      subLevel: 1,
      difficulty: 'beginner',
      title: 'Bishop 1 · Fork',
      theme: 'fork',
      prompt: 'Black to move.',
      rating: 1144,
      ratingLabel: 'Casual',
      tags: ['crushing', 'fork', 'middlegame', 'short'],
      explanation: 'A fork — one piece attacks two enemy pieces at once, forcing a material win.',
      active: true,
      source: 'lichess',
      lichessId: 'pTK5y',
      plays: 26_189,
      popularity: 95,
      openingTags: [],
    },
    overrides,
  )
}

export function makePuzzleAttempt(overrides?: Partial<PuzzleAttempt>): PuzzleAttempt {
  return withOverrides<PuzzleAttempt>(
    {
      id: toAttemptId('attempt-fixture-1'),
      puzzleId: toPuzzleId('lc_pTK5y'),
      sessionId: toSessionId('session-fixture-1'),
      mode: 'adaptive-puzzles',
      startedAt: FIXTURE_NOW,
      endedAt: fixtureTimeAfter(1),
      durationMs: 24_000,
      solved: true,
      firstTry: true,
      skipped: false,
      movesPlayed: [toUci('f6f3'), toUci('f3e2')],
      hintUsed: null,
      hintCount: 0,
      puzzleRating: 1144,
      ratingBefore: 1473,
      ratingAfter: 1482,
      ratingDeviationBefore: 62.5,
      ratingDeviationAfter: 60.1,
      rated: true,
    },
    overrides,
  )
}
