import type { BoardMove, LegalMoveMap } from '@/board'
import { createGame, legalMoves } from '@/chess'
import { toSquare, type BoardShapes, type Fen, type Square, emptyBoardShapes } from '@/domain'

/**
 * The board's view of a repertoire position: which squares may move, which moves
 * promote, and what to highlight. Kept out of the components so it is testable on a FEN.
 */
export function legalMapFor(fen: Fen): LegalMoveMap {
  const started = createGame(fen)
  const map = new Map<Square, Square[]>()
  if (!started.ok) return map
  for (const move of legalMoves(started.value)) {
    const targets = map.get(move.from)
    if (targets === undefined) map.set(move.from, [move.to])
    else if (!targets.includes(move.to)) targets.push(move.to)
  }
  return map
}

/** Whether a chosen `from`→`to` needs the promotion picker. */
export function promotes(fen: Fen, from: Square, to: Square): boolean {
  const started = createGame(fen)
  if (!started.ok) return false
  return legalMoves(started.value).some(
    (move) => move.from === from && move.to === to && move.promotion !== undefined,
  )
}

export function uciOfBoardMove(move: BoardMove): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

/** Tint the squares of the move that led to a node. */
export function shapesForMove(uci: string | null): BoardShapes {
  const shapes = emptyBoardShapes()
  if (uci === null || uci.length < 4) return shapes
  return { ...shapes, highlight: [toSquare(uci.slice(0, 2)), toSquare(uci.slice(2, 4))] }
}
