import { pieceAt, type PlayedMove } from '@/chess'
import { toFen, type BoardShapes, type BoardView, type Fen, type Square } from '@/domain'
import { trackPiece } from '@/features/drills/blindfold'
import { ALL_SQUARES } from '@/features/drills/vision-squares'

/**
 * Pure display rules for the board views (coach-agent.md §10.1): what to draw for a view,
 * so the dialog only has to render it. Blindfold has no FEN at all (a FEN needs two
 * kings), so a hidden board is `null` here and drawn by `BlankBoard`.
 */

export const PARTIAL_MODES = ['no-pawns', 'one-side', 'kings'] as const
export type PartialMode = (typeof PARTIAL_MODES)[number]

export const PARTIAL_LABELS: Readonly<Record<PartialMode, string>> = {
  'no-pawns': 'pawns hidden',
  'one-side': 'Black hidden',
  kings: 'only the kings shown',
}

/** Harder levels show less. */
export function partialModeFor(level: number): PartialMode {
  if (level <= 3) return 'no-pawns'
  if (level <= 5) return 'one-side'
  return 'kings'
}

/** `fen` with some pieces left off; both kings always stay, since a position needs them. */
export function partialFen(fen: Fen, mode: PartialMode): Fen {
  const [placement = '', side = 'w'] = fen.split(' ')
  const keep = (char: string): boolean => {
    if (char === 'K' || char === 'k') return true
    if (mode === 'kings') return false
    if (mode === 'no-pawns') return char !== 'P' && char !== 'p'
    return char === char.toUpperCase()
  }
  const rows = placement.split('/').map((row) => {
    let text = ''
    let empty = 0
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        empty += Number(char)
        continue
      }
      if (keep(char)) {
        if (empty > 0) text += String(empty)
        empty = 0
        text += char
      } else {
        empty += 1
      }
    }
    return empty > 0 ? text + String(empty) : text
  })
  return toFen(`${rows.join('/')} ${side} - - 0 1`)
}

/** The FEN letter for a moved piece: upper case for White. */
export const ghostLetter = (move: PlayedMove): string =>
  move.color === 'white' ? move.piece.toUpperCase() : move.piece

/** What a screen draws: a position, or an empty board. */
export interface Display {
  readonly fen: Fen | null
  readonly shapes: BoardShapes
  readonly caption: string
}

const plain: BoardShapes = { highlight: [], focus: [], check: null, arrows: [], marks: [] }
export const shapesWith = (patch: Partial<BoardShapes>): BoardShapes => ({ ...plain, ...patch })

interface Line {
  readonly positions: readonly Fen[]
  readonly history: readonly PlayedMove[]
}

/** True for the views that hide pieces once the question is asked. */
export const hidesBoard = (view: BoardView): boolean => view === 'blindfold' || view === 'flash'

/**
 * The board while the line is being read. `step` is how many moves have been announced
 * (0 = none yet). Ghost shows the board *before* the announced move, with the piece
 * faint on the square it is going to.
 */
export function watchDisplay(view: BoardView, line: Line, step: number, level: number): Display {
  const total = line.history.length
  const at = Math.min(step, total)
  const last = at > 0 ? line.history[at - 1] : undefined
  const highlight = last === undefined ? [] : [last.from, last.to]
  const fen = line.positions[at] ?? line.positions[0]
  if (fen === undefined) return { fen: null, shapes: plain, caption: 'Blindfold' }
  switch (view) {
    case 'normal':
      return { fen, shapes: shapesWith({ highlight }), caption: 'Normal view' }
    case 'ghost': {
      const next = line.history[at]
      const before = line.positions[at] ?? fen
      return next === undefined
        ? { fen, shapes: shapesWith({ highlight }), caption: 'Ghost view' }
        : {
            fen: before,
            shapes: shapesWith({
              highlight: [next.from],
              ghosts: [{ square: next.to, piece: ghostLetter(next) }],
            }),
            caption: 'Ghost view',
          }
    }
    case 'frozen': {
      const start = line.positions[0] ?? fen
      return { fen: start, shapes: plain, caption: 'Frozen: the board stays at the start' }
    }
    case 'partial': {
      const mode = partialModeFor(level)
      return {
        fen: partialFen(fen, mode),
        shapes: shapesWith({ highlight }),
        caption: `Partial view: ${PARTIAL_LABELS[mode]}`,
      }
    }
    case 'blindfold':
    case 'flash':
      return { fen: null, shapes: plain, caption: 'Blindfold: no pieces' }
  }
}

/** The board once the question is on screen. */
export function askDisplay(view: BoardView, line: Line, level: number): Display {
  const final = line.positions.at(-1)
  const start = line.positions[0]
  if (final === undefined || start === undefined) return { fen: null, shapes: plain, caption: '' }
  switch (view) {
    case 'normal':
      return { fen: final, shapes: plain, caption: 'Normal view' }
    case 'ghost':
      return { fen: final, shapes: plain, caption: 'Ghost view' }
    case 'frozen':
      return { fen: start, shapes: plain, caption: 'Frozen: the board is still at the start' }
    case 'partial': {
      const mode = partialModeFor(level)
      return {
        fen: partialFen(final, mode),
        shapes: plain,
        caption: `Partial view: ${PARTIAL_LABELS[mode]}`,
      }
    }
    case 'blindfold':
    case 'flash':
      return { fen: null, shapes: plain, caption: 'Blindfold: no pieces' }
  }
}

/**
 * Two or three landmark squares to hang the picture on: the piece that moved most, then
 * the kings. Squares only, never piece names.
 */
export function anchorSquares(line: Line): readonly Square[] {
  const final = line.positions.at(-1)
  const start = line.positions[0]
  if (final === undefined || start === undefined) return []
  let busiest: Square | null = null
  let most = 0
  for (const origin of ALL_SQUARES) {
    if (pieceAt(start, origin) === null) continue
    let count = 0
    let previous: Square | null = origin
    for (let i = 1; i <= line.history.length; i += 1) {
      const now = trackPiece(line.history.slice(0, i), origin)
      if (now !== previous) count += 1
      previous = now
    }
    if (count > most && previous !== null) {
      most = count
      busiest = previous
    }
  }
  const kings = ALL_SQUARES.filter((square) => pieceAt(final, square)?.type === 'k')
  const all = busiest === null ? kings : [busiest, ...kings]
  return all.filter((square, index) => all.indexOf(square) === index).slice(0, 3)
}
