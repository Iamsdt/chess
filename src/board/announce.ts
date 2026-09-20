import type { PieceType, Square } from '@/domain'

import type { PieceCode, Placement } from './placement'
import type { BoardMove } from './types'

/**
 * The words the board speaks.
 *
 * Why a module of pure string builders rather than JSX: the live region is the
 * only way a screen-reader user perceives the board at all, so the phrasing is
 * behaviour worth testing on its own, not incidental markup.
 */

const PIECE_NAMES: Record<PieceCode, string> = {
  wP: 'white pawn',
  wN: 'white knight',
  wB: 'white bishop',
  wR: 'white rook',
  wQ: 'white queen',
  wK: 'white king',
  bP: 'black pawn',
  bN: 'black knight',
  bB: 'black bishop',
  bR: 'black rook',
  bQ: 'black queen',
  bK: 'black king',
}

const TYPE_NAMES: Record<PieceType, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

/** `wN` → `white knight`. */
export const describePiece = (code: PieceCode): string => PIECE_NAMES[code]

/** `q` → `queen`, for the promotion picker's buttons. */
export const describePieceType = (type: PieceType): string => TYPE_NAMES[type]

/**
 * The accessible name of a square, which is also its cell label in the grid.
 *
 * The square comes first because a screen reader reads the cell on every cursor
 * step, and the coordinate is what the user is navigating by.
 */
export function describeSquare(square: Square, code: PieceCode | undefined): string {
  return code === undefined ? `${square}, empty` : `${square}, ${describePiece(code)}`
}

/**
 * Spoken when a piece is picked up, so the user knows where it can go.
 *
 * `null` means the count is unknowable — a premove, or a free-placement board —
 * and the sentence then says nothing rather than something false.
 */
export function describeSelection(
  square: Square,
  code: PieceCode,
  destinationCount: number | null,
): string {
  const selected = `Selected ${describePiece(code)} on ${square}.`
  if (destinationCount === null) return selected
  const moves = destinationCount === 1 ? '1 move' : `${String(destinationCount)} moves`
  return `${selected} ${moves} available.`
}

/**
 * Spoken after a move is accepted. Takes the placement *before* the move so the
 * captured piece can be named — after the move it is gone.
 */
export function describeMove(move: BoardMove, before: Placement): string {
  const mover = before.get(move.from)
  const captured = before.get(move.to)
  const subject = mover ? describePiece(mover) : 'piece'

  let sentence =
    captured === undefined
      ? `${subject} ${move.from} to ${move.to}.`
      : `${subject} ${move.from} takes ${describePiece(captured)} on ${move.to}.`

  if (move.promotion) sentence += ` Promotes to ${describePieceType(move.promotion)}.`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

/** Spoken when the caller's `legalMoves` does not contain the attempted move. */
export const describeRejection = (from: Square, to: Square): string =>
  `${from} to ${to} is not a legal move.`

/** Spoken when a premove is stored for the user's next turn. */
export function describePremove(move: BoardMove, before: Placement): string {
  const mover = before.get(move.from)
  const subject = mover ? describePiece(mover) : 'piece'
  return `Premove set: ${subject} ${move.from} to ${move.to}.`
}

/**
 * Spoken once per position the caller hands over, so the opponent's reply is not
 * silent. `check` comes from `shapes.check`, the only check knowledge the board
 * has — legality lives with the caller.
 */
export function describePosition(check: Square | null): string | null {
  return check === null ? null : `Check on ${check}.`
}
