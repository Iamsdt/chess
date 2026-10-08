import {
  applyMove,
  countMaterial,
  createGame,
  legalMoves,
  repetitionCount,
  undoMove,
  type ChessGame,
  type MoveInput,
  type PlayedMove,
} from '@/chess'
import { domainError, err, ok, type Color, type Fen, type Result, type Square } from '@/domain'
import type { Engine } from '@/engine'

import { squareAt as squareFromIndices } from './vision-squares'

import type { EndgameDrill } from './endgame-drills'

/**
 * Judging an endgame drill, as pure functions over a `ChessGame`.
 *
 * The runner never asks the engine "who is winning": the verdict comes from the rules
 * (mate, stalemate, repetition, fifty moves) and from simple material arithmetic, so
 * a drill is decided identically in a test with a scripted opponent and in the app.
 */

/** Three fold repetition is claimed automatically: a drill has no one to claim for. */
const REPETITION_DRAW = 3
/** Fifty full moves without a pawn move or capture, in half-moves. */
const FIFTY_MOVE_CLOCK = 100
/** Two stars for finishing within this share of par again. */
const TWO_STAR_SLACK = 1.25
/** A defender that falls this far behind the start has lost the hold. */
const DRAW_LOST_MARGIN = 3

export type DrillStars = 1 | 2 | 3

export type DrillFailure =
  | 'checkmated'
  | 'stalemate'
  | 'repetition'
  | 'fifty-move'
  | 'insufficient-material'
  | 'material-lost'

export type DrillSuccess = 'checkmate' | 'promotion' | 'drawn' | 'held'

export type DrillOutcome =
  | { readonly kind: 'playing' }
  | {
      readonly kind: 'success'
      readonly how: DrillSuccess
      /** The player's moves, which is what par is measured in. */
      readonly moves: number
      readonly stars: DrillStars
      /** A won drill can still be over par: "technically won". */
      readonly overPar: boolean
    }
  | { readonly kind: 'failed'; readonly reason: DrillFailure; readonly moves: number }

export interface DrillSession {
  readonly drill: EndgameDrill
  readonly game: ChessGame
  readonly outcome: DrillOutcome
}

/** The engine, narrowed to the one verb a defender needs. */
export interface DrillEnginePort {
  readonly bestMove: Engine['bestMove']
}

/** Why a short think: the defence is forced-ish, and a hung board reads as a crash. */
export const DEFENDER_MOVETIME_MS = 350

/** Material lead in pawn units from `color`'s side; negative when behind. */
function leadOf(fen: Fen, color: Color): number {
  const count = countMaterial(fen)
  const lead = count.whitePoints - count.blackPoints
  return color === 'white' ? lead : -lead
}

function playerMoves(history: readonly PlayedMove[], color: Color): number {
  return history.filter((move) => move.color === color).length
}

/** Index into the player's own moves at which a pawn first promoted, or `null`. */
function promotionMove(history: readonly PlayedMove[], color: Color): number | null {
  let count = 0
  for (const move of history) {
    if (move.color !== color) continue
    count += 1
    if (move.promotion !== undefined) return count
  }
  return null
}

export function starsForMoves(moves: number, par: number): { stars: DrillStars; overPar: boolean } {
  if (moves <= par) return { stars: 3, overPar: false }
  if (moves <= Math.ceil(par * TWO_STAR_SLACK)) return { stars: 2, overPar: true }
  return { stars: 1, overPar: true }
}

type DrawKind = 'stalemate' | 'insufficient-material' | 'repetition' | 'fifty-move'

/** A draw the rules have already produced, if any. */
function ruleDraw(game: ChessGame): DrawKind | null {
  if (game.status.kind === 'draw') return game.status.reason
  if (repetitionCount(game) >= REPETITION_DRAW) return 'repetition'
  if (game.halfmoveClock >= FIFTY_MOVE_CLOCK) return 'fifty-move'
  return null
}

/**
 * Where a drill stands after the latest ply.
 *
 * Order matters: the board's own endings (mate, a rule draw) are read first, then the
 * material test, then the goal-specific success. A promotion only counts once the
 * defender has had a reply, so a queen that is captured at once is a failure and not
 * a win.
 */
export function judgeDrill(drill: EndgameDrill, game: ChessGame): DrillOutcome {
  const { userColor } = drill
  const moves = playerMoves(game.history, userColor)
  const status = game.status

  if (status.kind === 'checkmate') {
    if (status.winner !== userColor) return { kind: 'failed', reason: 'checkmated', moves }
    // Mating the engine in a "hold the draw" drill is more than was asked.
    return { kind: 'success', how: 'checkmate', moves, ...starsForMoves(moves, drill.par) }
  }

  const draw = ruleDraw(game)
  if (draw !== null) {
    if (drill.goal === 'draw') {
      return { kind: 'success', how: 'drawn', moves, stars: 3, overPar: false }
    }
    return { kind: 'failed', reason: draw, moves }
  }

  const lead = leadOf(game.fen, userColor)
  const startLead = leadOf(drill.fen, userColor)

  if (drill.goal === 'draw') {
    // The attacker's lead is the negative of the player's, starting positive.
    if (lead >= 0) return { kind: 'success', how: 'drawn', moves, stars: 3, overPar: false }
    if (-lead >= -startLead + DRAW_LOST_MARGIN) {
      return { kind: 'failed', reason: 'material-lost', moves }
    }
    const last = game.history.at(-1)
    if (moves >= drill.par && last?.color !== userColor) {
      return { kind: 'success', how: 'held', moves, stars: 2, overPar: false }
    }
    return { kind: 'playing' }
  }

  if (lead < startLead) return { kind: 'failed', reason: 'material-lost', moves }

  if (drill.goal === 'promote') {
    const promotedAt = promotionMove(game.history, userColor)
    const last = game.history.at(-1)
    if (promotedAt !== null && last?.color !== userColor) {
      return {
        kind: 'success',
        how: 'promotion',
        moves: promotedAt,
        ...starsForMoves(promotedAt, drill.par),
      }
    }
  }
  return { kind: 'playing' }
}

export function startSession(drill: EndgameDrill): Result<DrillSession> {
  const started = createGame(drill.fen)
  if (!started.ok) return started
  return ok({ drill, game: started.value, outcome: judgeDrill(drill, started.value) })
}

export function isUserTurn(session: DrillSession): boolean {
  return session.outcome.kind === 'playing' && session.game.turn === session.drill.userColor
}

export function isDefenderTurn(session: DrillSession): boolean {
  return session.outcome.kind === 'playing' && session.game.turn !== session.drill.userColor
}

function advance(session: DrillSession, move: MoveInput): Result<DrillSession> {
  const next = applyMove(session.game, move)
  if (!next.ok) return next
  return ok({ ...session, game: next.value, outcome: judgeDrill(session.drill, next.value) })
}

export function playUserMove(session: DrillSession, move: MoveInput): Result<DrillSession> {
  if (!isUserTurn(session)) {
    return err(domainError('conflict', 'It is not your move', { where: 'drill: user move' }))
  }
  return advance(session, move)
}

export function playDefenderMove(session: DrillSession, move: MoveInput): Result<DrillSession> {
  if (!isDefenderTurn(session)) {
    return err(domainError('conflict', "It is not the engine's move", { where: 'drill: defender' }))
  }
  return advance(session, move)
}

/** Whether there is a move of the player's to take back. */
export function canTakeBack(session: DrillSession): boolean {
  return session.game.history.some((move) => move.color === session.drill.userColor)
}

/**
 * Rewind to the player's previous turn: the engine's reply goes too, otherwise the
 * takeback would hand the move straight back to a position the engine had answered.
 */
export function takeBack(session: DrillSession): Result<DrillSession> {
  if (!canTakeBack(session)) {
    return err(
      domainError('conflict', 'There is no move to take back', { where: 'drill: takeback' }),
    )
  }
  let game = session.game
  while (game.history.at(-1)?.color !== session.drill.userColor) {
    const undone = undoMove(game)
    if (!undone.ok) return undone
    game = undone.value
  }
  const undone = undoMove(game)
  if (!undone.ok) return undone
  return ok({ ...session, game: undone.value, outcome: judgeDrill(session.drill, undone.value) })
}

/** Ask the engine for the defender's reply and play it. */
export async function requestDefenderMove(
  session: DrillSession,
  port: DrillEnginePort,
  signal?: AbortSignal,
): Promise<Result<DrillSession>> {
  const answer = await port.bestMove(session.game.fen, {
    lane: 'play',
    // Full strength: a softened defender would make every drill easier than the real ending.
    elo: null,
    movetimeMs: DEFENDER_MOVETIME_MS,
    ...(signal === undefined ? {} : { signal }),
  })
  if (!answer.ok) return answer
  if (answer.value.move === null) {
    return err(
      domainError('conflict', 'The engine has no move in this position', {
        where: 'drill: defender',
      }),
    )
  }
  return playDefenderMove(session, answer.value.move)
}

/** The board's notion of legality for the player: every legal move, by origin square. */
export function legalMoveMap(session: DrillSession): ReadonlyMap<Square, readonly Square[]> {
  const map = new Map<Square, Square[]>()
  if (!isUserTurn(session)) return map
  for (const move of legalMoves(session.game)) {
    const targets = map.get(move.from)
    if (targets === undefined) map.set(move.from, [move.to])
    else if (!targets.includes(move.to)) targets.push(move.to)
  }
  return map
}

/** `1.Kd3 Kd5 2.e4+` — and `1...Kd5` when the list opens on Black's move. */
export function moveListText(history: readonly PlayedMove[]): string {
  const parts: string[] = []
  history.forEach((move, index) => {
    if (move.color === 'white') parts.push(`${String(move.moveNumber)}.${move.san}`)
    else if (index === 0) parts.push(`${String(move.moveNumber)}...${move.san}`)
    else parts.push(move.san)
  })
  return parts.join(' ')
}

/** Whether `from`→`to` is a pawn reaching the last rank, so the board should ask what to promote to. */
export function isPromotionMove(session: DrillSession, from: Square, to: Square): boolean {
  return legalMoves(session.game).some(
    (move) => move.from === from && move.to === to && move.promotion !== undefined,
  )
}

/**
 * Where `color`'s king stands, read straight off the placement field.
 *
 * Why not ask the rules: this runs on every render to mark a mated king, and a string
 * walk is cheaper than constructing a position.
 */
export function kingSquareOf(fen: Fen, color: Color): Square | null {
  const target = color === 'white' ? 'K' : 'k'
  const rows = (fen.split(' ')[0] ?? '').split('/')
  for (const [rowIndex, row] of rows.entries()) {
    let file = 0
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        file += Number(char)
        continue
      }
      if (char === target) return squareFromIndices(file, 7 - rowIndex)
      file += 1
    }
  }
  return null
}
