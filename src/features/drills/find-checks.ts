import { applyMove, createGame, isCheck, legalMoves, type LegalMove } from '@/chess'
import { toFen, type Fen } from '@/domain'

/**
 * The "find all checks" drill: positions where the player must name every move that
 * gives check. The answer is computed from the rules, never stored, so a position
 * cannot be added with a wrong answer.
 */

export interface CheckPosition {
  readonly id: string
  readonly fen: Fen
}

/**
 * Positions chosen for variety, not difficulty: discovered, queen, bishop and knight
 * checks, one position with a single obvious check, and one from Black's side.
 */
export const CHECK_POSITIONS: readonly CheckPosition[] = [
  {
    id: 'italian-bxf7',
    fen: toFen('r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 1 7'),
  },
  {
    id: 'scholars-queen',
    fen: toFen('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'),
  },
  { id: 'bishop-lines', fen: toFen('r3k2r/ppp2ppp/2n5/3q4/3P4/2N1B3/PPP1QPPP/R3K2R w KQkq - 0 1') },
  {
    id: 'knight-fork-squares',
    fen: toFen('r4rk1/ppp1qppp/2n5/3Np3/2B1P1b1/8/PPP2PPP/R2Q1RK1 w - - 0 1'),
  },
  { id: 'two-attackers', fen: toFen('5rk1/pp3ppp/2p5/4n3/2B1P3/2N2Q2/PPP3PP/5RK1 w - - 0 1') },
  { id: 'black-to-move', fen: toFen('4r1k1/pp3ppp/8/3q4/8/P2B4/1P3PPP/3Q2K1 b - - 0 24') },
]

/** Every legal move in `fen` that leaves the opponent in check, mate included. */
export function checkingMoves(fen: Fen): readonly LegalMove[] {
  const game = createGame(fen)
  if (!game.ok) return []
  return legalMoves(game.value).filter((move) => {
    const next = applyMove(game.value, move.uci)
    return next.ok && isCheck(next.value)
  })
}

/** Whether the move `from`→`to` (with any promotion) is among the position's checks. */
export function findCheck(
  checks: readonly LegalMove[],
  from: string,
  to: string,
): LegalMove | undefined {
  return checks.find((move) => move.from === from && move.to === to)
}

/** Positions in a fresh random order, so two rounds do not open the same way. */
export function shuffledPositions(random: () => number): readonly CheckPosition[] {
  const order = [...CHECK_POSITIONS]
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)))
    const a = order[i]
    const b = order[j]
    if (a === undefined || b === undefined) continue
    order[i] = b
    order[j] = a
  }
  return order
}
