import { createGame, pieceAt, playMoves, type PlayedMove } from '@/chess'
import type { Fen, Square } from '@/domain'
import { trackPiece } from '@/features/drills/blindfold'

import { pieceName } from './narrate'

/** Where a user's picture of a followed piece first left the real one. */
export interface Slip {
  /** 0-based index into the line of the move the picture missed. */
  readonly ply: number
  readonly san: string
  readonly from: Square
  readonly to: Square
  /** "4." or "4..." so the user can find it in the notation. */
  readonly label: string
  /** The position after the missed move: what Peek shows. */
  readonly fenAfter: Fen
  /** One calm line: what happened and where the user's picture stayed. */
  readonly explanation: string
}

export interface SlipInput {
  readonly fen: Fen
  readonly moves: readonly string[]
  /** The square the tracked piece starts on. */
  readonly start: Square
  /** What the user said, or `null` when they gave no square. */
  readonly answer: Square | null
}

const distance = (a: Square, b: Square): number =>
  Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(a.charCodeAt(1) - b.charCodeAt(1)))

export const moveLabel = (move: PlayedMove): string =>
  move.color === 'white' ? `${String(move.moveNumber)}.` : `${String(move.moveNumber)}...`

/**
 * The first move of the tracked piece that the user's answer does not account for.
 *
 * Why this rule: a wrong answer is almost always a square the piece really stood on
 * earlier (the picture stopped updating), so the slip is the next move that piece made.
 * An answer the piece never visited falls back to the move that ended nearest to it.
 * Returns `null` for a correct answer or a line that cannot be replayed.
 */
export function findSlip(input: SlipInput): Slip | null {
  const start = createGame(input.fen)
  if (!start.ok) return null
  const played = playMoves(start.value, input.moves)
  if (!played.ok) return null
  const history = played.value.history

  // trail[i] is where the piece stands after i plies.
  const trail: (Square | null)[] = [input.start]
  for (let i = 1; i <= history.length; i += 1)
    trail.push(trackPiece(history.slice(0, i), input.start))
  const real = trail.at(-1) ?? null
  if (real === null || input.answer === real) return null

  const movers = history.filter((_move, index) => {
    const before = trail[index]
    const after = trail[index + 1]
    return before !== after
  })
  if (movers.length === 0) return null

  let slipMove: PlayedMove | undefined
  if (input.answer !== null) {
    const stoodIndex = trail.findIndex((square) => square === input.answer)
    if (stoodIndex >= 0) slipMove = movers.find((move) => move.ply >= stoodIndex)
  }
  if (slipMove === undefined) {
    const answer = input.answer
    slipMove =
      answer === null
        ? movers[0]
        : [...movers].sort((a, b) => distance(a.to, answer) - distance(b.to, answer))[0]
  }
  if (slipMove === undefined) return null

  // The piece's own squares, not the move's: a castling rook moves inside the king's move.
  const from = trail[slipMove.ply] ?? slipMove.from
  const to = trail[slipMove.ply + 1] ?? slipMove.to
  const name = pieceName(pieceAt(input.fen, input.start)?.type ?? slipMove.piece)
  const label = moveLabel(slipMove)
  const left =
    input.answer === null
      ? ''
      : trail.includes(input.answer)
        ? `; you left it on ${input.answer}`
        : `; your picture had it on ${input.answer}`
  return {
    ply: slipMove.ply,
    san: slipMove.san,
    from,
    to,
    label,
    fenAfter: slipMove.fenAfter,
    explanation: `The ${name} went from ${from} to ${to} on move ${label.replace(/\.+$/, '')}${left}.`,
  }
}
