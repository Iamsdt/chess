import { createGame, legalMoves, type LegalMove } from '@/chess'
import type { Fen, PieceType, San } from '@/domain'

/**
 * How a move is read aloud, from fully spoken to plain notation.
 *
 * Why three levels: a beginner needs "knight from g1 to f3" to hear the squares, a
 * middle step ("knight to f3") drops the origin once it can be inferred, and the top
 * level is just the notation a game score uses.
 */
export const NARRATION_LEVELS = ['full', 'piece', 'san'] as const
export type NarrationLevel = (typeof NARRATION_LEVELS)[number]

const PIECE_NAMES: Readonly<Record<PieceType, string>> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

export const pieceName = (type: PieceType): string => PIECE_NAMES[type]

function suffix(san: string): string {
  if (san.endsWith('#')) return ', checkmate'
  if (san.endsWith('+')) return ', check'
  return ''
}

function findMove(fenBefore: Fen, san: San): LegalMove | null {
  const game = createGame(fenBefore)
  if (!game.ok) return null
  const wanted = san.replace(/[+#]/g, '')
  return legalMoves(game.value).find((move) => move.san.replace(/[+#]/g, '') === wanted) ?? null
}

/**
 * `san` as it is read at `level`. A move that is not legal from `fenBefore` is read as
 * its notation, so a bad line shows plainly instead of throwing mid-session.
 */
export function narrate(san: San, fenBefore: Fen, level: NarrationLevel): string {
  if (level === 'san') return san
  if (san.startsWith('O-O-O')) return `castles queenside${suffix(san)}`
  if (san.startsWith('O-O')) return `castles kingside${suffix(san)}`
  const move = findMove(fenBefore, san)
  if (move === null) return san
  const who = PIECE_NAMES[move.piece]
  const promotes =
    move.promotion === undefined ? '' : `, promoting to ${PIECE_NAMES[move.promotion]}`
  const verb = move.isCapture ? 'takes on' : 'to'
  const from = level === 'full' ? ` from ${move.from}` : ''
  const text =
    level === 'full' && !move.isCapture
      ? `${who}${from} to ${move.to}`
      : `${who}${from} ${verb} ${move.to}`
  return `${text}${promotes}${suffix(san)}`
}
