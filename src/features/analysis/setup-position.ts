import { createGame, formatFen, isCheck, parseFen, validateFen } from '@/chess'
import {
  domainError,
  err,
  ok,
  START_FEN,
  toSquare,
  type Color,
  type Fen,
  type Result,
  type Square,
} from '@/domain'

/**
 * S19 · the position-setup dialog, as pure data.
 *
 * The dialog is a piece palette plus four castling checkboxes plus a side-to-move
 * switch, and every one of those can produce a position that cannot exist. Keeping
 * the whole thing as a value, with one function that turns it into a FEN or into a
 * reason it is not one, is what lets the dialog validate on every keystroke without
 * a React re-render doing the thinking.
 *
 * Legality itself is not decided here: `@/chess`'s `validateFen` owns that, because
 * it is the same check a pasted FEN goes through.
 */

export const SETUP_PIECES = [
  'wK',
  'wQ',
  'wR',
  'wB',
  'wN',
  'wP',
  'bK',
  'bQ',
  'bR',
  'bB',
  'bN',
  'bP',
] as const
export type SetupPiece = (typeof SETUP_PIECES)[number]

export const BOARD_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
/** Rank 8 first, so a row-major walk of this is the order a FEN spells the board. */
export const BOARD_RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const

/** All 64 squares in FEN order, minted once — `Square` is branded and validation is not free. */
export const SETUP_SQUARES: readonly Square[] = BOARD_RANKS.flatMap((rank) =>
  BOARD_FILES.map((file) => toSquare(`${file}${rank}`)),
)

export interface CastlingRights {
  readonly whiteKing: boolean
  readonly whiteQueen: boolean
  readonly blackKing: boolean
  readonly blackQueen: boolean
}

export const NO_CASTLING: CastlingRights = {
  whiteKing: false,
  whiteQueen: false,
  blackKing: false,
  blackQueen: false,
}

export interface SetupState {
  readonly placement: ReadonlyMap<Square, SetupPiece>
  readonly sideToMove: Color
  readonly castling: CastlingRights
  readonly enPassant: Square | null
  readonly halfmoveClock: number
  readonly fullmoveNumber: number
}

const PIECE_BY_FEN_CHAR: Readonly<Record<string, SetupPiece>> = {
  K: 'wK',
  Q: 'wQ',
  R: 'wR',
  B: 'wB',
  N: 'wN',
  P: 'wP',
  k: 'bK',
  q: 'bQ',
  r: 'bR',
  b: 'bB',
  n: 'bN',
  p: 'bP',
}

const FEN_CHAR_BY_PIECE: Readonly<Record<SetupPiece, string>> = {
  wK: 'K',
  wQ: 'Q',
  wR: 'R',
  wB: 'B',
  wN: 'N',
  wP: 'P',
  bK: 'k',
  bQ: 'q',
  bR: 'r',
  bB: 'b',
  bN: 'n',
  bP: 'p',
}

const CASTLING_FLAGS = [
  ['whiteKing', 'K'],
  ['whiteQueen', 'Q'],
  ['blackKing', 'k'],
  ['blackQueen', 'q'],
] as const

export function castlingField(rights: CastlingRights): string {
  const flags = CASTLING_FLAGS.filter(([key]) => rights[key])
    .map(([, flag]) => flag)
    .join('')
  return flags === '' ? '-' : flags
}

export function castlingFromField(field: string): CastlingRights {
  return {
    whiteKing: field.includes('K'),
    whiteQueen: field.includes('Q'),
    blackKing: field.includes('k'),
    blackQueen: field.includes('q'),
  }
}

/** Split a FEN's placement field into a square → piece map. */
function placementFromField(field: string): ReadonlyMap<Square, SetupPiece> {
  const placement = new Map<Square, SetupPiece>()
  const ranks = field.split('/')
  for (const [rankIndex, rankText] of ranks.entries()) {
    const rank = BOARD_RANKS[rankIndex]
    if (rank === undefined) continue
    let fileIndex = 0
    for (const char of rankText) {
      const skip = Number(char)
      if (!Number.isNaN(skip)) {
        fileIndex += skip
        continue
      }
      const piece = PIECE_BY_FEN_CHAR[char]
      const file = BOARD_FILES[fileIndex]
      if (piece !== undefined && file !== undefined) {
        placement.set(toSquare(`${file}${rank}`), piece)
      }
      fileIndex += 1
    }
  }
  return placement
}

function placementField(placement: ReadonlyMap<Square, SetupPiece>): string {
  return BOARD_RANKS.map((rank) => {
    let text = ''
    let empty = 0
    for (const file of BOARD_FILES) {
      const piece = placement.get(toSquare(`${file}${rank}`))
      if (piece === undefined) {
        empty += 1
        continue
      }
      if (empty > 0) {
        text += String(empty)
        empty = 0
      }
      text += FEN_CHAR_BY_PIECE[piece]
    }
    return empty > 0 ? `${text}${String(empty)}` : text
  }).join('/')
}

/** Read a FEN into the dialog's state. Rejects anything `parseFen` would reject. */
export function setupFromFen(fen: string): Result<SetupState> {
  const validated = validateFen(fen)
  if (!validated.ok) return validated
  const fields = validated.value.split(' ')
  const [placement = '', side = 'w', castling = '-', enPassant = '-', half = '0', full = '1'] =
    fields
  return ok({
    placement: placementFromField(placement),
    sideToMove: side === 'b' ? 'black' : 'white',
    castling: castlingFromField(castling),
    enPassant: enPassant === '-' ? null : toSquare(enPassant),
    halfmoveClock: Number(half),
    fullmoveNumber: Number(full),
  })
}

/** The state the dialog opens with when the player asks for a blank board. */
export const EMPTY_SETUP: SetupState = {
  placement: new Map(),
  sideToMove: 'white',
  castling: NO_CASTLING,
  enPassant: null,
  halfmoveClock: 0,
  fullmoveNumber: 1,
}

function countPieces(placement: ReadonlyMap<Square, SetupPiece>, piece: SetupPiece): number {
  let count = 0
  for (const value of placement.values()) if (value === piece) count += 1
  return count
}

/**
 * The problems a player can fix, in their words.
 *
 * Why not leave all of it to `validateFen`: chess.js reports "Invalid FEN: piece
 * data is invalid", which tells someone who has just dragged two white kings onto
 * the board nothing at all.
 */
export function setupProblems(state: SetupState): readonly string[] {
  const problems: string[] = []
  const whiteKings = countPieces(state.placement, 'wK')
  const blackKings = countPieces(state.placement, 'bK')
  if (whiteKings === 0) problems.push('White needs a king.')
  if (blackKings === 0) problems.push('Black needs a king.')
  if (whiteKings > 1) problems.push('White has more than one king.')
  if (blackKings > 1) problems.push('Black has more than one king.')

  const backRankPawn = [...state.placement].some(
    ([square, piece]) =>
      (piece === 'wP' || piece === 'bP') && (square.endsWith('1') || square.endsWith('8')),
  )
  if (backRankPawn) problems.push('A pawn cannot stand on the first or the last rank.')

  for (const [key, description] of [
    ['whiteKing', 'White cannot castle short without the king on e1 and a rook on h1.'],
    ['whiteQueen', 'White cannot castle long without the king on e1 and a rook on a1.'],
    ['blackKing', 'Black cannot castle short without the king on e8 and a rook on h8.'],
    ['blackQueen', 'Black cannot castle long without the king on e8 and a rook on a8.'],
  ] as const) {
    if (state.castling[key] && !availableCastling(state.placement)[key]) problems.push(description)
  }

  return problems
}

/** Which castling rights the pieces on the board could actually support. */
export function availableCastling(placement: ReadonlyMap<Square, SetupPiece>): CastlingRights {
  const at = (square: string): SetupPiece | undefined => placement.get(toSquare(square))
  const whiteKingHome = at('e1') === 'wK'
  const blackKingHome = at('e8') === 'bK'
  return {
    whiteKing: whiteKingHome && at('h1') === 'wR',
    whiteQueen: whiteKingHome && at('a1') === 'wR',
    blackKing: blackKingHome && at('h8') === 'bR',
    blackQueen: blackKingHome && at('a8') === 'bR',
  }
}

/**
 * The en-passant squares this position could legitimately offer.
 *
 * Offering a list rather than a free text field is the cheapest way to make the
 * "no pawn could have just moved past e6" error unreachable from the dialog.
 */
export function enPassantChoices(state: SetupState): readonly Square[] {
  const white = state.sideToMove === 'white'
  const targetRank = white ? '6' : '3'
  const pawnRank = white ? '5' : '4'
  const originRank = white ? '7' : '2'
  const pawn: SetupPiece = white ? 'bP' : 'wP'
  return BOARD_FILES.filter(
    (file) =>
      state.placement.get(toSquare(`${file}${pawnRank}`)) === pawn &&
      state.placement.get(toSquare(`${file}${targetRank}`)) === undefined &&
      state.placement.get(toSquare(`${file}${originRank}`)) === undefined,
  ).map((file) => toSquare(`${file}${targetRank}`))
}

/** Put a piece on a square, or clear it with `null`. */
export function placePiece(
  state: SetupState,
  square: Square,
  piece: SetupPiece | null,
): SetupState {
  const placement = new Map(state.placement)
  if (piece === null) placement.delete(square)
  else placement.set(square, piece)
  return { ...state, placement, enPassant: null }
}

/** Empty the board, keeping the counters and the side to move. */
export function clearPieces(state: SetupState): SetupState {
  return { ...state, placement: new Map(), castling: NO_CASTLING, enPassant: null }
}

/** The state the "Start position" button restores. */
export function startSetup(): SetupState {
  const start = setupFromFen(START_FEN)
  return start.ok ? start.value : EMPTY_SETUP
}

/**
 * Turn the dialog's state into a FEN, or say why it is not one yet.
 *
 * The friendly problems are reported first; anything left is whatever `@/chess`
 * refuses, which covers the cases a palette can still reach (a side to move whose
 * opponent is already in check, for instance).
 */
export function setupToFen(state: SetupState): Result<Fen> {
  const problems = setupProblems(state)
  if (problems.length > 0) {
    return err(
      domainError('validation', problems[0] ?? 'This is not a legal position', {
        where: 'position setup',
        details: problems,
      }),
    )
  }
  const fen = formatFen({
    placement: placementField(state.placement),
    sideToMove: state.sideToMove,
    castling: castlingField(state.castling),
    enPassant: state.enPassant,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
  })
  if (!fen.ok) return fen
  if (sideNotToMoveIsInCheck(fen.value)) {
    const exposed = state.sideToMove === 'white' ? 'Black' : 'White'
    return err(
      domainError('validation', `${exposed} is in check but it is not ${exposed}'s move.`, {
        where: 'position setup',
      }),
    )
  }
  return ok(fen.value)
}

/**
 * Whether the player who is *not* to move is standing in check.
 *
 * No legal game can reach that, and `validateFen` does not catch it, so the
 * dialog would otherwise hand the board a position whose "legal moves" include
 * capturing a king. Asked by flipping the side to move and letting `@/chess`
 * answer, because this feature does not get to own a rule.
 */
function sideNotToMoveIsInCheck(fen: Fen): boolean {
  const fields = parseFen(fen)
  if (!fields.ok) return false
  const flipped = formatFen({
    ...fields.value,
    sideToMove: fields.value.sideToMove === 'white' ? 'black' : 'white',
    // The en-passant square belongs to the other side's last move and cannot survive the flip.
    enPassant: null,
  })
  if (!flipped.ok) return false
  const game = createGame(flipped.value)
  return game.ok && isCheck(game.value)
}
