import {
  domainError,
  err,
  ok,
  SanSchema,
  toSquare,
  toUci,
  UCI_PATTERN,
  type Fen,
  type PromotionPiece,
  type Result,
  type San,
  type Square,
  type Uci,
} from '@/domain'

import { newChess } from './chessjs'

/**
 * SAN ↔ UCI, and the pieces of a UCI move.
 *
 * Both notations are unavoidable: the engine and the puzzle data speak UCI, while people,
 * PGN and every screen speak SAN. Neither can be translated without a position, because
 * `Nf3` means nothing on its own — which is why every function here takes a FEN.
 */

/** A UCI move taken apart. Promotion is absent rather than `undefined` when there is none. */
export interface UciParts {
  readonly from: Square
  readonly to: Square
  readonly promotion?: PromotionPiece
}

const PROMOTION_BY_LETTER: Readonly<Record<string, PromotionPiece | undefined>> = {
  q: 'q',
  r: 'r',
  b: 'b',
  n: 'n',
}

/**
 * Split a UCI move into squares.
 *
 * Why it returns a `Result` and not a throw: UCI strings arrive from the engine, from the
 * puzzle CSV's `solution_ucis` column and from share links.
 */
export function parseUci(value: string): Result<UciParts> {
  if (!UCI_PATTERN.test(value)) {
    return err(
      domainError('validation', `"${value}" is not a UCI move such as e2e4 or g7g8q`, {
        where: 'UCI move',
      }),
    )
  }
  const from = toSquare(value.slice(0, 2))
  const to = toSquare(value.slice(2, 4))
  const promotion = PROMOTION_BY_LETTER[value.slice(4)]
  return promotion === undefined ? ok({ from, to }) : ok({ from, to, promotion })
}

/** Why: building `${from}${to}${promotion ?? ''}` by hand is how a stray `undefined` gets in. */
export function formatUci(parts: UciParts): Uci {
  return toUci(`${parts.from}${parts.to}${parts.promotion ?? ''}`)
}

/** Why: chess.js wants `promotion` absent, not `undefined`, under `exactOptionalPropertyTypes`. */
function moveArgs(parts: UciParts): { from: string; to: string; promotion?: string } {
  return {
    from: parts.from,
    to: parts.to,
    ...(parts.promotion === undefined ? {} : { promotion: parts.promotion }),
  }
}

/**
 * Translate one move from standard algebraic notation into UCI.
 *
 * Non-strict on input: PGN in the wild omits capture signs, writes `e.p.` and spells
 * castling with zeroes, and refusing to read a real person's game file helps nobody.
 */
export function sanToUci(fen: Fen, san: string): Result<Uci> {
  const chess = newChess(fen)
  try {
    const move = chess.move(san, { strict: false })
    return ok(toUci(`${move.from}${move.to}${move.promotion ?? ''}`))
  } catch {
    return err(
      domainError('validation', `"${san}" is not a legal move in this position`, {
        where: 'SAN move',
      }),
    )
  }
}

/**
 * Translate one move from UCI into standard algebraic notation.
 *
 * S07 calls this to fill `EngineLine.sanPv`, which is the only reason a principal
 * variation is readable on screen.
 */
export function uciToSan(fen: Fen, uci: string): Result<San> {
  const parts = parseUci(uci)
  if (!parts.ok) return parts
  const chess = newChess(fen)
  try {
    const move = chess.move(moveArgs(parts.value))
    const san = SanSchema.safeParse(move.san)
    if (!san.success) {
      return err(
        domainError('validation', `chess.js produced "${move.san}", which is not SAN`, {
          where: 'UCI move',
        }),
      )
    }
    return ok(san.data)
  } catch {
    return err(
      domainError('validation', `"${uci}" is not a legal move in this position`, {
        where: 'UCI move',
      }),
    )
  }
}

/**
 * Translate a whole line, each move played on the position the one before it produced.
 *
 * Fails on the first illegal move rather than returning a truncated line: a half-parsed
 * principal variation drawn as arrows on a board is worse than none.
 */
export function uciLineToSan(fen: Fen, line: readonly string[]): Result<San[]> {
  const chess = newChess(fen)
  const sans: San[] = []
  for (const [index, uci] of line.entries()) {
    const parts = parseUci(uci)
    if (!parts.ok) return parts
    try {
      const move = chess.move(moveArgs(parts.value))
      const san = SanSchema.safeParse(move.san)
      if (!san.success) {
        return err(
          domainError('validation', `Move ${String(index + 1)} is not SAN`, { where: 'UCI line' }),
        )
      }
      sans.push(san.data)
    } catch {
      return err(
        domainError('validation', `Move ${String(index + 1)} ("${uci}") is illegal here`, {
          where: 'UCI line',
        }),
      )
    }
  }
  return ok(sans)
}

/** The mirror of `uciLineToSan`, for PGN variations and lesson scripts written in SAN. */
export function sanLineToUci(fen: Fen, line: readonly string[]): Result<Uci[]> {
  const chess = newChess(fen)
  const ucis: Uci[] = []
  for (const [index, san] of line.entries()) {
    try {
      const move = chess.move(san, { strict: false })
      ucis.push(toUci(`${move.from}${move.to}${move.promotion ?? ''}`))
    } catch {
      return err(
        domainError('validation', `Move ${String(index + 1)} ("${san}") is illegal here`, {
          where: 'SAN line',
        }),
      )
    }
  }
  return ok(ucis)
}
