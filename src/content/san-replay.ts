import { Chess } from 'chess.js'

import {
  FenSchema,
  SanSchema,
  SquareSchema,
  domainError,
  err,
  ok,
  parseValid,
  type Fen,
  type San,
  type Result,
  type Square,
} from '@/domain'

/**
 * Replaying SAN, as a port.
 *
 * Why a port and not a direct call: the 49 tutorials are lists of SAN moves with
 * no positions in them, so converting one into a `Lesson` means playing the moves
 * to find each step's FEN — and the rules engine that does that is `@/chess`
 * (S06), which is being built in parallel. The converter takes this function, the
 * default implementation below uses `chess.js` directly, and at the wave
 * integration checkpoint that one implementation is replaced by `@/chess`'s
 * without the converter changing.
 */

export interface ReplayedMove {
  /** The position *after* the move. */
  readonly fen: Fen
  readonly san: San
  readonly from: Square
  readonly to: Square
}

export type SanReplay = (fen: Fen, san: string) => Result<ReplayedMove>

/** The temporary implementation; swap for `@/chess` at integration. */
export function createChessJsReplay(): SanReplay {
  return (fen, san) => {
    const game = new Chess()
    try {
      game.load(fen)
    } catch (cause) {
      return err(domainError('validation', `Not a position chess.js can load: ${fen}`, { cause }))
    }
    try {
      const move = game.move(san)
      const after = parseValid(FenSchema, move.after, 'replayed position')
      if (!after.ok) return after
      const parsedSan = parseValid(SanSchema, move.san, 'replayed move')
      if (!parsedSan.ok) return parsedSan
      const from = parseValid(SquareSchema, move.from, 'replayed move')
      if (!from.ok) return from
      const to = parseValid(SquareSchema, move.to, 'replayed move')
      if (!to.ok) return to
      return ok({ fen: after.value, san: parsedSan.value, from: from.value, to: to.value })
    } catch (cause) {
      return err(
        domainError('validation', `${san} is not legal in this position`, {
          where: fen,
          cause,
        }),
      )
    }
  }
}
