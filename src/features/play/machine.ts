import {
  applyMove,
  createGame,
  legalMoves,
  legalMovesFrom,
  pieceAt,
  repetitionCount,
  resultOf,
  terminationOf,
  undoMove,
} from '@/chess'
import type { ChessGame, MoveInput } from '@/chess'
import { oppositeColor, START_FEN, toSquare } from '@/domain'
import type {
  Color,
  DurationMs,
  EnginePersonality,
  Fen,
  GameId,
  GameResult,
  GameTermination,
  Square,
  TimeControl,
  Timestamp,
  Uci,
} from '@/domain'

import { checkMoveForBlunder } from './blunder-guard'
import {
  applyMoveToClock,
  createClock,
  flaggedAt,
  rewindClock,
  startClock,
  stopClock,
} from './clock'

import type { GuardWarning } from './blunder-guard'
import type { ClockState } from './clock'

/**
 * The game, as a reducer.
 *
 * Every rule about *chess* comes from `@/chess`; everything here is about the
 * rules of a *sparring session* — whose clock runs, when a takeback is allowed,
 * what a resignation does, when the engine is asked to think. Keeping it a pure
 * `(state, event) => state` is what makes "takeback never desyncs" a testable
 * claim rather than a hope: the board, the clock, the move list, the autosave and
 * the engine's turn all derive from one value, so they cannot disagree.
 *
 * The React layer owns exactly three things the reducer cannot: the wall clock
 * (every event carries its own `at`), the engine, and storage.
 */

export type PlayPhase = 'setup' | 'playing' | 'game-over'

/** Whether a draw has been offered and what came back. */
export type DrawOfferState = 'none' | 'pending' | 'declined'

export interface PlayConfig {
  readonly youPlay: Color
  readonly yourName: string
  readonly yourRating: number
  readonly opponentRating: number
  readonly personality: EnginePersonality
  readonly timeControl: TimeControl
  readonly initialFen: Fen
  readonly trainingWheels: boolean
  readonly showEvaluation: boolean
  readonly allowTakebacks: boolean
}

/** What both clocks read after a given ply; index 0 is the position before move 1. */
export interface ClockPair {
  readonly whiteMs: DurationMs
  readonly blackMs: DurationMs
}

export interface PlayState {
  readonly phase: PlayPhase
  readonly config: PlayConfig
  readonly gameId: GameId
  readonly startedAt: Timestamp
  readonly game: ChessGame
  readonly clock: ClockState
  /** One entry per ply boundary, so a takeback can put the clocks back exactly. */
  readonly clockAfterPly: readonly ClockPair[]
  readonly moveTimesMs: readonly DurationMs[]
  readonly result: GameResult
  readonly termination: GameTermination
  readonly endedAt: Timestamp | null
  /** True while the engine is searching; the board stays live so the user can look. */
  readonly thinking: boolean
  /** A move the guard is holding back, with the warning that stopped it. */
  readonly pending: { readonly move: MoveInput; readonly warning: GuardWarning } | null
  readonly drawOffer: DrawOfferState
  readonly takebacks: number
  /** Centipawns **from White's point of view**, as of the last search of any lane. */
  readonly evalCp: number | null
  /** The engine's current favourites; the guard stays quiet about these. */
  readonly trustedMoves: readonly Uci[]
  /** One calm sentence for the live region and the error strip, or `null`. */
  readonly error: string | null
}

export type PlayEvent =
  | { readonly type: 'start'; readonly at: Timestamp }
  | { readonly type: 'user-move'; readonly move: MoveInput; readonly at: Timestamp }
  | { readonly type: 'confirm-pending'; readonly at: Timestamp }
  | { readonly type: 'dismiss-pending' }
  | { readonly type: 'engine-move'; readonly uci: Uci; readonly at: Timestamp }
  | { readonly type: 'engine-thinking'; readonly value: boolean }
  | { readonly type: 'engine-eval'; readonly evalCp: number | null }
  | { readonly type: 'guard-context'; readonly trustedMoves: readonly Uci[] }
  | { readonly type: 'takeback'; readonly at: Timestamp }
  | { readonly type: 'resign'; readonly at: Timestamp }
  | { readonly type: 'offer-draw' }
  | { readonly type: 'draw-response'; readonly accepted: boolean; readonly at: Timestamp }
  | { readonly type: 'claim-draw'; readonly at: Timestamp }
  | { readonly type: 'tick'; readonly at: Timestamp }
  | { readonly type: 'error'; readonly message: string | null }

/** Five repetitions and 75 moves end a game by themselves; three and fifty only
 *  let a player claim one. `@/chess` reports the claimable pair, so the automatic
 *  pair is counted here against the numbers it exposes. */
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

export const AUTOMATIC_REPETITION = 5
export const AUTOMATIC_HALFMOVE_CLOCK = 150

/**
 * Build a game that has not started yet.
 *
 * An unplayable `initialFen` falls back to the standard array rather than
 * throwing: the FEN was validated on the setup screen, and a screen that renders
 * nothing is a worse answer to a corrupted saved game than a fresh board.
 */
export function createPlayState(
  config: PlayConfig,
  gameId: GameId,
  startedAt: Timestamp,
): PlayState {
  const created = createGame(config.initialFen)
  const game = created.ok ? created.value : fallbackGame()
  const clock = createClock(config.timeControl, startedAt)
  return {
    phase: 'setup',
    config: created.ok ? config : { ...config, initialFen: START_FEN },
    gameId,
    startedAt,
    game,
    clock,
    clockAfterPly: [{ whiteMs: clock.whiteMs, blackMs: clock.blackMs }],
    moveTimesMs: [],
    result: '*',
    termination: 'in-progress',
    endedAt: null,
    thinking: false,
    pending: null,
    drawOffer: 'none',
    takebacks: 0,
    evalCp: null,
    trustedMoves: [],
    error: null,
  }
}

function fallbackGame(): ChessGame {
  const standard = createGame(START_FEN)
  // The standard array is valid by construction; a failure here is a broken build.
  if (!standard.ok) throw new Error('The starting position failed to load')
  return standard.value
}

function finish(
  state: PlayState,
  result: GameResult,
  termination: GameTermination,
  at: Timestamp,
): PlayState {
  return {
    ...state,
    phase: 'game-over',
    result,
    termination,
    endedAt: at,
    clock: stopClock(state.clock, at),
    thinking: false,
    pending: null,
    drawOffer: 'none',
  }
}

/** The result of a win for `winner`, in the notation PGN uses. */
const winFor = (winner: Color): GameResult => (winner === 'white' ? '1-0' : '0-1')

/**
 * End the game if the position itself has ended it.
 *
 * Returns the same state when play continues, so callers can write
 * `return settleIfOver(next, at)` without first asking whether anything happened.
 */
function settleIfOver(state: PlayState, at: Timestamp): PlayState {
  const status = state.game.status
  if (status.kind !== 'in-progress') {
    return finish(state, resultOf(state.game), terminationOf(state.game), at)
  }
  if (repetitionCount(state.game) >= AUTOMATIC_REPETITION) {
    return finish(state, '1/2-1/2', 'threefold-repetition', at)
  }
  if (state.game.halfmoveClock >= AUTOMATIC_HALFMOVE_CLOCK) {
    return finish(state, '1/2-1/2', 'fifty-move-rule', at)
  }
  return state
}

/**
 * Play a move that has already been allowed through.
 *
 * Why the flag is checked first: a move made after the flag fell was made in a
 * game that was already over, and accepting it would let a player out of a loss by
 * moving quickly.
 */
function commitMove(state: PlayState, move: MoveInput, at: Timestamp): PlayState {
  const flagged = flaggedAt(state.clock, at)
  if (flagged !== null) return finish(state, winFor(oppositeColor(flagged)), 'timeout', at)

  const played = applyMove(state.game, move)
  if (!played.ok) {
    return { ...state, pending: null, error: 'That move is not legal in this position.' }
  }
  const mover = state.game.turn
  const elapsed = state.clock.timed ? Math.max(0, at - state.clock.since) : 0
  const clock = applyMoveToClock(state.clock, mover, at)
  const next: PlayState = {
    ...state,
    game: played.value,
    clock,
    clockAfterPly: [...state.clockAfterPly, { whiteMs: clock.whiteMs, blackMs: clock.blackMs }],
    moveTimesMs: [...state.moveTimesMs, elapsed],
    pending: null,
    error: null,
    // The engine's answer describes the position before this move, not after it.
    trustedMoves: [],
    drawOffer: state.drawOffer === 'pending' ? 'none' : state.drawOffer,
  }
  return settleIfOver(next, at)
}

function takeback(state: PlayState, at: Timestamp): PlayState {
  if (state.phase !== 'playing' || !state.config.allowTakebacks) return state
  const you = state.config.youPlay

  let game = state.game
  let removed = 0
  const top = (): Color | undefined => game.history[game.history.length - 1]?.color

  // The opponent's reply comes off first, then your own move, so the turn always
  // lands back on you — whether or not the engine had answered yet.
  if (game.history.length > 0 && top() !== you) {
    const undone = undoMove(game)
    if (!undone.ok) return state
    game = undone.value
    removed += 1
  }
  if (game.history.length > 0 && top() === you) {
    const undone = undoMove(game)
    if (!undone.ok) return state
    game = undone.value
    removed += 1
  }
  if (removed === 0) return state

  const restored = state.clockAfterPly[game.history.length]
  return {
    ...state,
    game,
    clock: restored === undefined ? state.clock : rewindClock(state.clock, restored, you, at),
    clockAfterPly: state.clockAfterPly.slice(0, game.history.length + 1),
    moveTimesMs: state.moveTimesMs.slice(0, game.history.length),
    takebacks: state.takebacks + 1,
    thinking: false,
    pending: null,
    drawOffer: 'none',
    trustedMoves: [],
    evalCp: null,
    error: null,
  }
}

export function playReducer(state: PlayState, event: PlayEvent): PlayState {
  switch (event.type) {
    case 'start': {
      if (state.phase !== 'setup') return state
      return {
        ...state,
        phase: 'playing',
        startedAt: event.at,
        clock: startClock(state.clock, state.game.turn, event.at),
      }
    }

    case 'user-move': {
      if (state.phase !== 'playing' || state.game.turn !== state.config.youPlay) return state
      if (state.pending !== null) return state
      if (state.config.trainingWheels) {
        const warning = checkMoveForBlunder(state.game, event.move, {
          trustedMoves: state.trustedMoves,
        })
        if (warning !== null) {
          return { ...state, pending: { move: event.move, warning }, error: null }
        }
      }
      return commitMove(state, event.move, event.at)
    }

    case 'confirm-pending': {
      const pending = state.pending
      if (pending === null) return state
      return commitMove({ ...state, pending: null }, pending.move, event.at)
    }

    case 'dismiss-pending':
      return state.pending === null ? state : { ...state, pending: null }

    case 'engine-move': {
      if (state.phase !== 'playing' || state.game.turn === state.config.youPlay) return state
      return { ...commitMove(state, event.uci, event.at), thinking: false }
    }

    case 'engine-thinking':
      return state.thinking === event.value ? state : { ...state, thinking: event.value }

    case 'engine-eval':
      return state.evalCp === event.evalCp ? state : { ...state, evalCp: event.evalCp }

    case 'guard-context':
      return { ...state, trustedMoves: event.trustedMoves }

    case 'takeback':
      return takeback(state, event.at)

    case 'resign':
      if (state.phase !== 'playing') return state
      return finish(state, winFor(oppositeColor(state.config.youPlay)), 'resignation', event.at)

    case 'offer-draw':
      if (state.phase !== 'playing' || state.drawOffer === 'pending') return state
      return { ...state, drawOffer: 'pending' }

    case 'draw-response':
      if (state.phase !== 'playing' || state.drawOffer !== 'pending') return state
      return event.accepted
        ? finish(state, '1/2-1/2', 'agreement', event.at)
        : { ...state, drawOffer: 'declined' }

    case 'claim-draw': {
      if (state.phase !== 'playing') return state
      const claim = claimableDrawOf(state)
      if (claim === null) return state
      return finish(state, '1/2-1/2', claim, event.at)
    }

    case 'tick': {
      if (state.phase !== 'playing') return state
      const flagged = flaggedAt(state.clock, event.at)
      if (flagged === null) return state
      return finish(state, winFor(oppositeColor(flagged)), 'timeout', event.at)
    }

    case 'error':
      return { ...state, error: event.message }
  }
}

/** The draw this position lets a player claim, if any. */
export function claimableDrawOf(state: PlayState): GameTermination | null {
  const status = state.game.status
  if (status.kind !== 'in-progress' || status.claimableDraw === null) return null
  return status.claimableDraw
}

/* ------------------------------------------------------------------ selectors */

/** Whose move it is, in the app's "you or the opponent" vocabulary. */
export function isYourTurn(state: PlayState): boolean {
  return state.phase === 'playing' && state.game.turn === state.config.youPlay
}

export function isEnginesTurn(state: PlayState): boolean {
  return state.phase === 'playing' && state.game.turn !== state.config.youPlay
}

export function canTakeBack(state: PlayState): boolean {
  if (state.phase !== 'playing' || !state.config.allowTakebacks) return false
  return state.game.history.some((move) => move.color === state.config.youPlay)
}

/**
 * The map `<Board>` needs: every legal destination, keyed by origin.
 *
 * Built here rather than in JSX because it *is* the rule the board is missing —
 * omit it and the board rejects every move.
 */
export function buildLegalMoveMap(game: ChessGame): ReadonlyMap<Square, readonly Square[]> {
  const map = new Map<Square, Square[]>()
  for (const move of legalMoves(game)) {
    const existing = map.get(move.from)
    if (existing === undefined) map.set(move.from, [move.to])
    else if (!existing.includes(move.to)) existing.push(move.to)
  }
  return map
}

/** A move promotes when the rules offer a promotion piece for that origin and target. */
export function promotesOn(game: ChessGame, from: Square, to: Square): boolean {
  return legalMovesFrom(game, from).some((move) => move.to === to && move.promotion !== undefined)
}

/**
 * The king square to flag as in check, or `null`.
 *
 * `<Board>` draws the marker but cannot find the king, so the screen that owns the
 * rules has to. The 64-square scan only runs while a king is actually in check.
 */
export function checkedKingSquare(game: ChessGame): Square | null {
  const status = game.status
  const inCheck = status.kind === 'checkmate' || (status.kind === 'in-progress' && status.inCheck)
  if (!inCheck) return null
  for (const file of FILES) {
    for (const rank of RANKS) {
      const square = toSquare(`${file}${rank}`)
      const piece = pieceAt(game.fen, square)
      if (piece !== null && piece.type === 'k' && piece.color === game.turn) return square
    }
  }
  return null
}
