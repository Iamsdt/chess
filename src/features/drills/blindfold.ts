import { createGame, playMoves, type PlayedMove } from '@/chess'
import { START_FEN, toSquare, type Fen, type Square } from '@/domain'

/**
 * The blindfold drill: read a short line of moves, lose the board, then say where one
 * piece ended up. The answer comes from replaying the line, so a typo in a stored
 * answer is impossible — a bad line fails the tests instead.
 */

export interface BlindfoldLine {
  readonly id: string
  readonly fen: Fen
  readonly moves: readonly string[]
  /** The square the tracked piece starts on. */
  readonly track: Square
  /** Plain-language name of that piece, for the question. */
  readonly pieceName: string
}

export const BLINDFOLD_LINES: readonly BlindfoldLine[] = [
  {
    id: 'ruy-knight',
    fen: START_FEN,
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'],
    track: toSquare('g1'),
    pieceName: 'white knight from g1',
  },
  {
    id: 'ruy-bishop',
    fen: START_FEN,
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'],
    track: toSquare('f1'),
    pieceName: 'white bishop from f1',
  },
  {
    id: 'italian-knight',
    fen: START_FEN,
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5'],
    track: toSquare('g8'),
    pieceName: 'black knight from g8',
  },
  {
    id: 'sicilian-knight',
    fen: START_FEN,
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    track: toSquare('g1'),
    pieceName: 'white knight from g1',
  },
  {
    id: 'queens-gambit-rook',
    fen: START_FEN,
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O'],
    track: toSquare('h8'),
    pieceName: 'black rook from h8',
  },
  {
    id: 'queens-gambit-bishop',
    fen: START_FEN,
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O'],
    track: toSquare('c1'),
    pieceName: 'white bishop from c1',
  },
]

/**
 * Where the piece that started on `start` is after `history`.
 *
 * Castling moves the rook as well as the king, and chess.js reports only the king's
 * step, so the rook is followed by hand. `null` means the piece was captured, which
 * the lines above avoid but a general line may not.
 */
export function trackPiece(history: readonly PlayedMove[], start: Square): Square | null {
  let at: Square = start
  for (const move of history) {
    if (move.to === at && move.from !== at) return null
    if (move.from === at) {
      at = move.to
      continue
    }
    if (move.isCastle) {
      const rank = move.from[1]
      const kingSide = move.to.startsWith('g')
      const rookFrom = toSquare(`${kingSide ? 'h' : 'a'}${rank ?? '1'}`)
      if (rookFrom === at) at = toSquare(`${kingSide ? 'f' : 'd'}${rank ?? '1'}`)
    }
  }
  return at
}

/** The played moves of a line, or `null` when the line is illegal from its start. */
export function playLine(line: BlindfoldLine): readonly PlayedMove[] | null {
  const start = createGame(line.fen)
  if (!start.ok) return null
  const played = playMoves(start.value, line.moves)
  return played.ok ? played.value.history : null
}

/** Where the line's tracked piece ends up: the answer to the question. */
export function blindfoldAnswer(line: BlindfoldLine): Square | null {
  const history = playLine(line)
  return history === null ? null : trackPiece(history, line.track)
}

/** The position after the whole line, for the reveal once the player has answered. */
export function blindfoldFinalFen(line: BlindfoldLine): Fen | null {
  const start = createGame(line.fen)
  if (!start.ok) return null
  const played = playMoves(start.value, line.moves)
  return played.ok ? played.value.fen : null
}

export function pickLine(random: () => number, previous: BlindfoldLine | null): BlindfoldLine {
  const index = Math.min(BLINDFOLD_LINES.length - 1, Math.floor(random() * BLINDFOLD_LINES.length))
  const picked = BLINDFOLD_LINES[index] ?? BLINDFOLD_LINES[0]
  if (picked === undefined) throw new Error('There are no blindfold lines')
  if (picked.id !== previous?.id) return picked
  return BLINDFOLD_LINES[(index + 1) % BLINDFOLD_LINES.length] ?? picked
}
