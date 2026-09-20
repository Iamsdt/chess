import {
  Chess,
  SQUARES,
  type Color as ChessColor,
  type PieceSymbol,
  type Square as ChessSquare,
} from 'chess.js'

import {
  PROMOTION_PIECES,
  type Color,
  type PieceType,
  type PromotionPiece,
  type Square,
} from '@/domain'

/**
 * The one place chess.js's vocabulary is translated into this app's.
 *
 * Why it exists at all: S03 chose `Color = 'white' | 'black'` because that is what every
 * screen, every schema and every stored row says, while chess.js speaks `'w' | 'b'`.
 * Two vocabularies are fine; two vocabularies converted ad hoc at forty call sites are
 * not, because the day someone writes `color === 'w'` against a domain `Color` the
 * compiler is happy and the app is wrong. Every other module in `@/chess` imports its
 * conversions from here and never touches a chess.js literal directly.
 *
 * Nothing in here is exported from `@/chess` — chess.js is an implementation detail of
 * this layer, and leaking its types would make it one of the app's, too.
 */

const CHESS_COLOR: Readonly<Record<Color, ChessColor>> = { white: 'w', black: 'b' }

/** Why: `Record` lookup rather than a ternary, so adding a colour would not compile. */
export function toChessColor(color: Color): ChessColor {
  return CHESS_COLOR[color]
}

export function fromChessColor(color: ChessColor): Color {
  return color === 'w' ? 'white' : 'black'
}

/**
 * chess.js's `PieceSymbol` and the domain's `PieceType` are the same six letters, so
 * these two are identity functions — but named ones, so a future divergence has exactly
 * one place to be fixed and `grep` finds every crossing.
 */
export function toChessPiece(piece: PieceType): PieceSymbol {
  return piece
}

export function fromChessPiece(piece: PieceSymbol): PieceType {
  return piece
}

const PROMOTIONS: ReadonlySet<string> = new Set<string>(PROMOTION_PIECES)

/** Why a narrowing check and not a cast: a king or a pawn is a `PieceSymbol` too. */
export function asPromotionPiece(piece: PieceSymbol): PromotionPiece | undefined {
  return PROMOTIONS.has(piece) ? (piece as PromotionPiece) : undefined
}

const CHESS_SQUARES: ReadonlySet<string> = new Set<string>(SQUARES)

/**
 * Narrow an arbitrary string to chess.js's 64-literal `Square` union.
 *
 * Why not a bare cast: a branded domain `Square` is only checked against `[a-h][1-8]` by
 * a regular expression, which the compiler cannot connect to a union of 64 literals. The
 * membership test is the evidence that makes the assertion true rather than hopeful.
 */
export function asChessSquare(value: string): ChessSquare | undefined {
  return CHESS_SQUARES.has(value) ? (value as ChessSquare) : undefined
}

/** Every domain `Square` is a chess.js square by construction; this is the safe crossing. */
export function toChessSquare(square: Square): ChessSquare | undefined {
  return asChessSquare(square)
}

/**
 * Build a chess.js instance without its own FEN validation.
 *
 * Why skip it: callers here have already validated the FEN through `validateFen()`, and
 * chess.js re-runs a full structural parse on every construction — which shows up badly
 * when a property test replays ten thousand positions.
 */
export function newChess(fen: string): Chess {
  return new Chess(fen, { skipValidation: true })
}
