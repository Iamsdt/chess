import { describe, expect, it } from 'vitest'

import { toFen, type EngineEval, type EngineScore, type Timestamp } from '@/domain'

import {
  gameAccuracy,
  gameAccuracyFromEvals,
  moveAccuracy,
  plyAccuracies,
  winningChances,
  winPercent,
  winPercentFromScore,
} from './accuracy'

const cp = (value: number): EngineScore => ({ kind: 'cp', value })
const mate = (moves: number): EngineScore => ({ kind: 'mate', moves })

describe('winningChances', () => {
  it('is zero at a level evaluation', () => {
    expect(winningChances(0)).toBe(0)
  })

  it('is symmetric about zero', () => {
    expect(winningChances(-250)).toBeCloseTo(-winningChances(250), 10)
  })

  it('rises with the evaluation and saturates', () => {
    expect(winningChances(100)).toBeGreaterThan(winningChances(50))
    expect(winningChances(5000)).toBe(winningChances(1000))
  })
})

describe('winPercent', () => {
  it('is fifty at a level evaluation', () => {
    expect(winPercent(0)).toBe(50)
  })

  it('reproduces the curve Lichess publishes', () => {
    // 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1), ceilinged at ±1000 centipawns.
    expect(winPercent(100)).toBeCloseTo(59.1, 1)
    expect(winPercent(300)).toBeCloseTo(75.1, 1)
    expect(winPercent(1000)).toBeCloseTo(97.5, 1)
    expect(winPercent(-1000)).toBeCloseTo(2.5, 1)
  })

  it('treats anything past the ceiling as the same "winning"', () => {
    expect(winPercent(100_000)).toBe(winPercent(1000))
  })
})

describe('winPercentFromScore', () => {
  it('reads a mate as very nearly certain, from the right side', () => {
    expect(winPercentFromScore(mate(3), 'white', 'white')).toBeGreaterThan(97)
    expect(winPercentFromScore(mate(3), 'white', 'black')).toBeLessThan(3)
  })

  it('flips a score reported from Black’s point of view', () => {
    // Black to move, Black is a rook up: +500 from the mover, −500 from White.
    expect(winPercentFromScore(cp(500), 'black', 'black')).toBeCloseTo(winPercent(500), 10)
    expect(winPercentFromScore(cp(500), 'black', 'white')).toBeCloseTo(winPercent(-500), 10)
  })
})

describe('moveAccuracy', () => {
  it('is a hundred for a move that gives nothing away', () => {
    expect(moveAccuracy(50, 50)).toBe(100)
    expect(moveAccuracy(50, 70)).toBe(100)
  })

  it('decays with the win percentage lost', () => {
    expect(moveAccuracy(50, 45)).toBeCloseTo(80.8, 1)
    expect(moveAccuracy(50, 40)).toBeCloseTo(64.6, 1)
    expect(moveAccuracy(50, 20)).toBeCloseTo(25.8, 1)
  })

  it('never goes below zero, however bad the move', () => {
    expect(moveAccuracy(100, 0)).toBeGreaterThanOrEqual(0)
    expect(moveAccuracy(100, 0)).toBeLessThan(5)
  })

  it('punishes the first points lost far more than the last', () => {
    const firstFive = 100 - moveAccuracy(50, 45)
    const secondFive = moveAccuracy(50, 45) - moveAccuracy(50, 40)
    expect(firstFive).toBeGreaterThan(secondFive)
  })
})

describe('plyAccuracies', () => {
  it('gives one entry per half-move, alternating colours', () => {
    const plies = plyAccuracies([20, 10, 30, 15])
    expect(plies.ok).toBe(true)
    if (!plies.ok) return
    expect(plies.value.map((ply) => ply.color)).toEqual(['white', 'black', 'white', 'black'])
    expect(plies.value.map((ply) => ply.ply)).toEqual([0, 1, 2, 3])
  })

  it('starts Black when the game was set up with Black to move', () => {
    const plies = plyAccuracies([20, 10], { startColor: 'black' })
    expect(plies.ok && plies.value.map((ply) => ply.color)).toEqual(['black', 'white'])
  })

  it('reads the evaluations from White and reports from the mover', () => {
    // White's move takes the evaluation from +20 to −200: a bad move for White.
    const plies = plyAccuracies([-200])
    expect(plies.ok).toBe(true)
    if (!plies.ok) return
    const first = plies.value[0]
    expect(first?.color).toBe('white')
    expect(first?.winPercentBefore).toBeGreaterThan(first?.winPercentAfter ?? 100)
    expect(first?.accuracy).toBeLessThan(60)
  })

  it('weights a sharp phase more heavily than a quiet one', () => {
    const quiet = plyAccuracies(Array.from({ length: 40 }, () => 20))
    const sharp = plyAccuracies(
      Array.from({ length: 40 }, (_, index) => (index % 2 === 0 ? 400 : -400)),
    )
    expect(quiet.ok && sharp.ok).toBe(true)
    if (!quiet.ok || !sharp.ok) return
    const quietWeight = quiet.value[20]?.weight ?? 0
    const sharpWeight = sharp.value[20]?.weight ?? 0
    expect(sharpWeight).toBeGreaterThan(quietWeight)
  })

  it('refuses a game with no evaluated moves', () => {
    expect(plyAccuracies([]).ok).toBe(false)
  })
})

describe('gameAccuracy', () => {
  it('is a hundred for a game where neither side ever gave anything away', () => {
    // A perfectly flat evaluation: every move keeps the position exactly as it was.
    const accuracy = gameAccuracy(Array.from({ length: 30 }, () => 15))
    expect(accuracy.ok).toBe(true)
    if (!accuracy.ok) return
    expect(accuracy.value.white).toBeCloseTo(100, 5)
    expect(accuracy.value.black).toBeCloseTo(100, 5)
  })

  it('punishes the side that made the mistakes and leaves the other alone', () => {
    // White loses a hundred centipawns on every one of their moves; Black holds the line.
    const evals: number[] = []
    let current = 15
    for (let index = 0; index < 30; index += 1) {
      if (index % 2 === 0) current -= 100
      evals.push(current)
    }
    const accuracy = gameAccuracy(evals)
    expect(accuracy.ok).toBe(true)
    if (!accuracy.ok) return
    expect(accuracy.value.black).toBeCloseTo(100, 5)
    expect(accuracy.value.white).toBeLessThan(90)
  })

  it('stays inside nought to a hundred', () => {
    const accuracy = gameAccuracy([-900, 900, -900, 900, -900, 900])
    expect(accuracy.ok).toBe(true)
    if (!accuracy.ok) return
    expect(accuracy.value.white).toBeGreaterThanOrEqual(0)
    expect(accuracy.value.white).toBeLessThanOrEqual(100)
    expect(accuracy.value.black).toBeGreaterThanOrEqual(0)
    expect(accuracy.value.black).toBeLessThanOrEqual(100)
  })

  it('refuses a game where only one side has moved', () => {
    expect(gameAccuracy([20]).ok).toBe(false)
  })
})

describe('gameAccuracyFromEvals', () => {
  it('reads the side to move out of each evaluation’s own FEN', () => {
    const evals: EngineEval[] = [
      {
        fen: toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'),
        depth: 18,
        // Black to move, so +30 here means Black is thirty centipawns better.
        score: cp(30),
        bestMove: null,
        ponder: null,
        lines: [],
        lane: 'batch',
        computedAt: 0 as Timestamp,
      },
      {
        fen: toFen('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'),
        depth: 18,
        score: cp(30),
        bestMove: null,
        ponder: null,
        lines: [],
        lane: 'batch',
        computedAt: 0 as Timestamp,
      },
    ]
    const fromEvals = gameAccuracyFromEvals(evals)
    const fromNumbers = gameAccuracy([-30, 30])
    expect(fromEvals.ok && fromNumbers.ok).toBe(true)
    if (!fromEvals.ok || !fromNumbers.ok) return
    expect(fromEvals.value).toEqual(fromNumbers.value)
  })
})
