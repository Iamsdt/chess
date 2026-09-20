import type { LegalMoveMap } from '@/board'
import { applyMove, createGame, legalMoves, uciToSan, type ChessGame } from '@/chess'
import {
  domainError,
  emptyBoardShapes,
  err,
  ok,
  toSquare,
  toUci,
  type BoardShapes,
  type Color,
  type HintLevel,
  type PromotionPiece,
  type Puzzle,
  type Result,
  type San,
  type Square,
  type Uci,
} from '@/domain'

/**
 * Solving one puzzle: the position, the line, and what the board is allowed to do.
 *
 * The dataset stores a full line, not a single move — `{"f6f3","g2g1","f3e2"}` — with the
 * **even indexes the user's moves and the odd ones the opponent's forced replies**
 * (`puzzleUserMoves` in `@/domain` says the same thing). So solving is a small state
 * machine: the user plays index 0, the app plays index 1 back at them, and so on until
 * the line runs out.
 *
 * Every rule comes from `@/chess`; nothing here knows how a knight moves. What it does
 * know is which move the line expects next, and the one place that is not a string
 * comparison: a move that delivers checkmate is always accepted, because a puzzle with a
 * second mate in one has two right answers and telling the user otherwise is a lie.
 */

export type SolveStatus = 'solving' | 'replying' | 'solved' | 'missed'

/** What the user's last move was judged to be. */
export type MoveVerdict =
  /** Right move, and the line goes on: an opponent reply is due. */
  | 'correct'
  /** Right move, and that was the last one. */
  | 'solved'
  /** Not the idea the puzzle is about. The position is left untouched. */
  | 'missed'

export interface SolveState {
  readonly puzzle: Puzzle
  readonly game: ChessGame
  /** Index into `puzzle.solution` of the move the line expects next. */
  readonly cursor: number
  readonly status: SolveStatus
  /** Every move the user actually tried, wrong ones included — the attempt record wants them. */
  readonly played: readonly Uci[]
  readonly wrongMoves: number
  readonly hintUsed: HintLevel | null
  readonly hintCount: number
  /** The squares of the move just made, for the board's last-move highlight. */
  readonly lastMove: { readonly from: Square; readonly to: Square } | null
  /** The side the user is playing, taken from the puzzle's FEN. */
  readonly userColor: Color
}

/** A move as the board hands it over. */
export interface AttemptedMove {
  readonly from: Square
  readonly to: Square
  readonly promotion?: PromotionPiece | undefined
}

/** Why a `Result`: a puzzle row can only reach here from storage, and storage is a boundary. */
export function createSolve(puzzle: Puzzle): Result<SolveState> {
  const game = createGame(puzzle.fen)
  if (!game.ok) return game
  if (puzzle.solution.length === 0) {
    return err(
      domainError('validation', 'The puzzle has no solution line', {
        where: `puzzle ${puzzle.id}`,
      }),
    )
  }
  return ok({
    puzzle,
    game: game.value,
    cursor: 0,
    status: 'solving',
    played: [],
    wrongMoves: 0,
    hintUsed: null,
    hintCount: 0,
    lastMove: null,
    userColor: game.value.turn,
  })
}

/** The move the line expects next, or `null` once the line is finished. */
export function expectedMove(state: SolveState): Uci | null {
  return state.puzzle.solution[state.cursor] ?? null
}

/** Whether the next move belongs to the user (even index) or to the opponent (odd). */
export function isUserTurn(state: SolveState): boolean {
  return state.cursor % 2 === 0
}

/** Destinations per origin square, which is the board's entire notion of legality. */
export function legalMoveMap(game: ChessGame): LegalMoveMap {
  const map = new Map<Square, Square[]>()
  for (const move of legalMoves(game)) {
    const destinations = map.get(move.from)
    if (destinations === undefined) map.set(move.from, [move.to])
    else if (!destinations.includes(move.to)) destinations.push(move.to)
  }
  return map
}

/** Whether a chosen `from`→`to` needs the promotion picker. The board never guesses. */
export function isPromotionMove(game: ChessGame, from: Square, to: Square): boolean {
  return legalMoves(game).some(
    (move) => move.from === from && move.to === to && move.promotion !== undefined,
  )
}

function uciOf(move: AttemptedMove): Uci {
  return toUci(`${move.from}${move.to}${move.promotion ?? ''}`)
}

/**
 * Judge one move by the user and, when it is right, play it.
 *
 * A wrong move leaves the position exactly as it was. That is a deliberate kindness: the
 * user keeps the board they were thinking about instead of having to undo a move they
 * already regret, and the session decides separately whether a miss ends the attempt.
 */
export function playUserMove(
  state: SolveState,
  move: AttemptedMove | Uci,
): { readonly state: SolveState; readonly verdict: MoveVerdict } {
  const attempted = typeof move === 'string' ? move : uciOf(move)
  const expected = expectedMove(state)
  if (expected === null || state.status !== 'solving') {
    return { state, verdict: 'missed' }
  }

  const played = applyMove(state.game, attempted)
  if (!played.ok) {
    // An illegal move never reaches here from the board, which checks `legalMoves` first.
    return { state: { ...state, played: [...state.played, attempted] }, verdict: 'missed' }
  }

  const isMate = played.value.status.kind === 'checkmate'
  if (attempted !== expected && !isMate) {
    return {
      state: { ...state, played: [...state.played, attempted], wrongMoves: state.wrongMoves + 1 },
      verdict: 'missed',
    }
  }

  const cursor = state.cursor + 1
  // A mate ends the puzzle whatever the line still says, and the last move of the line
  // ends it too. Anything else hands the turn to the scripted opponent.
  const finished = isMate || cursor >= state.puzzle.solution.length
  return {
    state: {
      ...state,
      game: played.value,
      cursor,
      status: finished ? 'solved' : 'replying',
      played: [...state.played, attempted],
      lastMove: { from: toSquare(attempted.slice(0, 2)), to: toSquare(attempted.slice(2, 4)) },
    },
    verdict: finished ? 'solved' : 'correct',
  }
}

/**
 * Play the opponent's scripted reply.
 *
 * "Engine replies" in the sprint's wording, but no engine is involved: the reply is the
 * forced move the dataset recorded, so the puzzle plays the same way offline, at zero
 * cost, and identically on every device.
 */
export function playOpponentReply(state: SolveState): SolveState {
  if (state.status !== 'replying') return state
  const reply = expectedMove(state)
  if (reply === null) return { ...state, status: 'solved' }
  const played = applyMove(state.game, reply)
  if (!played.ok) {
    // A line that does not replay is a broken row, not a user error: end it as solved
    // rather than blaming the user for the dataset.
    return { ...state, status: 'solved' }
  }
  const cursor = state.cursor + 1
  return {
    ...state,
    game: played.value,
    cursor,
    status: cursor >= state.puzzle.solution.length ? 'solved' : 'solving',
    lastMove: { from: toSquare(reply.slice(0, 2)), to: toSquare(reply.slice(2, 4)) },
  }
}

/** Give up on this one: the state stops accepting moves and the line may be shown. */
export function markMissed(state: SolveState): SolveState {
  return state.status === 'solved' ? state : { ...state, status: 'missed' }
}

/** Record that a hint rung was opened. The rating policy reads `hintUsed` afterwards. */
export function withHint(state: SolveState, level: HintLevel): SolveState {
  const rungs: HintLevel[] = ['nudge', 'square', 'move']
  const reached = rungs.indexOf(level)
  const current = state.hintUsed === null ? -1 : rungs.indexOf(state.hintUsed)
  if (reached <= current) return state
  return { ...state, hintUsed: level, hintCount: reached + 1 }
}

/** The whole line in SAN, for the "why it works" sentence and the summary replay. */
export function solutionSan(puzzle: Puzzle): Result<San[]> {
  const game = createGame(puzzle.fen)
  if (!game.ok) return game
  let current = game.value
  const line: San[] = []
  for (const move of puzzle.solution) {
    const san = uciToSan(current.fen, move)
    if (!san.ok) return san
    line.push(san.value)
    const played = applyMove(current, move)
    if (!played.ok) return played
    current = played.value
  }
  return ok(line)
}

/** True once the user has done everything the line asked of them. */
export function isSolved(state: SolveState): boolean {
  return state.status === 'solved'
}

/** The overlays the board draws: last move, check, and whatever a hint is pointing at. */
export function solveShapes(
  state: SolveState,
  extra: { readonly focus?: readonly Square[] | undefined } = {},
): BoardShapes {
  const shapes = emptyBoardShapes()
  if (state.lastMove !== null) shapes.highlight = [state.lastMove.from, state.lastMove.to]
  if (state.game.status.kind === 'in-progress' && state.game.status.inCheck) {
    const king = kingSquare(state.game)
    if (king !== null) shapes.check = king
  }
  if (extra.focus !== undefined) shapes.focus = [...extra.focus]
  return shapes
}

/** The square of the side-to-move's king, read off the FEN's placement field. */
function kingSquare(game: ChessGame): Square | null {
  const placement = game.fen.split(' ')[0] ?? ''
  const target = game.turn === 'white' ? 'K' : 'k'
  const files = 'abcdefgh'
  let rank = 8
  for (const row of placement.split('/')) {
    let file = 0
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        file += Number(char)
        continue
      }
      if (char === target) {
        const name = `${files[file] ?? 'a'}${String(rank)}`
        return toSquare(name)
      }
      file += 1
    }
    rank -= 1
  }
  return null
}
