import { createGame, legalMoves, playMoves } from '@/chess'
import golden from '@/chess/golden-lichess-games.json'
import {
  makeEngineEval,
  makeEngineLine,
  ok,
  toUci,
  type EngineEval,
  type EngineLine,
  type EngineScore,
  type Fen,
  type Game,
  type Uci,
} from '@/domain'

import { gameFrom } from './review-fixtures'

import type { Evaluator } from './analyse'

/**
 * Recorded engine data for review tests.
 *
 * The scores are Lichess's published Stockfish evaluations of three real games (see
 * `src/chess/golden-lichess-games.json`), so the tests exercise the review on numbers this
 * project did not make up. Only the engine's *preferred move* is not in that data; where a
 * test needs one it is picked from the legal moves by a fixed rule, which is enough to
 * check that the review repeats the engine's answer faithfully.
 */

interface RecordedScore {
  readonly cp?: number
  readonly mate?: number
}

export interface RecordedGame {
  readonly id: string
  readonly white: string
  readonly black: string
  readonly sanMoves: string
  readonly evals: readonly RecordedScore[]
  /** What Lichess itself published for the game. */
  readonly lichess: { readonly accuracy: { readonly white: number; readonly black: number } }
}

export const RECORDED_GAMES = golden.games as readonly RecordedGame[]

/** Lichess scores the start position as a small plus for White; the export omits it. */
const START_CP = 15

function scoreFor(recorded: RecordedScore, whiteToMove: boolean): EngineScore {
  const sign = whiteToMove ? 1 : -1
  if (recorded.mate !== undefined) return { kind: 'mate', moves: recorded.mate * sign }
  return { kind: 'cp', value: (recorded.cp ?? 0) * sign }
}

/** The recorded game as the user (Black, the side that usually has more to learn) played it. */
export function recordedGame(recorded: RecordedGame): Game {
  return gameFrom(recorded.sanMoves.split(' ').filter(Boolean), 'black')
}

/**
 * The engine's choice in a position: the `rank`-th legal move in a fixed order.
 *
 * Why not "the best move": there is no engine here. What matters is that the same move is
 * reported everywhere the review shows the engine's choice.
 */
function chosenMoves(fen: Fen, rank: number, length: number): Uci[] {
  const line: Uci[] = []
  const start = createGame(fen)
  if (!start.ok) return line
  let game = start.value
  for (let step = 0; step < length; step += 1) {
    const moves = legalMoves(game)
    const pick = moves[(rank + step) % Math.max(moves.length, 1)]
    if (pick === undefined) break
    const uci = toUci(`${pick.from}${pick.to}${pick.promotion ?? ''}`)
    line.push(uci)
    const next = playMoves(game, [uci])
    if (!next.ok) break
    game = next.value
  }
  return line
}

export interface RecordedEngine {
  readonly evaluate: Evaluator
  /** What the "engine" said about each position it was asked about. */
  readonly answers: ReadonlyMap<Fen, EngineEval>
}

/**
 * An evaluator answering from the recorded scores.
 *
 * `withBestMoves` adds the preferred move and a three-ply line to every answer; leave it
 * off for the golden review, where the data has none.
 */
export function recordedEngine(
  recorded: RecordedGame,
  options: { readonly withBestMoves?: boolean } = {},
): RecordedEngine {
  const game = recordedGame(recorded)
  const first = game.moves[0]
  if (first === undefined) throw new Error('recorded game has no moves')
  const fens: Fen[] = [first.fenBefore, ...game.moves.map((move) => move.fenAfter)]
  const scores: RecordedScore[] = [{ cp: START_CP }, ...recorded.evals]
  const answers = new Map<Fen, EngineEval>()

  for (const [index, fen] of fens.entries()) {
    const whiteToMove = fen.split(' ')[1] === 'w'
    const score = scoreFor(scores[index] ?? { cp: 0 }, whiteToMove)
    const line = options.withBestMoves === true ? chosenMoves(fen, index % 7, 3) : []
    const lines: EngineLine[] = line.length === 0 ? [] : [makeEngineLine({ score, pv: line })]
    answers.set(
      fen,
      makeEngineEval({ fen, score, bestMove: line[0] ?? null, ponder: line[1] ?? null, lines }),
    )
  }

  const evaluate: Evaluator = (fen) => {
    const answer = answers.get(fen)
    if (answer === undefined)
      throw new Error(`the review asked about an unrecorded position: ${fen}`)
    return Promise.resolve(ok(answer))
  }
  return { evaluate, answers }
}
