import { createGame, playMoves } from '@/chess'
import { LADDER_EXTRAS, LADDER_FOLLOW_LINES } from '@/coach/fixtures/visualization-fixtures'
import type { VisualizationAttachment, VisualizationExercise } from '@/domain'
import { trackPiece } from '@/features/drills/blindfold'

import {
  LADDER_VIEWS,
  LINE_LENGTHS,
  bandOf,
  narrationOf,
  plies,
  viewOf,
  type Dials,
  type PieceBand,
} from './ladder'

import type { NarrationLevel } from './narrate'

/** The five exercises of a ladder run: mostly following a line, with a change of pace. */
export const LADDER_PLAN: readonly VisualizationExercise[] = [
  'follow-line',
  'follow-line',
  'whats-hanging',
  'follow-line',
  'is-it-check',
]

const BAND_PIECES: Readonly<Record<PieceBand, number>> = { few: 5, some: 26, full: 31 }

const pieceCount = (att: VisualizationAttachment): number =>
  (att.fen.split(' ')[0]?.match(/[a-z]/gi) ?? []).length

/** The ply (1-based) at which the tracked piece first moves, or `Infinity` if it never does. */
function firstMovePly(att: VisualizationAttachment): number {
  const track = att.target?.square
  const start = createGame(att.fen)
  if (track === undefined || !start.ok) return Infinity
  const played = playMoves(start.value, att.moves)
  if (!played.ok) return Infinity
  for (let i = 1; i <= played.value.history.length; i += 1) {
    if (trackPiece(played.value.history.slice(0, i), track) !== track) return i
  }
  return Infinity
}

/** Only follow-line and pick-picture questions survive a shorter line; the rest keep theirs. */
const SHORTENABLE: readonly VisualizationExercise[] = ['follow-line', 'pick-picture']

/** The attachment with the dials applied: view always, line length where it makes sense. */
export function applyDials(att: VisualizationAttachment, dials: Dials): VisualizationAttachment {
  const shorten = SHORTENABLE.includes(att.exercise)
  return {
    ...att,
    view: viewOf(dials),
    moves: shorten
      ? att.moves.slice(0, Math.max(2, Math.min(att.moves.length, plies(dials))))
      : att.moves,
  }
}

export interface LadderExercise {
  readonly attachment: VisualizationAttachment
  readonly narration: NarrationLevel
  /** Plies the user is asked to hold; what span is measured in. */
  readonly plies: number
}

/** The `index`-th exercise of a run, chosen to match the dials. */
export function ladderExercise(dials: Dials, index: number): LadderExercise {
  const kind = LADDER_PLAN[index % LADDER_PLAN.length] ?? 'follow-line'
  let chosen: VisualizationAttachment | undefined
  if (kind === 'follow-line') {
    const want = BAND_PIECES[bandOf(dials)]
    const length = plies(dials)
    const usable = LADDER_FOLLOW_LINES.filter((line) => firstMovePly(line) <= length)
    const pool = usable.length > 0 ? usable : LADDER_FOLLOW_LINES
    const nearest = Math.min(...pool.map((line) => Math.abs(pieceCount(line) - want)))
    const group = pool.filter((line) => Math.abs(pieceCount(line) - want) === nearest)
    chosen = group[index % group.length]
  } else {
    const group = LADDER_EXTRAS.filter((extra) => extra.exercise === kind)
    chosen = group[Math.floor(index / LADDER_PLAN.length) % Math.max(1, group.length)] ?? group[0]
  }
  const base = chosen ?? LADDER_FOLLOW_LINES[0]
  if (base === undefined) throw new Error('The ladder has no exercises')
  const attachment = kind === 'follow-line' ? applyDials(base, dials) : base
  return {
    attachment,
    narration: narrationOf(dials),
    plies: attachment.moves.length,
  }
}

/** Dials that match a single card, so "Step down" on a card has somewhere to start. */
export function dialsFromAttachment(att: VisualizationAttachment): Dials {
  const length = LINE_LENGTHS.findIndex((value) => value >= att.moves.length)
  const view = LADDER_VIEWS.findIndex((value) => value === att.view)
  return {
    length: length < 0 ? LINE_LENGTHS.length - 1 : length,
    view: view < 0 ? LADDER_VIEWS.length - 1 : view,
    pieces: pieceCount(att) <= 8 ? 0 : pieceCount(att) <= 28 ? 1 : 2,
    narration: att.level <= 3 ? 0 : att.level <= 5 ? 1 : 2,
  }
}
