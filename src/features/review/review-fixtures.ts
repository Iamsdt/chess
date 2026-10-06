import { applyMove, createGame } from '@/chess'
import {
  makeEngineEval,
  makeGameMeta,
  ok,
  toGameId,
  toUci,
  type Color,
  type Fen,
  type Game,
  type MoveRecord,
} from '@/domain'

import type { Evaluator } from './analyse'

export const GAME_ID = toGameId('review-test')

/** Builds a real game from SAN so every FEN in it is one chess.js agrees with. */
export function gameFrom(
  sans: readonly string[],
  youPlay: Color,
  wasTakenBack: readonly number[] = [],
): Game {
  const position = createGame().ok ? createGame() : undefined
  if (!position?.ok) throw new Error('no start position')
  let game = position.value
  const moves: MoveRecord[] = []
  for (const [ply, san] of sans.entries()) {
    const fenBefore = game.fen
    const color = game.turn
    const next = applyMove(game, san)
    if (!next.ok) throw new Error(`illegal fixture move ${san}`)
    const played = next.value.history.at(-1)
    if (played === undefined) throw new Error('no move played')
    moves.push({
      gameId: GAME_ID,
      ply,
      moveNumber: Math.floor(ply / 2) + 1,
      color,
      san: played.san,
      uci: toUci(`${played.from}${played.to}${played.promotion ?? ''}`),
      fenBefore,
      fenAfter: next.value.fen,
      isCheck: false,
      isCheckmate: false,
      wasTakenBack: wasTakenBack.includes(ply),
      isBook: false,
    })
    game = next.value
  }
  return {
    meta: makeGameMeta({
      id: GAME_ID,
      youPlay,
      white: {
        kind: youPlay === 'white' ? 'you' : 'engine',
        name: youPlay === 'white' ? 'Ada' : 'Stockfish 1200',
      },
      black: {
        kind: youPlay === 'black' ? 'you' : 'engine',
        name: youPlay === 'black' ? 'Ada' : 'Stockfish 1200',
      },
    }),
    moves,
  }
}

export const SCHOLARS = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']

/** White-POV centipawns after each position of the game above (8 positions, the last mated). */
export const WHITE_CP = [20, 30, 25, 40, 30, 60, 5000]

/**
 * An engine that answers from a table. Positions it is not given are the final, mated one,
 * which the review scores itself, so asking for it would be a bug.
 */
export function scripted(
  game: Game,
  best: Record<number, string> = {},
): { evaluate: Evaluator; asked: Fen[] } {
  const first = game.moves[0]
  if (first === undefined) throw new Error('fixture game has no moves')
  const fens: Fen[] = [first.fenBefore, ...game.moves.map((m) => m.fenAfter)]
  const asked: Fen[] = []
  const evaluate: Evaluator = (fen) => {
    asked.push(fen)
    const index = fens.indexOf(fen)
    const whiteCp = WHITE_CP[index] ?? 0
    const whiteToMove = fen.split(' ')[1] === 'w'
    const bestUci = best[index]
    return Promise.resolve(
      ok(
        makeEngineEval({
          fen,
          score: { kind: 'cp', value: whiteToMove ? whiteCp : -whiteCp },
          bestMove: bestUci === undefined ? null : toUci(bestUci),
          lines: [],
        }),
      ),
    )
  }
  return { evaluate, asked }
}
