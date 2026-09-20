import { type Chess, type Square as ChessSquare } from 'chess.js'

import {
  domainError,
  err,
  ok,
  PIECE_TYPES,
  type Color,
  type Fen,
  type PieceType,
  type Result,
  type Square,
} from '@/domain'

import { asChessSquare, fromChessColor, fromChessPiece, newChess, toChessColor } from './chessjs'
import { parseUci } from './moves'

/**
 * Counting material, and deciding whether a move gives some away.
 *
 * The values are the classical 1/3/3/5/9, which is what every beginner is taught and what
 * the captured-pieces strip on the board screen adds up. They are deliberately *not* the
 * engine's tuned values: the number beside the board is a teaching aid, and disagreeing
 * with the coach's own arithmetic by a third of a pawn would be a bug to a learner.
 */

/** Pawn units. The king is zero because it is never traded, only mated. */
export const PIECE_VALUES: Readonly<Record<PieceType, number>> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

/** Why a second scale: the engine, and therefore the exchange evaluator, speaks centipawns. */
const CENTIPAWN_VALUES: Readonly<Record<PieceType, number>> = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  /** Not a tradable value — high enough that an exchange never "wins" a king. */
  k: 100_000,
}

export type PieceCounts = Readonly<Record<PieceType, number>>

export interface MaterialCount {
  readonly white: PieceCounts
  readonly black: PieceCounts
  /** Pawn units, kings excluded. */
  readonly whitePoints: number
  readonly blackPoints: number
}

export interface MaterialBalance {
  /** White's count minus Black's, per piece type — the imbalance the review prints. */
  readonly byPiece: PieceCounts
  /** White's points minus Black's, in pawn units; negative means Black is ahead. */
  readonly points: number
  /** `null` when material is level, which is not the same as "nobody is winning". */
  readonly leader: Color | null
  /** How far ahead the leader is, always non-negative. */
  readonly advantage: number
}

function emptyCounts(): Record<PieceType, number> {
  return { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
}

/** Count every piece on the board, by colour and type. */
export function countMaterial(fen: Fen): MaterialCount {
  const white = emptyCounts()
  const black = emptyCounts()
  for (const row of newChess(fen).board()) {
    for (const cell of row) {
      if (cell === null) continue
      const counts = cell.color === 'w' ? white : black
      counts[fromChessPiece(cell.type)] += 1
    }
  }
  const points = (counts: PieceCounts): number =>
    PIECE_TYPES.reduce((total, piece) => total + counts[piece] * PIECE_VALUES[piece], 0)
  return { white, black, whitePoints: points(white), blackPoints: points(black) }
}

/**
 * The imbalance, which is what a player actually reads: not "White has two rooks" but
 * "White is a knight for three pawns up".
 */
export function materialBalance(fen: Fen): MaterialBalance {
  const count = countMaterial(fen)
  const byPiece = emptyCounts()
  for (const piece of PIECE_TYPES) byPiece[piece] = count.white[piece] - count.black[piece]
  const points = count.whitePoints - count.blackPoints
  return {
    byPiece,
    points,
    leader: points === 0 ? null : points > 0 ? 'white' : 'black',
    advantage: Math.abs(points),
  }
}

/**
 * Which pieces each side has captured, for the strip beside the board.
 *
 * Derived from what is missing relative to a full army rather than from the move list, so
 * it is correct for a game loaded from a FEN halfway through.
 */
export function capturedPieces(fen: Fen): {
  readonly white: PieceType[]
  readonly black: PieceType[]
} {
  const start: Readonly<Record<PieceType, number>> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }
  const count = countMaterial(fen)
  const missing = (counts: PieceCounts): PieceType[] =>
    PIECE_TYPES.flatMap((piece) =>
      Array.from({ length: Math.max(0, start[piece] - counts[piece]) }, () => piece),
    )
  // A piece missing from Black's army is one White captured, and the other way round.
  return { white: missing(count.black), black: missing(count.white) }
}

function pieceValueAt(chess: Chess, square: ChessSquare): number {
  const piece = chess.get(square)
  return piece === undefined ? 0 : CENTIPAWN_VALUES[fromChessPiece(piece.type)]
}

/** The cheapest piece of `color` that attacks `square`, which is the one SEE must use next. */
function leastValuableAttacker(
  chess: Chess,
  square: ChessSquare,
  color: Color,
): { square: ChessSquare; value: number; type: PieceType } | null {
  let best: { square: ChessSquare; value: number; type: PieceType } | null = null
  for (const from of chess.attackers(square, toChessColor(color))) {
    const piece = chess.get(from)
    if (piece === undefined) continue
    const type = fromChessPiece(piece.type)
    const value = CENTIPAWN_VALUES[type]
    if (best === null || value < best.value) best = { square: from, value, type }
  }
  return best
}

/**
 * Static exchange evaluation: what the whole capture sequence on one square is worth, in
 * centipawns, to the side that starts it.
 *
 * Why this exists in a learning app: it is the difference between "you hung a rook" and
 * "you sacrificed a rook". A move that loses material by exchange but keeps the engine's
 * evaluation is the definition of a sacrifice, and that is what `classifyMove` needs in
 * order to call anything brilliant.
 *
 * "Static" is the honest word: it counts the pieces that attack the square and nothing
 * else. It does not know about pins, discovered attacks or the fact that recapturing loses
 * to mate. That is the accepted trade — the engine's evaluation supplies the judgement,
 * and this supplies only the material arithmetic.
 */
export function staticExchangeEvaluation(fen: Fen, uci: string): Result<number> {
  const parts = parseUci(uci)
  if (!parts.ok) return parts
  const from = asChessSquare(parts.value.from)
  const to = asChessSquare(parts.value.to)
  if (from === undefined || to === undefined) {
    return err(domainError('validation', 'Not a board square', { where: 'exchange evaluation' }))
  }

  const chess = newChess(fen)
  const moving = chess.get(from)
  if (moving === undefined) {
    return err(
      domainError('validation', `There is no piece on ${parts.value.from}`, {
        where: 'exchange evaluation',
      }),
    )
  }
  const mover = fromChessColor(moving.color)
  const movingType = fromChessPiece(moving.type)

  // En passant takes a pawn that is not standing on the destination square.
  const isEnPassant =
    movingType === 'p' && chess.get(to) === undefined && from.codePointAt(0) !== to.codePointAt(0)
  const enPassantVictim = isEnPassant ? asChessSquare(`${to[0] ?? ''}${from[1] ?? ''}`) : undefined

  let captured = pieceValueAt(chess, to)
  if (isEnPassant) captured = CENTIPAWN_VALUES.p

  // A promoting pawn is worth what it becomes from the moment it lands.
  const promotedTo = parts.value.promotion
  const standingType = promotedTo ?? movingType
  const promotionGain =
    promotedTo === undefined ? 0 : CENTIPAWN_VALUES[promotedTo] - CENTIPAWN_VALUES.p

  chess.remove(from)
  chess.remove(to)
  if (enPassantVictim !== undefined) chess.remove(enPassantVictim)
  chess.put({ type: standingType, color: moving.color }, to)

  const gains: number[] = [captured + promotionGain]
  let standing = CENTIPAWN_VALUES[standingType]
  let side: Color = mover === 'white' ? 'black' : 'white'
  let depth = 0

  for (;;) {
    const attacker = leastValuableAttacker(chess, to, side)
    if (attacker === null) break
    // A king may only capture when nothing is left to recapture with.
    if (
      attacker.type === 'k' &&
      leastValuableAttacker(chess, to, side === 'white' ? 'black' : 'white') !== null
    ) {
      break
    }
    depth += 1
    gains[depth] = standing - (gains[depth - 1] ?? 0)
    standing = attacker.value
    chess.remove(attacker.square)
    chess.remove(to)
    chess.put({ type: attacker.type, color: toChessColor(side) }, to)
    side = side === 'white' ? 'black' : 'white'
    // Neither side plays on once the exchange can only lose them material.
    if (Math.max(-(gains[depth - 1] ?? 0), gains[depth] ?? 0) < 0) break
  }

  // Walk back up: at each point the side to move may simply decline to recapture.
  for (let i = depth; i > 0; i -= 1) {
    gains[i - 1] = -Math.max(-(gains[i - 1] ?? 0), gains[i] ?? 0)
  }
  return ok(gains[0] ?? 0)
}

/** Which piece stands on a square, in this app's vocabulary. `null` for an empty square. */
export function pieceAt(fen: Fen, square: Square): { color: Color; type: PieceType } | null {
  const target = asChessSquare(square)
  if (target === undefined) return null
  const piece = newChess(fen).get(target)
  return piece === undefined
    ? null
    : { color: fromChessColor(piece.color), type: fromChessPiece(piece.type) }
}
