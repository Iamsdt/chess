import { applyMove, legalMoves, uciToSan } from '@/chess'
import { toSquare, type HintLevel, type Square } from '@/domain'

import { expectedMove, type SolveState } from './solution'

/**
 * The hint ladder: a nudge, then a square, then the move.
 *
 * Every rung is built from the puzzle's own line rather than written by hand, so a hint
 * is never wrong and never out of date. The wording is the part that matters: a hint
 * describes what to look at, never what the user failed to see, and the last rung says
 * plainly that it ends the rating for this puzzle *before* it is opened.
 */

export interface HintRung {
  readonly level: HintLevel
  readonly title: string
  /** What opening this rung will do, shown while it is still closed. */
  readonly description: string
  /** Whether opening it leaves the attempt unrated. Only the last rung does. */
  readonly endsRating: boolean
}

export const HINT_RUNGS: readonly HintRung[] = [
  {
    level: 'nudge',
    title: 'Nudge',
    description: 'One sentence about where to look',
    endsRating: false,
  },
  {
    level: 'square',
    title: 'Focus square',
    description: 'Circles the key square on the board',
    endsRating: false,
  },
  {
    level: 'move',
    title: 'Show the move',
    description: "Then you replay it from the start. This one won't count toward your rating.",
    endsRating: true,
  },
]

/**
 * Theme-shaped nudges.
 *
 * Only the themes that carry the dataset are spelled out; everything else falls back to
 * the generic line, which is true of every tactic ever played.
 */
const THEME_NUDGES: Record<string, string> = {
  fork: 'One of your pieces can attack two things at once. Which two?',
  pin: 'Something of theirs cannot move without exposing what is behind it.',
  skewer: 'The valuable piece is in front. Make it move.',
  discoveredAttack: 'Moving one piece can open a line for another.',
  deflection: 'A defender is doing two jobs. Give it a third.',
  backRankMate: 'Count the escape squares along their back rank.',
  mateIn1: 'The king has fewer squares than it looks.',
  mateIn2: 'Start with the move they have to answer.',
  mateIn3: 'Force the reply first, then look again.',
  endgame: 'Where does each king want to be in ten moves?',
  hangingPiece: 'Something of theirs is not defended.',
  sacrifice: 'The material comes back. Look one move further.',
}

const GENERIC_NUDGE = 'Look for the move that does two jobs at once.'

export interface RevealedHint {
  readonly level: HintLevel
  readonly text: string
  /** Squares the board should circle. Empty for the nudge. */
  readonly focus: readonly Square[]
  readonly endsRating: boolean
}

/**
 * The hint for one rung, computed from the position.
 *
 * Why checks and captures come before the theme: "checks, captures, threats" is the order
 * the solver's own copy teaches, and a nudge that names the first of those is a better
 * lesson than one that names the tactic.
 */
export function hintFor(state: SolveState, level: HintLevel): RevealedHint {
  const expected = expectedMove(state)
  const endsRating = level === 'move'
  if (expected === null) {
    return { level, text: GENERIC_NUDGE, focus: [], endsRating }
  }
  const from = toSquare(expected.slice(0, 2))
  const to = toSquare(expected.slice(2, 4))

  if (level === 'square') {
    return {
      level,
      text: `The move you are looking for ends on ${to}.`,
      focus: [to],
      endsRating,
    }
  }

  if (level === 'move') {
    const san = uciToSan(state.game.fen, expected)
    const named = san.ok ? san.value : `${from}–${to}`
    return {
      level,
      text: `The move is ${named}. Play it here, then the idea is yours to keep.`,
      focus: [from, to],
      endsRating,
    }
  }

  return { level, text: nudgeText(state, expected, from, to), focus: [], endsRating }
}

function nudgeText(state: SolveState, expected: string, from: Square, to: Square): string {
  const move = legalMoves(state.game).find((legal) => legal.from === from && legal.to === to)
  const after = applyMove(state.game, expected)
  const givesCheck =
    after.ok &&
    (after.value.status.kind === 'checkmate' ||
      (after.value.status.kind === 'in-progress' && after.value.status.inCheck))

  if (givesCheck) return 'Look for a check. That is always the first question.'
  if (move?.isCapture === true) return 'There is a capture here worth looking at twice.'
  return THEME_NUDGES[state.puzzle.theme] ?? GENERIC_NUDGE
}

/** The next rung the user may open, or `null` when the ladder is spent. */
export function nextRung(used: HintLevel | null): HintRung | null {
  const index = used === null ? 0 : HINT_RUNGS.findIndex((rung) => rung.level === used) + 1
  return HINT_RUNGS[index] ?? null
}
