import { describe, expect, it } from 'vitest'

import { positionKeyFromFen, START_FEN } from '@/domain'

import { gameAccuracy } from './accuracy'
import { classifyMove } from './classify'
import { detectOpening } from './eco'
import { normalizeFen, validateFen } from './fen'
import {
  applyMove,
  createGame,
  isGameOver,
  legalMoves,
  positionsOf,
  repetitionCount,
  resultOf,
  undoMove,
  type ChessGame,
} from './game'
import { countMaterial, materialBalance, staticExchangeEvaluation } from './material'
import { sanLineToUci, uciLineToSan } from './moves'
import { parsePgnGame, serializePgn } from './pgn'

/**
 * Property tests over random legal games.
 *
 * "Heavy unit tests" cover the cases someone thought of. These cover the ones nobody did:
 * a thousand random positions reached by legal play, run through every function in the
 * module, asserting the things that must hold for *all* of them. The generator is seeded,
 * so a failure names a seed that reproduces it exactly — a property test that cannot be
 * replayed is only a flake waiting to happen.
 */

/**
 * A small deterministic generator (mulberry32).
 *
 * Why not `Math.random`: a test that fails once every fifty runs and cannot be reproduced
 * is worse than no test, and `fast-check` is not a dependency of this project.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function newGame(): ChessGame {
  const game = createGame()
  if (!game.ok) throw new Error('the starting position is not legal')
  return game.value
}

/**
 * Play random legal moves until the game ends or the cap is reached.
 *
 * Memoised because the properties below each replay the same seeds, and generating a
 * hundred-ply game nine times over is time the suite can spend on more seeds instead.
 */
const playouts = new Map<string, ChessGame>()

function playout(seed: number, maxPlies = 100): ChessGame {
  const key = `${String(seed)}:${String(maxPlies)}`
  const cached = playouts.get(key)
  if (cached !== undefined) return cached
  const random = seeded(seed)
  let game = newGame()
  while (!isGameOver(game) && game.ply < maxPlies) {
    const moves = legalMoves(game)
    const chosen = moves[Math.floor(random() * moves.length)]
    if (chosen === undefined) break
    const next = applyMove(game, chosen.uci)
    if (!next.ok) {
      throw new Error(`seed ${String(seed)}: a legal move was rejected at ply ${String(game.ply)}`)
    }
    game = next.value
  }
  playouts.set(key, game)
  return game
}

const SEEDS = Array.from({ length: 40 }, (_, index) => index * 7919 + 1)

describe('random legal playouts', () => {
  it.each(SEEDS)('seed %i never produces an illegal state', (seed) => {
    const game = playout(seed)
    expect(game.ply).toBeGreaterThan(0)

    // Every position the game passed through is a legal position, already canonical.
    for (const fen of positionsOf(game)) {
      expect(validateFen(fen).ok).toBe(true)
      expect(normalizeFen(fen)).toEqual({ ok: true, value: fen })
    }

    // Each move links to the one before it.
    let previous = START_FEN
    for (const move of game.history) {
      expect(move.fenBefore).toBe(previous)
      previous = move.fenAfter
    }
    expect(game.fen).toBe(previous)

    // A finished game offers no moves, and an unfinished one always offers some.
    expect(legalMoves(game).length === 0).toBe(
      game.status.kind === 'checkmate' || game.status.kind === 'draw',
    )
    expect(['1-0', '0-1', '1/2-1/2', '*']).toContain(resultOf(game))
  })

  it.each(SEEDS.slice(0, 20))('seed %i survives a full undo back to the start', (seed) => {
    const game = playout(seed, 40)
    let current = game
    for (let remaining = game.ply; remaining > 0; remaining -= 1) {
      const undone = undoMove(current)
      expect(undone.ok).toBe(true)
      if (!undone.ok) return
      current = undone.value
    }
    expect(current.fen).toBe(START_FEN)
    expect(undoMove(current).ok).toBe(false)
  })

  it.each(SEEDS.slice(0, 20))('seed %i replays to exactly the same position', (seed) => {
    const game = playout(seed, 60)
    let replayed = newGame()
    for (const move of game.history) {
      const next = applyMove(replayed, move.san)
      expect(next.ok).toBe(true)
      if (!next.ok) return
      replayed = next.value
    }
    expect(replayed.fen).toBe(game.fen)
    expect(replayed.status).toEqual(game.status)
    expect(repetitionCount(replayed)).toBe(repetitionCount(game))
  })

  it.each(SEEDS.slice(0, 20))('seed %i round-trips SAN and UCI at every ply', (seed) => {
    const game = playout(seed, 60)
    const sans = game.history.map((move) => move.san)
    const ucis = sanLineToUci(START_FEN, sans)
    expect(ucis.ok).toBe(true)
    if (!ucis.ok) return
    expect(ucis.value).toEqual(game.history.map((move) => move.uci))
    const back = uciLineToSan(START_FEN, ucis.value)
    expect(back.ok && back.value).toEqual(sans)
  })

  it.each(SEEDS.slice(0, 20))('seed %i round-trips through PGN', (seed) => {
    const game = playout(seed, 60)
    const pgn = `[Result "${resultOf(game)}"]\n\n${game.history
      .map((move) =>
        move.color === 'white' ? `${String(move.moveNumber)}. ${move.san}` : move.san,
      )
      .join(' ')} ${resultOf(game)}\n`
    const parsed = parsePgnGame(pgn)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.moves.map((node) => node.move.san)).toEqual(
      game.history.map((move) => move.san),
    )
    // And writing it back out gives something that parses to the same thing.
    const again = parsePgnGame(serializePgn(parsed.value))
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.value.moves.map((node) => node.move.san)).toEqual(
      parsed.value.moves.map((node) => node.move.san),
    )
  })

  it.each(SEEDS.slice(0, 20))('seed %i keeps material arithmetic consistent', (seed) => {
    const game = playout(seed, 60)
    for (const fen of positionsOf(game)) {
      const count = countMaterial(fen)
      const balance = materialBalance(fen)
      expect(count.white.k).toBe(1)
      expect(count.black.k).toBe(1)
      expect(balance.points).toBe(count.whitePoints - count.blackPoints)
      expect(balance.advantage).toBe(Math.abs(balance.points))
      // Material can only ever go down over a game.
      expect(count.whitePoints).toBeLessThanOrEqual(39)
      expect(count.blackPoints).toBeLessThanOrEqual(39)
    }
  })

  it.each(SEEDS.slice(0, 20))('seed %i evaluates every legal exchange without crashing', (seed) => {
    const game = playout(seed, 40)
    for (const move of legalMoves(game)) {
      const exchange = staticExchangeEvaluation(game.fen, move.uci)
      expect(exchange.ok).toBe(true)
      if (!exchange.ok) return
      expect(Number.isFinite(exchange.value)).toBe(true)
      // A quiet move can never win material by exchange.
      if (!move.isCapture && move.promotion === undefined) {
        expect(exchange.value).toBeLessThanOrEqual(0)
      }
    }
  })

  it.each(SEEDS.slice(0, 20))('seed %i names an opening or honestly names none', (seed) => {
    const game = playout(seed, 40)
    const opening = detectOpening(game)
    if (opening === null) return
    expect(opening.name.length).toBeGreaterThan(0)
    expect(opening.eco).toMatch(/^[A-E][0-9]{2}$/)
    expect(opening.bookExitPly).toBeGreaterThanOrEqual(0)
    expect(opening.bookExitPly).toBeLessThanOrEqual(game.ply)
  })

  it.each(SEEDS.slice(0, 20))(
    'seed %i scores and classifies without producing nonsense',
    (seed) => {
      const random = seeded(seed + 1)
      const game = playout(seed, 60)
      // Stand-in evaluations: this module never asks where the numbers came from.
      const evals = game.history.map(() => Math.round((random() - 0.5) * 1200))
      const accuracy = gameAccuracy(evals)
      if (game.ply < 2) return
      expect(accuracy.ok).toBe(true)
      if (!accuracy.ok) return
      for (const value of [accuracy.value.white, accuracy.value.black]) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }

      for (const [index, move] of game.history.entries()) {
        const before = evals[index - 1] ?? 15
        const after = evals[index] ?? 15
        const sign = move.color === 'white' ? 1 : -1
        const quality = classifyMove({
          mover: move.color,
          scoreBefore: { kind: 'cp', value: before * sign },
          scoreAfter: { kind: 'cp', value: -after * sign },
          playedUci: move.uci,
          fenBefore: move.fenBefore,
        })
        expect(typeof quality).toBe('string')
      }
    },
  )

  it.each(SEEDS.slice(0, 20))('seed %i keeps transposition keys stable', (seed) => {
    const game = playout(seed, 60)
    for (const fen of positionsOf(game)) {
      const key = positionKeyFromFen(fen)
      expect(key.split(' ')).toHaveLength(4)
      expect(fen.startsWith(key)).toBe(true)
    }
  })
})
