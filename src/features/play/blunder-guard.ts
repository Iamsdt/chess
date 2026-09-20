import { applyMove, legalMoves, pieceAt, staticExchangeEvaluation } from '@/chess'
import type { ChessGame, MoveInput } from '@/chess'
import type { PieceType, Square, Uci } from '@/domain'

import { HANGING_THRESHOLD_CP } from './strength'

/**
 * Training wheels: the check that runs between "the player let go of the piece"
 * and "the move is played".
 *
 * **Why it is static.** The guard sits in the one place in the app where latency
 * is felt directly — the player has already committed, and anything they wait for
 * reads as the app being slow. So the verdict is arithmetic from `@/chess`'s
 * static exchange evaluator and nothing else: a FEN parse, one `applyMove` and one
 * SEE per opponent capture. No await, no worker round trip, no engine.
 *
 * **What the engine is for, then.** While the player is thinking, the screen runs
 * `engine.analyse` on the `interactive` lane and leaves its top moves in
 * {@link GuardContext}. The guard *reads that cache if it happens to be there* and
 * uses it only to stay quiet: a move the engine itself likes is a sacrifice, not a
 * blunder, and warning about it would teach the wrong lesson. A cache miss changes
 * nothing except that a sound sacrifice may get a warning the player can wave
 * away. The guard never waits for the engine — that is the whole design.
 *
 * **What it deliberately gets "wrong".** It warns about a piece that was already
 * hanging before this move, not only about one this move hung. That is the point:
 * a learner who is about to walk past their own loose knight should be told, and
 * "it was already loose" is not a reason to stay silent.
 */

/** The three shapes the warning copy comes in; the dialog picks its sentence from this. */
export type GuardReason = 'moves-into-attack' | 'leaves-piece-loose'

export interface GuardWarning {
  readonly reason: GuardReason
  /** The square that will be lost, in the position *after* the move. */
  readonly square: Square
  readonly piece: PieceType
  /** How much material the exchange loses, in centipawns. */
  readonly lossCp: number
  /** The reply that wins it, so the dialog can name it. */
  readonly refutation: Uci | null
}

/** What the `interactive` lane has managed to say about the position so far. */
export interface GuardContext {
  /** Moves the engine currently rates as best; a move in here is never warned about. */
  readonly trustedMoves: readonly Uci[]
}

export const EMPTY_GUARD_CONTEXT: GuardContext = { trustedMoves: [] }

const PIECE_NAMES: Readonly<Record<PieceType, string>> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

/** Why exported: the dialog, the live region and the e2e spec must all say the
 *  same sentence, and a screen that builds its own would drift from the tests. */
export function describeGuardWarning(warning: GuardWarning): string {
  const piece = PIECE_NAMES[warning.piece]
  return warning.reason === 'moves-into-attack'
    ? `That puts your ${piece} on ${warning.square} where it can be won.`
    : `After that move your ${piece} on ${warning.square} can be taken.`
}

/** The worst capture the side to move has, measured by the exchange it starts. */
function bestCapture(game: ChessGame): { uci: Uci; to: Square; gainCp: number } | null {
  let best: { uci: Uci; to: Square; gainCp: number } | null = null
  for (const move of legalMoves(game)) {
    if (!move.isCapture) continue
    const exchange = staticExchangeEvaluation(game.fen, move.uci)
    if (!exchange.ok) continue
    if (best === null || exchange.value > best.gainCp) {
      best = { uci: move.uci, to: move.to, gainCp: exchange.value }
    }
  }
  return best
}

/**
 * Judge a move the player is about to make.
 *
 * Returns `null` for "play it" — which is the answer for every move that does not
 * drop at least {@link HANGING_THRESHOLD_CP}, for checkmate (nothing is hanging
 * once the game is over) and for anything the engine cache vouches for.
 */
export function checkMoveForBlunder(
  game: ChessGame,
  move: MoveInput,
  context: GuardContext = EMPTY_GUARD_CONTEXT,
): GuardWarning | null {
  const played = applyMove(game, move)
  if (!played.ok) return null

  const last = played.value.history[played.value.history.length - 1]
  if (last === undefined) return null
  if (context.trustedMoves.includes(last.uci)) return null
  // Mate ends the game; material stops mattering the instant it lands.
  if (played.value.status.kind === 'checkmate') return null

  // Two different questions, and only one of them is about the square moved to.
  // The exchange on the destination already nets off whatever the move captured,
  // so an even trade scores zero there and a recapture is not counted twice.
  const selfExchange = staticExchangeEvaluation(game.fen, last.uci)
  const selfLoss = selfExchange.ok ? -selfExchange.value : 0
  const reply = bestCapture(played.value)

  if (selfLoss >= HANGING_THRESHOLD_CP) {
    return {
      reason: 'moves-into-attack',
      square: last.to,
      piece: last.promotion ?? last.piece,
      lossCp: selfLoss,
      refutation: reply !== null && reply.to === last.to ? reply.uci : null,
    }
  }

  // Anything else the opponent can now win is a piece this move left loose —
  // including one that was already loose before it, which is the point.
  if (reply !== null && reply.to !== last.to && reply.gainCp >= HANGING_THRESHOLD_CP) {
    const victim = pieceAt(played.value.fen, reply.to)
    if (victim !== null) {
      return {
        reason: 'leaves-piece-loose',
        square: reply.to,
        piece: victim.type,
        lossCp: reply.gainCp,
        refutation: reply.uci,
      }
    }
  }
  return null
}
