import { createGame, detectOpening, playMoves, serializePgn } from '@/chess'
import type { PgnGame, PlayedMove } from '@/chess'
import { gamesRepo, type GamesRepository } from '@/data'
import { domainError, err, now, ok } from '@/domain'
import type {
  Color,
  Game,
  GameId,
  GameMeta,
  MoveRecord,
  PlayerRef,
  Result,
  Timestamp,
} from '@/domain'

import { createClock } from './clock'
import { createPlayState } from './machine'

import type { ClockPair, PlayConfig, PlayState } from './machine'

/**
 * Autosave and resume.
 *
 * The rule this file enforces is that **the database is the only place a game
 * lives**. The setup screen writes an empty game and navigates; the game screen
 * reads whatever game is in progress and plays it. A reload is therefore not a
 * special case that needs its own code path — it is the ordinary path, run again,
 * which is the only way "resumes after a reload" stays true as the screen grows.
 *
 * What a reload does cost: the time the player had already spent thinking about
 * the move they had not yet made. The clocks resume from the last completed move,
 * because that is the last instant the move list can vouch for. Being generous
 * there is the right way to be wrong.
 */

/** The slice of `@/data` this feature uses, so a test can hand it a fake. */
export interface PlayStorage {
  readonly games: Pick<
    GamesRepository,
    'save' | 'list' | 'getWithMoves' | 'update' | 'setReviewState'
  >
}

export const defaultPlayStorage: PlayStorage = { games: gamesRepo }

function playerRefs(state: PlayState): { white: PlayerRef; black: PlayerRef } {
  const you: PlayerRef = {
    kind: 'you',
    name: state.config.yourName,
    rating: state.config.yourRating,
  }
  const engine: PlayerRef = {
    kind: 'engine',
    name: `Stockfish ${String(state.config.opponentRating)}`,
    rating: state.config.opponentRating,
    engineLevel: state.config.opponentRating,
    personality: state.config.personality,
  }
  return state.config.youPlay === 'white'
    ? { white: you, black: engine }
    : { white: engine, black: you }
}

/** What each side's clock read after `ply` half-moves. */
function clockAt(state: PlayState, ply: number, color: Color): number | undefined {
  if (!state.clock.timed) return undefined
  const pair = state.clockAfterPly[ply + 1]
  if (pair === undefined) return undefined
  return color === 'white' ? pair.whiteMs : pair.blackMs
}

/** The rows the moves table stores, straight from the game's own history. */
export function toMoveRecords(state: PlayState): MoveRecord[] {
  return state.game.history.map((move, ply) => {
    const clockMs = clockAt(state, ply, move.color)
    const timeSpentMs = state.moveTimesMs[ply]
    return {
      gameId: state.gameId,
      ply,
      moveNumber: move.moveNumber,
      color: move.color,
      san: move.san,
      uci: move.uci,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      ...(move.captured === undefined ? {} : { captured: move.captured }),
      ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
      isCheck: move.isCheck,
      isCheckmate: move.isCheckmate,
      ...(clockMs === undefined ? {} : { clockMs }),
      ...(timeSpentMs === undefined ? {} : { timeSpentMs }),
      wasTakenBack: false,
      isBook: false,
    }
  })
}

/** Why a PGN is written on every save: it is what the library exports and what a
 *  re-import reads, and regenerating it later would need the move list anyway. */
export function toPgn(state: PlayState): string {
  const { white, black } = playerRefs(state)
  const started = new Date(state.startedAt)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const game: PgnGame = {
    headers: {
      Event: 'Sparring',
      Site: 'Chess King',
      Date: `${String(started.getFullYear())}.${pad(started.getMonth() + 1)}.${pad(started.getDate())}`,
      Round: '-',
      White: white.name,
      Black: black.name,
    },
    initialFen: state.config.initialFen,
    moves: state.game.history.map((move: PlayedMove) => ({
      move,
      nags: [],
      variations: [],
    })),
    result: state.result,
  }
  return serializePgn(game)
}

export function toGameMeta(state: PlayState, at: Timestamp = now()): GameMeta {
  const { white, black } = playerRefs(state)
  const opening = detectOpening(state.game)
  return {
    id: state.gameId,
    createdAt: state.startedAt,
    updatedAt: at,
    startedAt: state.startedAt,
    ...(state.endedAt === null ? {} : { endedAt: state.endedAt }),
    source: 'sparring',
    white,
    black,
    youPlay: state.config.youPlay,
    result: state.result,
    termination: state.termination,
    timeControl: state.config.timeControl,
    initialFen: state.config.initialFen,
    finalFen: state.game.fen,
    plyCount: state.game.history.length,
    ...(opening === null ? {} : { opening }),
    reviewState: 'not-reviewed',
    mistakeCount: 0,
    // The review shows that a game had takebacks; the per-ply flag cannot survive
    // a replayed ply, because `(gameId, ply)` is the move table's own key.
    tags: state.takebacks > 0 ? ['takeback'] : [],
  }
}

export function toGame(state: PlayState, at: Timestamp = now()): Game {
  return { meta: toGameMeta(state, at), moves: toMoveRecords(state), pgn: toPgn(state) }
}

/**
 * Write the whole game.
 *
 * `games.save` replaces the move list inside one transaction, which is what makes
 * a takeback safe to persist: the plies that were taken back disappear instead of
 * being shadowed by the plies that replaced them.
 */
export async function saveGame(
  state: PlayState,
  storage: PlayStorage = defaultPlayStorage,
  at: Timestamp = now(),
): Promise<Result<GameId>> {
  const saved = await storage.games.save(toGame(state, at))
  return saved.ok ? ok(state.gameId) : err(saved.error)
}

/** A game that is still `*` and still `in-progress` is one the player walked away
 *  from; anything else has an outcome and belongs in the library. */
export async function findResumableGameId(
  storage: PlayStorage = defaultPlayStorage,
): Promise<GameId | null> {
  const rows = await storage.games.list({ source: 'sparring', result: '*' }, { limit: 10 })
  const row = rows.find((candidate) => candidate.termination === 'in-progress')
  return row?.id ?? null
}

/** Rebuild the per-ply clock record from what the move rows stored. */
function replayClocks(game: Game, initial: ClockPair): ClockPair[] {
  const pairs: ClockPair[] = [initial]
  let current = initial
  for (const move of game.moves) {
    const left = move.clockMs
    current =
      move.color === 'white'
        ? { whiteMs: left ?? current.whiteMs, blackMs: current.blackMs }
        : { whiteMs: current.whiteMs, blackMs: left ?? current.blackMs }
    pairs.push(current)
  }
  return pairs
}

export interface ResumeOptions {
  /** The three help toggles live in settings, not in the game row. */
  readonly trainingWheels: boolean
  readonly showEvaluation: boolean
  readonly allowTakebacks: boolean
  readonly at?: Timestamp
}

/**
 * Turn a stored game back into a live one.
 *
 * Errors rather than guessing when the moves do not replay: a move list that no
 * longer fits its starting position is corrupt, and playing on from a position
 * neither side reached would quietly invent a different game.
 */
export function resumePlayState(game: Game, options: ResumeOptions): Result<PlayState> {
  const at = options.at ?? now()
  const meta = game.meta
  const engine = meta.youPlay === 'white' ? meta.black : meta.white
  const you = meta.youPlay === 'white' ? meta.white : meta.black
  const config: PlayConfig = {
    youPlay: meta.youPlay,
    yourName: you.name,
    yourRating: you.rating ?? 1200,
    opponentRating: engine.engineLevel ?? engine.rating ?? 1200,
    personality: engine.personality ?? 'solid',
    timeControl: meta.timeControl,
    initialFen: meta.initialFen,
    trainingWheels: options.trainingWheels,
    showEvaluation: options.showEvaluation,
    allowTakebacks: options.allowTakebacks,
  }

  const start = createGame(meta.initialFen)
  if (!start.ok) return start
  const replayed = playMoves(
    start.value,
    game.moves.map((move) => move.uci),
  )
  if (!replayed.ok) {
    return err(
      domainError('validation', 'This saved game could not be replayed', {
        where: 'play: resume',
        cause: replayed.error,
      }),
    )
  }

  const base = createPlayState(config, meta.id, meta.startedAt)
  const initial = createClock(meta.timeControl, meta.startedAt)
  const pairs = replayClocks(game, { whiteMs: initial.whiteMs, blackMs: initial.blackMs })
  const last = pairs[pairs.length - 1] ?? { whiteMs: initial.whiteMs, blackMs: initial.blackMs }
  const turn = replayed.value.turn

  return ok({
    ...base,
    phase: 'playing',
    game: replayed.value,
    clock: {
      ...initial,
      whiteMs: last.whiteMs,
      blackMs: last.blackMs,
      runningFor: initial.timed ? turn : null,
      since: at,
    },
    clockAfterPly: pairs,
    moveTimesMs: game.moves.map((move) => move.timeSpentMs ?? 0),
    takebacks: meta.tags.includes('takeback') ? 1 : 0,
  })
}

/** The whole resume path in one call: what the game screen runs on mount. */
export async function loadResumableGame(
  options: ResumeOptions,
  storage: PlayStorage = defaultPlayStorage,
): Promise<Result<PlayState | null>> {
  const id = await findResumableGameId(storage)
  if (id === null) return ok(null)
  const stored = await storage.games.getWithMoves(id)
  if (stored === undefined) return ok(null)
  return resumePlayState(stored, options)
}

/**
 * Start a new game, retiring whatever was left unfinished.
 *
 * Why the setup screen saves before it navigates: the game screen's only input is
 * the database, so a game that is not written down is a game that does not exist.
 * And why the old one is marked `abandoned` rather than deleted: it was still a
 * game the player played, and the library would rather show a short game than
 * quietly lose one.
 */
export async function createSavedGame(
  state: PlayState,
  storage: PlayStorage = defaultPlayStorage,
): Promise<Result<GameId>> {
  const previous = await findResumableGameId(storage)
  if (previous !== null && previous !== state.gameId) {
    const retired = await storage.games.update(previous, { termination: 'abandoned' })
    if (!retired.ok) return err(retired.error)
  }
  return saveGame(state, storage, state.startedAt)
}
