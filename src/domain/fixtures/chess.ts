import { emptyMoveQualityCounts, type Game, type GameMeta, type MoveRecord } from '../game'
import { toGameId } from '../ids'
import { toFen, toSan, toUci } from '../primitives'

import { FIXTURE_NOW, fixtureTimeAfter, withOverrides } from './base'

import type { EngineEval, EngineLine } from '../engine'

/**
 * Games, moves and engine output.
 *
 * The position is the Italian Game after 7 moves — the same one the prototype's
 * live board preview uses, so a fixture screenshot matches the design.
 */

const ITALIAN_FEN = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7'
const ITALIAN_AFTER_NBD2 = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP1N1PPP/R1BQ1RK1 b - - 3 7'

/** Why: most callers want "an engine line", not a specific one. */
export function makeEngineLine(overrides?: Partial<EngineLine>): EngineLine {
  return withOverrides<EngineLine>(
    {
      multipv: 1,
      depth: 20,
      selDepth: 26,
      score: { kind: 'cp', value: 34 },
      pv: [toUci('b1d2'), toUci('a7a6'), toUci('d2f1')],
      nodes: 1_284_000,
      nps: 1_100_000,
      timeMs: 1_200,
    },
    overrides,
  )
}

export function makeEngineEval(overrides?: Partial<EngineEval>): EngineEval {
  return withOverrides<EngineEval>(
    {
      fen: toFen(ITALIAN_FEN),
      depth: 20,
      score: { kind: 'cp', value: 34 },
      bestMove: toUci('b1d2'),
      ponder: toUci('a7a6'),
      lines: [makeEngineLine()],
      nodes: 1_284_000,
      nps: 1_100_000,
      timeMs: 1_200,
      lane: 'interactive',
      engine: { name: 'Stockfish 19 lite', multiThreaded: true, threads: 3, hashMb: 64 },
      computedAt: FIXTURE_NOW,
    },
    overrides,
  )
}

export function makeMoveRecord(overrides?: Partial<MoveRecord>): MoveRecord {
  return withOverrides<MoveRecord>(
    {
      gameId: toGameId('game-fixture-1'),
      ply: 12,
      moveNumber: 7,
      color: 'white',
      san: toSan('Nbd2'),
      uci: toUci('b1d2'),
      fenBefore: toFen(ITALIAN_FEN),
      fenAfter: toFen(ITALIAN_AFTER_NBD2),
      isCheck: false,
      isCheckmate: false,
      timeSpentMs: 8_400,
      wasTakenBack: false,
      evalBefore: { kind: 'cp', value: 30 },
      evalAfter: { kind: 'cp', value: 34 },
      quality: 'best',
      bestMove: toUci('b1d2'),
      bestMoveSan: toSan('Nbd2'),
      isBook: false,
    },
    overrides,
  )
}

export function makeGameMeta(overrides?: Partial<GameMeta>): GameMeta {
  return withOverrides<GameMeta>(
    {
      id: toGameId('game-fixture-1'),
      createdAt: FIXTURE_NOW,
      updatedAt: fixtureTimeAfter(22),
      startedAt: FIXTURE_NOW,
      endedAt: fixtureTimeAfter(22),
      source: 'sparring',
      white: { kind: 'you', name: 'Shudipto', rating: 1180 },
      black: {
        kind: 'engine',
        name: 'Stockfish 1200',
        rating: 1200,
        engineLevel: 1200,
        personality: 'solid',
      },
      youPlay: 'white',
      result: '1-0',
      termination: 'resignation',
      timeControl: { kind: 'increment', initialMs: 600_000, incrementMs: 5_000 },
      initialFen: toFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      finalFen: toFen(ITALIAN_AFTER_NBD2),
      plyCount: 73,
      opening: {
        eco: 'C54',
        name: 'Italian Game',
        variation: 'Giuoco Pianissimo',
        bookExitPly: 12,
      },
      reviewState: 'reviewed',
      accuracy: { white: 84, black: 77 },
      qualityCounts: {
        white: {
          ...emptyMoveQualityCounts(),
          great: 1,
          best: 19,
          good: 8,
          book: 6,
          inaccuracy: 1,
          mistake: 2,
        },
        black: {
          ...emptyMoveQualityCounts(),
          best: 18,
          good: 8,
          book: 6,
          inaccuracy: 2,
          mistake: 2,
        },
      },
      mistakeCount: 3,
      tags: [],
    },
    overrides,
  )
}

export function makeGame(overrides?: Partial<Game>): Game {
  return withOverrides<Game>(
    {
      meta: makeGameMeta(),
      moves: [makeMoveRecord()],
      pgn: '[Event "Sparring"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0\n',
    },
    overrides,
  )
}
