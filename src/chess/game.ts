import { type Chess, type Move } from 'chess.js'

import {
  domainError,
  err,
  FenSchema,
  ok,
  oppositeColor,
  positionKeyFromFen,
  SanSchema,
  START_FEN,
  toSquare,
  toUci,
  UCI_PATTERN,
  type Color,
  type Fen,
  type GameResult,
  type GameTermination,
  type PieceType,
  type PromotionPiece,
  type Result,
  type San,
  type Square,
  type Uci,
} from '@/domain'

import { asPromotionPiece, fromChessColor, fromChessPiece, newChess } from './chessjs'
import { validateFen } from './fen'

/**
 * An immutable game: a starting position plus the moves played from it.
 *
 * Why immutable when chess.js is not. Every screen that shows a game also shows a *past*
 * position — the review scrubs through plies, the analysis board branches, play-vs-engine
 * takes a move back and replays it. With a mutable board those are all the same object,
 * and a stale reference silently shows the wrong position. Here every state is a value:
 * `applyMove` returns a new one and leaves the old one exactly as it was, so a React
 * component can hold ply 12 for as long as it likes.
 *
 * The cost of that would normally be replaying the game on every query, so this module
 * keeps a `WeakMap` of the chess.js instance each state was reached by. The cache is an
 * optimisation and nothing else: every function behaves identically with it emptied,
 * which is what `rebuild()` is for and what the tests assert.
 */

/** A draw either side may claim but neither is forced to. */
export type ClaimableDraw = 'threefold-repetition' | 'fifty-move-rule'

/**
 * Where the game stands.
 *
 * Why threefold and the fifty-move rule are *claimable* rather than terminal: under FIDE
 * they end the game only when someone claims them (it is fivefold and seventy-five moves
 * that end it by themselves). Reporting them as a finished draw would take a legal move
 * away from a player who wanted to repeat once more to gain time.
 */
export type GameStatus =
  | {
      readonly kind: 'in-progress'
      readonly inCheck: boolean
      readonly claimableDraw: ClaimableDraw | null
    }
  | { readonly kind: 'checkmate'; readonly winner: Color }
  | {
      readonly kind: 'draw'
      readonly reason: 'stalemate' | 'insufficient-material'
    }

/** One move that was actually played, with everything a move list or a review needs. */
export interface PlayedMove {
  readonly san: San
  readonly uci: Uci
  readonly from: Square
  readonly to: Square
  readonly piece: PieceType
  readonly color: Color
  readonly captured?: PieceType
  readonly promotion?: PromotionPiece
  readonly fenBefore: Fen
  readonly fenAfter: Fen
  /** 0-based index into this game's own history, matching `MoveRecord.ply`. */
  readonly ply: number
  /** 1-based full-move number, as the move list prints it. */
  readonly moveNumber: number
  readonly isCapture: boolean
  readonly isEnPassant: boolean
  readonly isCastle: boolean
  readonly isCheck: boolean
  readonly isCheckmate: boolean
}

/** A move offered by the rules, before anyone chooses it. */
export interface LegalMove {
  readonly san: San
  readonly uci: Uci
  readonly from: Square
  readonly to: Square
  readonly piece: PieceType
  readonly promotion?: PromotionPiece
  readonly isCapture: boolean
}

export interface ChessGame {
  /** The position the game started from; not always the standard array. */
  readonly initialFen: Fen
  readonly fen: Fen
  readonly turn: Color
  /** How many half-moves have been played from `initialFen`. */
  readonly ply: number
  readonly moveNumber: number
  readonly halfmoveClock: number
  readonly history: readonly PlayedMove[]
  readonly status: GameStatus
}

/**
 * What `applyMove` accepts.
 *
 * A string is read as UCI when it looks like one (`g1f3`) and as SAN otherwise (`Nf3`) —
 * the two notations cannot collide, because UCI is always two squares and SAN never is.
 * The object form is what a board hands back from a drag, where nothing has been named
 * yet. `San` and `Uci` are branded strings, so both are accepted here as they are.
 */
export type MoveInput =
  string | { readonly from: Square; readonly to: Square; readonly promotion?: PromotionPiece }

const instances = new WeakMap<ChessGame, Chess>()

/** Replay from the starting position. The slow path, and the definition of correctness. */
function rebuild(game: ChessGame): Chess {
  const chess = newChess(game.initialFen)
  for (const move of game.history) {
    chess.move({
      from: move.from,
      to: move.to,
      ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
    })
  }
  return chess
}

/** Read-only access: the caller must not mutate what it gets back. */
function peek(game: ChessGame): Chess {
  const cached = instances.get(game)
  if (cached !== undefined) return cached
  const built = rebuild(game)
  instances.set(game, built)
  return built
}

/**
 * Take the instance away from a state so it can be mutated into the next one.
 *
 * Why it deletes: after the mutation the instance no longer represents `game`, and
 * leaving it behind in the map would hand a later reader the wrong position. Deleting
 * costs `game` nothing but a rebuild if it is queried again, which is the rare case.
 */
function take(game: ChessGame): Chess {
  const cached = instances.get(game)
  if (cached === undefined) return rebuild(game)
  instances.delete(game)
  return cached
}

function statusOf(chess: Chess): GameStatus {
  if (chess.isCheckmate()) {
    return { kind: 'checkmate', winner: oppositeColor(fromChessColor(chess.turn())) }
  }
  if (chess.isStalemate()) return { kind: 'draw', reason: 'stalemate' }
  if (chess.isInsufficientMaterial()) return { kind: 'draw', reason: 'insufficient-material' }
  const claimableDraw: ClaimableDraw | null = chess.isThreefoldRepetition()
    ? 'threefold-repetition'
    : chess.isDrawByFiftyMoves()
      ? 'fifty-move-rule'
      : null
  return { kind: 'in-progress', inCheck: chess.inCheck(), claimableDraw }
}

/**
 * Brand a string chess.js generated.
 *
 * Why these two throw rather than return a `Result`: chess.js has just produced the value
 * itself from a position this module validated, so a failure here is a broken assumption
 * about chess.js — a programmer error — and not something a caller could handle.
 */
function brandSan(san: string): San {
  const parsed = SanSchema.safeParse(san)
  if (!parsed.success) {
    throw new Error(`chess.js produced "${san}", which is not SAN as @/domain defines it`)
  }
  return parsed.data
}

function brandFen(fen: string): Fen {
  const parsed = FenSchema.safeParse(fen)
  if (!parsed.success) {
    throw new Error(`chess.js produced "${fen}", which is not a FEN as @/domain defines it`)
  }
  return parsed.data
}

function toPlayedMove(move: Move, ply: number): PlayedMove {
  const promotion = move.promotion === undefined ? undefined : asPromotionPiece(move.promotion)
  return {
    san: brandSan(move.san),
    uci: toUci(`${move.from}${move.to}${move.promotion ?? ''}`),
    from: toSquare(move.from),
    to: toSquare(move.to),
    piece: fromChessPiece(move.piece),
    color: fromChessColor(move.color),
    ...(move.captured === undefined ? {} : { captured: fromChessPiece(move.captured) }),
    ...(promotion === undefined ? {} : { promotion }),
    fenBefore: brandFen(move.before),
    fenAfter: brandFen(move.after),
    ply,
    moveNumber: Number(move.before.split(' ')[5] ?? '1'),
    isCapture: move.isCapture(),
    isEnPassant: move.isEnPassant(),
    isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
    isCheck: move.san.includes('+') || move.san.includes('#'),
    isCheckmate: move.san.includes('#'),
  }
}

function snapshot(chess: Chess, initialFen: Fen, history: readonly PlayedMove[]): ChessGame {
  const fen = chess.fen()
  const game: ChessGame = {
    initialFen,
    fen: brandFen(fen),
    turn: fromChessColor(chess.turn()),
    ply: history.length,
    moveNumber: chess.moveNumber(),
    halfmoveClock: Number(fen.split(' ')[4] ?? '0'),
    history,
    status: statusOf(chess),
  }
  instances.set(game, chess)
  return game
}

/**
 * Start a game from a position.
 *
 * The FEN is validated for legality, not just shape, because everything downstream —
 * legal moves, the engine, the repetition counter — assumes a position that could occur.
 */
export function createGame(fen: string = START_FEN): Result<ChessGame> {
  const validated = validateFen(fen)
  if (!validated.ok) return validated
  return ok(snapshot(newChess(validated.value), validated.value, []))
}

/** Why: import paths (PGN, share links, puzzle solutions) arrive as a list of moves. */
export function playMoves(from: ChessGame, moves: readonly MoveInput[]): Result<ChessGame> {
  let game = from
  for (const [index, move] of moves.entries()) {
    const next = applyMove(game, move)
    if (!next.ok) {
      return err(
        domainError('validation', `Move ${String(index + 1)} is illegal here`, {
          where: 'move list',
          details: next.error.details,
          cause: next.error,
        }),
      )
    }
    game = next.value
  }
  return ok(game)
}

/** Why one type for all three spellings: the board hands back squares, PGN hands back SAN. */
function chessJsInput(move: MoveInput): string | { from: string; to: string; promotion?: string } {
  if (typeof move !== 'string') {
    return {
      from: move.from,
      to: move.to,
      ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
    }
  }
  if (!UCI_PATTERN.test(move)) return move
  const promotion = move.slice(4)
  return {
    from: move.slice(0, 2),
    to: move.slice(2, 4),
    ...(promotion === '' ? {} : { promotion }),
  }
}

/**
 * Play a move, returning the game that results. The game passed in is untouched.
 *
 * An illegal move is an error *value*: a player dragging a pinned knight is not a bug, and
 * neither is a PGN with a typo in it.
 */
export function applyMove(game: ChessGame, move: MoveInput): Result<ChessGame> {
  const chess = take(game)
  let made: Move
  try {
    made = chess.move(chessJsInput(move), { strict: false })
  } catch {
    // The move was rejected, so the instance still matches `game`; give it back.
    instances.set(game, chess)
    const printed = typeof move === 'string' ? move : `${move.from}${move.to}`
    return err(
      domainError('validation', `"${printed}" is not a legal move in this position`, {
        where: 'move',
      }),
    )
  }
  return ok(snapshot(chess, game.initialFen, [...game.history, toPlayedMove(made, game.ply)]))
}

/**
 * Take back the last half-move.
 *
 * Errors rather than returning the same game when there is nothing to undo, so a takeback
 * button that should have been disabled shows up in a test instead of doing nothing.
 */
export function undoMove(game: ChessGame): Result<ChessGame> {
  if (game.history.length === 0) {
    return err(domainError('conflict', 'There is no move to take back', { where: 'takeback' }))
  }
  const chess = take(game)
  if (chess.undo() === null) {
    instances.set(game, chess)
    return err(domainError('conflict', 'There is no move to take back', { where: 'takeback' }))
  }
  return ok(snapshot(chess, game.initialFen, game.history.slice(0, -1)))
}

/** Every legal move in the current position, in chess.js's generation order. */
export function legalMoves(game: ChessGame): readonly LegalMove[] {
  return peek(game)
    .moves({ verbose: true })
    .map((move) => {
      const promotion = move.promotion === undefined ? undefined : asPromotionPiece(move.promotion)
      return {
        san: brandSan(move.san),
        uci: toUci(`${move.from}${move.to}${move.promotion ?? ''}`),
        from: toSquare(move.from),
        to: toSquare(move.to),
        piece: fromChessPiece(move.piece),
        ...(promotion === undefined ? {} : { promotion }),
        isCapture: move.isCapture(),
      }
    })
}

/** Why a separate function: the board asks this on every pointer-down, sixty times a second. */
export function legalMovesFrom(game: ChessGame, square: Square): readonly LegalMove[] {
  return legalMoves(game).filter((move) => move.from === square)
}

/** Why: the board rejects a drag before it animates it, and never needs the move itself. */
export function isLegalMove(game: ChessGame, move: MoveInput): boolean {
  return applyMove(game, move).ok
}

export function isGameOver(game: ChessGame): boolean {
  return game.status.kind !== 'in-progress'
}

/** Why checkmate counts: the king is in check there too, and every board highlights it. */
export function isCheck(game: ChessGame): boolean {
  if (game.status.kind === 'checkmate') return true
  return game.status.kind === 'in-progress' && game.status.inCheck
}

/**
 * How many times the current position has occurred in this game, counting now.
 *
 * Why it is exposed: chess.js answers "is this threefold?" but not "how close are we?",
 * and S12 needs the count both to offer a claim at three and to end the game at five.
 * Positions are compared on placement, side to move, castling rights and en passant — the
 * same key transposition detection uses — because the move counters differ every time.
 */
export function repetitionCount(game: ChessGame): number {
  const key = positionKeyFromFen(game.fen)
  let count = positionKeyFromFen(game.initialFen) === key ? 1 : 0
  for (const move of game.history) {
    if (positionKeyFromFen(move.fenAfter) === key) count += 1
  }
  return count
}

/** The result as PGN spells it. `*` while the game is still going. */
export function resultOf(game: ChessGame): GameResult {
  if (game.status.kind === 'checkmate') return game.status.winner === 'white' ? '1-0' : '0-1'
  if (game.status.kind === 'draw') return '1/2-1/2'
  return '*'
}

/**
 * Why the claimable draws are not reported here: the rules did not end this game, a player
 * did, and only the caller that saw the claim knows which. S12 sets
 * `'threefold-repetition'` or `'fifty-move-rule'` itself when a claim is accepted.
 */
export function terminationOf(game: ChessGame): GameTermination {
  if (game.status.kind === 'checkmate') return 'checkmate'
  if (game.status.kind === 'draw') return game.status.reason
  return 'in-progress'
}

/** Every position the game has stood in, starting position first. Used by the eval graph. */
export function positionsOf(game: ChessGame): readonly Fen[] {
  return [game.initialFen, ...game.history.map((move) => move.fenAfter)]
}
