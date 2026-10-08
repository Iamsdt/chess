import {
  parseValid,
  PuzzleSchema,
  toPuzzleId,
  type MistakeEntry,
  type Puzzle,
  type Result,
} from '@/domain'

/**
 * A stored mistake dressed as a puzzle, so the solver's board, hint ladder and move
 * checking can be reused for a review without a second solver.
 *
 * Why this and not a parallel state machine: the solver already knows multi-move lines,
 * forced replies, promotion and "a mating move is always right". Every rating field here
 * is a placeholder the solver never reads; the schema just requires them.
 */
export function puzzleFromMistake(mistake: MistakeEntry): Result<Puzzle> {
  const side = mistake.yourColor === 'white' ? 'White' : 'Black'
  return parseValid(
    PuzzleSchema,
    {
      id: toPuzzleId(`review_${mistake.id}`),
      fen: mistake.fen,
      solution: mistake.solution,
      band: 'pawn',
      subLevel: 1,
      difficulty: 'beginner',
      title: 'Find the better move',
      theme: mistake.themes[0] ?? 'tactic',
      prompt: `${side} to move.`,
      rating: 1500,
      ratingLabel: 'Review',
      tags: mistake.themes,
      explanation: mistake.explanation,
      source: 'mistake',
    },
    'srs.puzzleFromMistake',
  )
}
