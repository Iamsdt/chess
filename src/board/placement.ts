import { toSquare, type Color, type Fen, type PieceType, type Square } from '@/domain'

/**
 * Pure board geometry and FEN placement reading.
 *
 * Why it lives apart from the component: every interaction — dots, drags,
 * keyboard cursor movement, slide animation, screen-reader text — is a question
 * about squares and pieces, and none of it needs React to be answered or tested.
 */

/** File letters in board order. */
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export type FileLetter = (typeof FILES)[number]

/** Rank digits, low to high, so `RANKS[i]` is the rank at rank index `i`. */
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const
export type RankDigit = (typeof RANKS)[number]

type ColorLetter = 'w' | 'b'
type TypeLetter = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'

/**
 * A piece as `wN`/`bQ` — deliberately the same spelling as the SVG filenames in
 * `public/pieces/<set>/`, so a code never has to be translated to find its art.
 */
export type PieceCode = `${ColorLetter}${TypeLetter}`

/** A position's occupied squares. Empty squares are simply absent. */
export type Placement = ReadonlyMap<Square, PieceCode>

/**
 * Every square, minted once at module load.
 *
 * Why: `Square` is a zod-branded string, and re-validating 64 of them on every
 * render of every board (the library screen shows dozens at a time) is waste the
 * board would pay for on each keystroke.
 */
export const SQUARES: readonly Square[] = FILES.flatMap((file) =>
  RANKS.map((rank) => toSquare(`${file}${rank}`)),
)

/** The cursor's home square before the user has moved it. */
export const DEFAULT_SQUARE: Square = toSquare('a1')

/** File index of `a`…`h`, 0-based. */
export const fileIndexOf = (square: Square): number => square.charCodeAt(0) - 'a'.charCodeAt(0)

/** Rank index of `1`…`8`, 0-based, so index 0 is White's back rank. */
export const rankIndexOf = (square: Square): number => square.charCodeAt(1) - '1'.charCodeAt(0)

/** `null` off the board, so callers can step a cursor without range checks. */
export function squareAt(fileIndex: number, rankIndex: number): Square | null {
  if (fileIndex < 0 || fileIndex > 7 || rankIndex < 0 || rankIndex > 7) return null
  return SQUARES[fileIndex * RANKS.length + rankIndex] ?? null
}

/**
 * Light squares — the ones painted with `--vb-light`.
 *
 * Note the deliberate divergence from `prototype/assets/board.js`, which computes
 * `(fileIndex + rank) % 2 === 1` with a 1-based rank and so paints a1 light. A
 * board with a light bottom-left corner is wrong ("white on the right"), so this
 * uses two 0-based indices and gives a1 a dark square.
 */
export const isLightSquare = (square: Square): boolean =>
  (fileIndexOf(square) + rankIndexOf(square)) % 2 === 1

const PIECE_BY_FEN_CHAR: Record<string, PieceCode> = {
  P: 'wP',
  N: 'wN',
  B: 'wB',
  R: 'wR',
  Q: 'wQ',
  K: 'wK',
  p: 'bP',
  n: 'bN',
  b: 'bB',
  r: 'bR',
  q: 'bQ',
  k: 'bK',
}

const COLOR_LETTER: Record<Color, ColorLetter> = { white: 'w', black: 'b' }

const TYPE_LETTER: Record<PieceType, TypeLetter> = {
  p: 'P',
  n: 'N',
  b: 'B',
  r: 'R',
  q: 'Q',
  k: 'K',
}

/** Builds a code from the domain's colour and piece-type spellings. */
export const pieceCodeFor = (color: Color, type: PieceType): PieceCode =>
  `${COLOR_LETTER[color]}${TYPE_LETTER[type]}`

export const pieceColorOf = (code: PieceCode): Color => (code.startsWith('w') ? 'white' : 'black')

/**
 * Reads the placement field of a FEN.
 *
 * Safe without validation because `Fen` is branded: `FenSchema` has already
 * proved six fields and eight full ranks.
 */
export function parsePlacement(fen: Fen): Placement {
  const placement = fen.split(' ')[0] ?? ''
  const pieces = new Map<Square, PieceCode>()

  placement.split('/').forEach((row, rowIndex) => {
    const rankIndex = 7 - rowIndex
    let fileIndex = 0
    for (const char of row) {
      const code = PIECE_BY_FEN_CHAR[char]
      if (code === undefined) {
        fileIndex += Number(char)
        continue
      }
      const square = squareAt(fileIndex, rankIndex)
      if (square) pieces.set(square, code)
      fileIndex += 1
    }
  })

  return pieces
}

/** Whose turn the position says it is. */
export const sideToMove = (fen: Fen): Color => (fen.split(' ')[1] === 'b' ? 'black' : 'white')

/** One piece's journey between two positions, for the slide animation. */
export interface PieceSlide {
  code: PieceCode
  from: Square
  to: Square
}

const distanceBetween = (a: Square, b: Square): number =>
  (fileIndexOf(a) - fileIndexOf(b)) ** 2 + (rankIndexOf(a) - rankIndexOf(b)) ** 2

/**
 * Pairs pieces that left a square with identical pieces that arrived on one.
 *
 * Why nearest-first rather than anything cleverer: the board is handed positions,
 * not moves, so identity has to be guessed. Nearest-match gets ordinary moves,
 * castling (two pairs) and en passant right; a promotion has no matching piece to
 * pair with and correctly animates as an appearance rather than a slide.
 */
export function diffPlacements(before: Placement, after: Placement): PieceSlide[] {
  const departures: { square: Square; code: PieceCode }[] = []
  const arrivals: { square: Square; code: PieceCode }[] = []

  for (const [square, code] of before) {
    if (after.get(square) !== code) departures.push({ square, code })
  }
  for (const [square, code] of after) {
    if (before.get(square) !== code) arrivals.push({ square, code })
  }

  const slides: PieceSlide[] = []
  for (const arrival of arrivals) {
    let bestIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY
    for (const [index, departure] of departures.entries()) {
      if (departure.code !== arrival.code) continue
      const distance = distanceBetween(departure.square, arrival.square)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    }
    if (bestIndex < 0) continue
    const [departure] = departures.splice(bestIndex, 1)
    if (departure) slides.push({ code: arrival.code, from: departure.square, to: arrival.square })
  }

  return slides
}

/** Column from the viewer's left, 0–7, honouring the flip. */
export const screenColumn = (square: Square, orientation: Color): number =>
  orientation === 'white' ? fileIndexOf(square) : 7 - fileIndexOf(square)

/** Row from the viewer's top, 0–7, honouring the flip. */
export const screenRow = (square: Square, orientation: Color): number =>
  orientation === 'white' ? 7 - rankIndexOf(square) : rankIndexOf(square)

/**
 * The square at a screen column/row, or `null` off the board.
 *
 * Why everything goes through this: the flip is the board's one pervasive source
 * of off-by-one bugs, and this is the only place that undoes it.
 */
export function squareFromScreen(column: number, row: number, orientation: Color): Square | null {
  if (column < 0 || column > 7 || row < 0 || row > 7) return null
  const fileIndex = orientation === 'white' ? column : 7 - column
  const rankIndex = orientation === 'white' ? 7 - row : row
  return squareAt(fileIndex, rankIndex)
}

/**
 * The 64 squares in paint order, top-left first.
 *
 * Why the board iterates this rather than `SQUARES`: the DOM order *is* the
 * reading order for a screen reader and the tab order for the grid, so it has to
 * match what the eye sees, flip included.
 */
export function orderedSquares(orientation: Color): Square[] {
  const squares: Square[] = []
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const square = squareFromScreen(column, row, orientation)
      if (square) squares.push(square)
    }
  }
  return squares
}

/**
 * Steps a square by whole squares in screen space, so the arrow keys move the
 * cursor the way the board looks rather than the way the files run.
 */
export function stepSquare(
  square: Square,
  orientation: Color,
  columnDelta: number,
  rowDelta: number,
): Square | null {
  return squareFromScreen(
    screenColumn(square, orientation) + columnDelta,
    screenRow(square, orientation) + rowDelta,
    orientation,
  )
}

const SQUARE_BY_NAME = new Map<string, Square>(SQUARES.map((square) => [String(square), square]))

/**
 * Looks up a square the DOM handed back, without re-running the zod brand.
 *
 * Why not `toSquare`: this runs on every pointer move during a drag, and the
 * value always came out of markup this module wrote.
 */
export const findSquare = (value: string | null | undefined): Square | null =>
  value === null || value === undefined ? null : (SQUARE_BY_NAME.get(value) ?? null)
