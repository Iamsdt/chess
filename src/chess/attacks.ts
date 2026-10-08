import { SQUARES } from 'chess.js'

import { toSquare, type Color, type Fen, type PieceType, type Square } from '@/domain'

import { asChessSquare, fromChessColor, fromChessPiece, newChess, toChessColor } from './chessjs'

/**
 * Who attacks what, for the Sage board's control map and the visualization questions.
 *
 * Why attacks and not legal moves: a pinned piece still guards the squares behind it as far
 * as a player's picture of the board is concerned, and "is this piece defended?" is asked
 * of the side that is not to move as often as of the side that is.
 */

export type SquareControl = 'white' | 'black' | 'contested'

/** Squares attacked by at least one piece of `color`. */
export function attackedSquares(fen: Fen, color: Color): Square[] {
  const chess = newChess(fen)
  const by = toChessColor(color)
  return SQUARES.filter((square) => chess.isAttacked(square, by)).map((square) => toSquare(square))
}

/** Every square either side attacks, and who holds it. Unattacked squares are left out. */
export function squareControl(fen: Fen): { square: Square; side: SquareControl }[] {
  const chess = newChess(fen)
  const result: { square: Square; side: SquareControl }[] = []
  for (const square of SQUARES) {
    const white = chess.attackers(square, 'w').length
    const black = chess.attackers(square, 'b').length
    if (white === 0 && black === 0) continue
    const side: SquareControl = white > black ? 'white' : black > white ? 'black' : 'contested'
    result.push({ square: toSquare(square), side })
  }
  return result
}

/** The squares holding pieces of `color` that attack `square`. */
export function attackersOf(fen: Fen, square: Square, color: Color): Square[] {
  const target = asChessSquare(square)
  if (target === undefined) return []
  return newChess(fen)
    .attackers(target, toChessColor(color))
    .map((from) => toSquare(from))
}

/** Pieces of `color` (kings aside) that the other side attacks and nobody of `color` guards. */
export function hangingPieces(
  fen: Fen,
  color: Color,
): { square: Square; type: PieceType; color: Color }[] {
  const chess = newChess(fen)
  const own = toChessColor(color)
  const enemy = own === 'w' ? 'b' : 'w'
  const result: { square: Square; type: PieceType; color: Color }[] = []
  for (const square of SQUARES) {
    const piece = chess.get(square)
    if (piece?.color !== own || piece.type === 'k') continue
    if (chess.attackers(square, enemy).length === 0) continue
    if (chess.attackers(square, own).length > 0) continue
    result.push({
      square: toSquare(square),
      type: fromChessPiece(piece.type),
      color: fromChessColor(piece.color),
    })
  }
  return result
}
