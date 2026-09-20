import { validateFen as validateChessFen } from 'chess.js'

import {
  domainError,
  err,
  FenSchema,
  isStructurallyValidFen,
  ok,
  SquareSchema,
  type Color,
  type Fen,
  type Result,
  type Square,
} from '@/domain'

import { asChessSquare, fromChessColor, newChess } from './chessjs'

/**
 * FEN validation, normalisation and field access.
 *
 * Why a layer on top of `FenSchema`: the domain's schema is deliberately structural — six
 * fields, eight ranks, one king a side — because it must not depend on a rules engine.
 * "Is this position actually reachable and playable?" needs one, and that is here.
 *
 * Everything in this module returns a `Result`. A FEN arrives from a pasted string, a
 * puzzle CSV, a share link or an analysis-board dialog, and every one of those is a place
 * where a bad value is a user's typo rather than a programmer's bug.
 */

/** A FEN taken apart, with each field already in this app's vocabulary. */
export interface FenFields {
  /** Ranks 8 → 1, slash separated, exactly as the FEN spells them. */
  readonly placement: string
  readonly sideToMove: Color
  /** `KQkq` in that canonical order, or `-`. */
  readonly castling: string
  /** The square a pawn may be captured on, or `null`. */
  readonly enPassant: Square | null
  /** Half-moves since the last capture or pawn move; the 50-move rule counts this. */
  readonly halfmoveClock: number
  /** 1-based full-move number, as the move list prints it. */
  readonly fullmoveNumber: number
}

/** The order the standard prints castling rights in; any other order is the same rights. */
const CASTLING_ORDER = ['K', 'Q', 'k', 'q'] as const

/**
 * Put castling rights into canonical order, or reject them.
 *
 * `null` means the field was not castling rights at all. Why bother: `KQkq` and `qkQK`
 * are the same position, and a FEN pasted from a program that spells it the second way
 * must normalise rather than fail.
 */
function canonicalCastling(value: string): string | null {
  if (value === '-') return '-'
  if (/[^KQkq]/.test(value)) return null
  const present = CASTLING_ORDER.filter((right) => value.includes(right)).join('')
  // A shorter canonical form than the input means a right was repeated.
  if (present.length !== value.length) return null
  return present === '' ? '-' : present
}

/**
 * Split a FEN into its fields.
 *
 * Tolerant about whitespace — a FEN pasted out of a PDF arrives with runs of spaces — and
 * strict about everything else.
 */
export function parseFen(value: string): Result<FenFields> {
  const parts = value.trim().split(/\s+/)
  if (parts.length !== 6) {
    return err(
      domainError('validation', `A FEN has six fields, this one has ${String(parts.length)}`, {
        where: 'FEN',
      }),
    )
  }

  const [placement = '', side = '', castling = '', enPassant = '', halfmove = '', fullmove = ''] =
    parts
  const rights = canonicalCastling(castling)
  if (rights === null) {
    return err(
      domainError('validation', `"${castling}" is not a castling-rights field`, { where: 'FEN' }),
    )
  }
  // Checked against the canonical spelling, because the structural schema insists on it.
  if (!isStructurallyValidFen([placement, side, rights, enPassant, halfmove, fullmove].join(' '))) {
    return err(domainError('validation', 'Not a well-formed six-field FEN', { where: 'FEN' }))
  }
  const enPassantSquare = enPassant === '-' ? null : SquareSchema.safeParse(enPassant)
  if (enPassantSquare !== null && !enPassantSquare.success) {
    return err(
      domainError('validation', `"${enPassant}" is not an en-passant square`, { where: 'FEN' }),
    )
  }

  return ok({
    placement,
    sideToMove: side === 'w' ? 'white' : 'black',
    castling: rights,
    enPassant: enPassantSquare === null ? null : enPassantSquare.data,
    halfmoveClock: Number(halfmove),
    fullmoveNumber: Number(fullmove),
  })
}

/** Why: the analysis board's position-setup dialog builds a FEN field by field. */
export function formatFen(fields: FenFields): Result<Fen> {
  const rights = canonicalCastling(fields.castling)
  if (rights === null) {
    return err(
      domainError('validation', `"${fields.castling}" is not a castling-rights field`, {
        where: 'FEN',
      }),
    )
  }
  const text = [
    fields.placement,
    fields.sideToMove === 'white' ? 'w' : 'b',
    rights,
    fields.enPassant ?? '-',
    String(fields.halfmoveClock),
    String(fields.fullmoveNumber),
  ].join(' ')
  return validateFen(text)
}

/**
 * Could a pawn actually have just played the double step this en-passant square implies?
 *
 * Why this is checked here and not left to chess.js: chess.js accepts the square on its
 * shape alone, and then happily generates an en-passant capture that takes a pawn which is
 * not there. Puzzle FENs and hand-edited positions get this wrong often enough that it is
 * worth a dozen lines — an impossible position produces impossible moves, and those end up
 * as a puzzle the player cannot solve.
 */
function hasPlausibleEnPassant(fen: string, square: string, whiteToMove: boolean): boolean {
  const file = square[0] ?? ''
  const rank = square[1] ?? ''
  // Only White can capture onto the sixth rank, and only Black onto the third.
  if (whiteToMove !== (rank === '6')) return false
  const chess = newChess(fen)
  const pawnSquare = asChessSquare(`${file}${whiteToMove ? '5' : '4'}`)
  const originSquare = asChessSquare(`${file}${whiteToMove ? '7' : '2'}`)
  const target = asChessSquare(square)
  if (pawnSquare === undefined || originSquare === undefined || target === undefined) return false
  const pawn = chess.get(pawnSquare)
  if (pawn?.type !== 'p') return false
  if (pawn.color !== (whiteToMove ? 'b' : 'w')) return false
  // The square it passed over and the one it came from must both be empty.
  return chess.get(target) === undefined && chess.get(originSquare) === undefined
}

/**
 * Validate a FEN all the way down: well-formed, then legal as a position.
 *
 * chess.js's check catches what the domain schema cannot — pawns on the first or last
 * rank, castling rights without a rook, a side to move whose opponent is already in check
 * — and `hasPlausibleEnPassant` catches the one it misses.
 */
export function validateFen(value: string): Result<Fen> {
  const normalized = value.trim().replace(/\s+/g, ' ')
  const parsed = FenSchema.safeParse(normalized)
  if (!parsed.success) {
    return err(domainError('validation', 'Not a well-formed six-field FEN', { where: 'FEN' }))
  }
  const legality = validateChessFen(normalized)
  if (!legality.ok) {
    return err(
      domainError('validation', legality.error ?? 'Not a legal position', { where: 'FEN' }),
    )
  }
  const fields = normalized.split(' ')
  const enPassant = fields[3] ?? '-'
  if (enPassant !== '-' && !hasPlausibleEnPassant(normalized, enPassant, fields[1] === 'w')) {
    return err(
      domainError('validation', `No pawn could have just moved past ${enPassant}`, {
        where: 'FEN',
      }),
    )
  }
  return ok(parsed.data)
}

/**
 * Put a FEN into the app's canonical spelling: single spaces, castling in `KQkq` order.
 *
 * Why it matters: FENs are compared as strings in caches, in the repetition counter and in
 * the engine's transposition keys, and `"… w kQ - 0 1"` and `"… w Qk - 0 1"` are the same
 * position. Normalising once, here, is cheaper than remembering to everywhere else.
 */
export function normalizeFen(value: string): Result<Fen> {
  const parsed = parseFen(value)
  if (!parsed.ok) return parsed
  return formatFen(parsed.value)
}

/** Why: reading the side to move is the single most common thing anyone does with a FEN. */
export function sideToMoveOf(fen: Fen): Color {
  return fromChessColor(fen.split(' ')[1] === 'b' ? 'b' : 'w')
}

/** Why: the review's "moves since a pawn moved" and the 50-move rule both read this. */
export function halfmoveClockOf(fen: Fen): number {
  return Number(fen.split(' ')[4] ?? '0')
}

/** Why: the move list numbers rows from this, including for games set up mid-game. */
export function fullmoveNumberOf(fen: Fen): number {
  return Number(fen.split(' ')[5] ?? '1')
}

/**
 * Replace a FEN's two counters.
 *
 * Why: a position lifted out of a puzzle or a lesson carries counters from the game it
 * came from, and a drill that starts there should not inherit someone else's 50-move
 * clock or move number.
 */
export function withCounters(
  fen: Fen,
  counters: { readonly halfmoveClock?: number; readonly fullmoveNumber?: number },
): Result<Fen> {
  const parsed = parseFen(fen)
  if (!parsed.ok) return parsed
  return formatFen({
    ...parsed.value,
    halfmoveClock: counters.halfmoveClock ?? parsed.value.halfmoveClock,
    fullmoveNumber: counters.fullmoveNumber ?? parsed.value.fullmoveNumber,
  })
}
