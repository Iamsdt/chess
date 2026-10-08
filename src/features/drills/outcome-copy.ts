import type { DrillFailure, DrillOutcome, DrillStars } from './endgame-session'

/**
 * What the drill says when it ends.
 *
 * Kept apart from the screen so the over-par wording, the part of the sprint's "done
 * when" that is easiest to get subtly wrong, is covered by plain unit tests.
 */

const FAILURE_COPY: Readonly<Record<DrillFailure, string>> = {
  checkmated: 'You were checkmated.',
  stalemate: 'Stalemate. The game is a draw, so the win slipped away.',
  repetition: 'The same position came up three times, so the game is drawn.',
  'fifty-move': 'Fifty moves without a capture or a pawn move: a draw.',
  'insufficient-material': 'Not enough material left to mate: a draw.',
  'material-lost': 'You gave up the material that made this a win.',
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`
}

/** "Over par by 2" is the point of the star rating, so it is spelled out. */
export function describeOutcome(outcome: DrillOutcome, par: number): string | null {
  if (outcome.kind === 'playing') return null
  if (outcome.kind === 'failed') return FAILURE_COPY[outcome.reason]

  const moves = plural(outcome.moves, 'move')
  if (outcome.how === 'drawn') return 'Draw secured. You held the position.'
  if (outcome.how === 'held') return `You held for ${moves}. The draw is yours.`

  const what = outcome.how === 'checkmate' ? 'Checkmate' : 'Promoted and held the queen'
  if (!outcome.overPar) {
    return `${what} in ${moves}. At or under par ${String(par)}.`
  }
  return `${what} in ${moves}: technically won, ${plural(outcome.moves - par, 'move')} over par ${String(par)}.`
}

export function starsLabel(stars: number): string {
  return `${String(stars)} of 3 stars`
}

/** A short verdict for the status line under the board. */
export function outcomeHeadline(outcome: DrillOutcome): string | null {
  if (outcome.kind === 'playing') return null
  if (outcome.kind === 'failed') return 'Drill failed'
  const stars: DrillStars = outcome.stars
  if (outcome.how === 'drawn' || outcome.how === 'held') return `Draw held · ${starsLabel(stars)}`
  return outcome.overPar
    ? `Won, over par · ${starsLabel(stars)}`
    : `Drill complete · ${starsLabel(stars)}`
}
