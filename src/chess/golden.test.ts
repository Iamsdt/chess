import { describe, expect, it } from 'vitest'

import { toUci, type Color, type EngineScore, type MoveQuality, type Uci } from '@/domain'

import { gameAccuracy } from './accuracy'
import { classifyMove } from './classify'
import { detectOpeningFromMoves } from './eco'
import { createGame, playMoves, resultOf, terminationOf } from './game'
import golden from './golden-lichess-games.json'
import { materialBalance, staticExchangeEvaluation } from './material'
import { mainLine, parsePgnGame, serializePgn } from './pgn'

/**
 * Golden-file tests: the numbers this module produces, checked against numbers this
 * project did not produce.
 *
 * **Where the reference numbers come from.** `golden-lichess-games.json` holds three real,
 * publicly viewable Lichess games exported through Lichess's own API with
 * `?evals=true&accuracy=true`. Everything in it — the Stockfish evaluation after every
 * half-move, the per-move judgement, the accuracy percentage and the
 * inaccuracy/mistake/blunder counts for each player — was computed and published by
 * Lichess. Open the `url` of any of the three and the figures on the page are the ones
 * asserted here. Nothing in that file is this project's own output, which is the whole
 * point: a golden file that only asserts what the code already does proves nothing.
 *
 * The two famous games below are checked without evaluations, on facts anyone can verify
 * from the score alone — the moves are legal, the game ends in mate, the opening is what
 * the books call it, and the queen sacrifice really does give up a queen.
 *
 * **Tolerances, and why they are what they are.**
 *
 * - *Accuracy: 0.6 percentage points.* This implementation reproduces Lichess's formula
 *   exactly, so the only difference is that Lichess publishes an integer. Half a point of
 *   rounding plus a little floating-point slack is the whole budget.
 * - *Mistakes and blunders: exact.* Across all three games and both sides, the counts
 *   agree move for move with Lichess's, once Lichess's blunders are compared with this
 *   module's blunders **plus** its misses — Lichess has no separate "missed win" verdict,
 *   so a move it calls a blunder is a move this module calls either a blunder or a miss.
 * - *Inaccuracies: up to 3 fewer per side, never more.* Lichess has a second code path
 *   that judges mate-related swings by their comment rather than by a threshold ("lost
 *   forced checkmate sequence", "checkmate is now unavoidable") and labels them
 *   inaccuracies even where almost no winning chances changed hands. This module
 *   deliberately does not copy it, so it finds the same inaccuracies Lichess does minus
 *   those. The test asserts the direction as well as the size, so the day this module
 *   starts finding inaccuracies Lichess did not, the test says so.
 */

interface GoldenEval {
  readonly cp?: number
  readonly mate?: number
}

interface GoldenGame {
  readonly id: string
  readonly url: string
  readonly white: string
  readonly black: string
  readonly opening: { readonly eco: string; readonly name: string }
  readonly sanMoves: string
  readonly evals: readonly GoldenEval[]
  readonly lichess: {
    readonly accuracy: { readonly white: number; readonly black: number }
    readonly judgmentCounts: {
      readonly white: {
        readonly inaccuracy: number
        readonly mistake: number
        readonly blunder: number
      }
      readonly black: {
        readonly inaccuracy: number
        readonly mistake: number
        readonly blunder: number
      }
    }
  }
}

const games = golden.games as readonly GoldenGame[]

/** Lichess collapses a mate to its evaluation ceiling before scoring; so does this. */
const MATE_CENTIPAWNS = 1000

function whiteCentipawns(value: GoldenEval): number {
  if (value.cp !== undefined) return value.cp
  const mate = value.mate ?? 0
  return mate >= 0 ? MATE_CENTIPAWNS : -MATE_CENTIPAWNS
}

function toScore(value: GoldenEval, fromWhite: boolean): EngineScore {
  const sign = fromWhite ? 1 : -1
  if (value.mate !== undefined) return { kind: 'mate', moves: value.mate * sign }
  return { kind: 'cp', value: (value.cp ?? 0) * sign }
}

/** Classification needs a move only to compare against the engine's choice, which these golden games do not carry. */
const PLACEHOLDER_UCI: Uci = toUci('e2e4')

const ACCURACY_TOLERANCE = 0.6
const INACCURACY_TOLERANCE = 3

describe.each(games)('$id — $white vs $black', (game) => {
  it('is a legal game, and its evaluation list covers every half-move', () => {
    const sans = game.sanMoves.split(' ').filter(Boolean)
    const start = createGame()
    expect(start.ok).toBe(true)
    if (!start.ok) return
    const played = playMoves(start.value, sans)
    expect(played.ok).toBe(true)
    if (!played.ok) return
    expect(played.value.ply).toBe(sans.length)
    expect(game.evals).toHaveLength(sans.length)
  })

  it(`reproduces the accuracy Lichess published, within ${String(ACCURACY_TOLERANCE)} points`, () => {
    const accuracy = gameAccuracy(game.evals.map(whiteCentipawns))
    expect(accuracy.ok).toBe(true)
    if (!accuracy.ok) return
    expect(accuracy.value.white).toBeCloseTo(game.lichess.accuracy.white, 0)
    expect(accuracy.value.black).toBeCloseTo(game.lichess.accuracy.black, 0)
    expect(Math.abs(accuracy.value.white - game.lichess.accuracy.white)).toBeLessThanOrEqual(
      ACCURACY_TOLERANCE,
    )
    expect(Math.abs(accuracy.value.black - game.lichess.accuracy.black)).toBeLessThanOrEqual(
      ACCURACY_TOLERANCE,
    )
  })

  it('counts exactly the mistakes and blunders Lichess counted', () => {
    const counts: Record<Color, { inaccuracy: number; mistake: number; blunder: number }> = {
      white: { inaccuracy: 0, mistake: 0, blunder: 0 },
      black: { inaccuracy: 0, mistake: 0, blunder: 0 },
    }

    for (const [index, evaluation] of game.evals.entries()) {
      const moverIsWhite = index % 2 === 0
      const mover: Color = moverIsWhite ? 'white' : 'black'
      const previous = game.evals[index - 1] ?? { cp: 15 }
      const quality: MoveQuality = classifyMove({
        mover,
        scoreBefore: toScore(previous, moverIsWhite),
        scoreAfter: toScore(evaluation, !moverIsWhite),
        playedUci: PLACEHOLDER_UCI,
      })
      if (quality === 'inaccuracy') counts[mover].inaccuracy += 1
      if (quality === 'mistake') counts[mover].mistake += 1
      // Lichess has no separate "missed win", so its blunders are our blunders plus misses.
      if (quality === 'blunder' || quality === 'miss') counts[mover].blunder += 1
    }

    for (const color of ['white', 'black'] as const) {
      const published = game.lichess.judgmentCounts[color]
      const mine = counts[color]
      expect(mine.mistake).toBe(published.mistake)
      expect(mine.blunder).toBe(published.blunder)
      // Never more inaccuracies than Lichess found, and never more than three fewer.
      expect(mine.inaccuracy).toBeLessThanOrEqual(published.inaccuracy)
      expect(published.inaccuracy - mine.inaccuracy).toBeLessThanOrEqual(INACCURACY_TOLERANCE)
    }
  })

  it('names the opening Lichess named', () => {
    const opening = detectOpeningFromMoves(game.sanMoves.split(' ').filter(Boolean))
    expect(opening.ok).toBe(true)
    if (!opening.ok || opening.value === null) throw new Error('no opening was detected')
    // The bundled table is a reduction of Lichess's, so the family must agree even where
    // the exact sub-variation is not carried.
    const family = game.opening.name.split(':')[0] ?? game.opening.name
    expect(opening.value.name).toBe(family)
  })
})

/**
 * Morphy vs the Duke of Brunswick and Count Isouard, Paris 1858 — the Opera Game.
 * Every assertion below can be checked against any printed copy of the score.
 */
const OPERA_GAME = `[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[Round "?"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0
`

/** Anderssen vs Kieseritzky, London 1851 — the Immortal Game. */
const IMMORTAL_GAME = `[Event "London"]
[Site "London ENG"]
[Date "1851.06.21"]
[Round "?"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5
8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8
15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6
21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0
`

describe('the Opera Game', () => {
  it('plays through to mate', () => {
    const parsed = parsePgnGame(OPERA_GAME)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(mainLine(parsed.value)).toHaveLength(33)
    expect(parsed.value.result).toBe('1-0')
    const start = createGame()
    if (!start.ok) return
    const played = playMoves(
      start.value,
      mainLine(parsed.value).map((move) => move.san),
    )
    expect(played.ok).toBe(true)
    if (!played.ok) return
    expect(played.value.status).toEqual({ kind: 'checkmate', winner: 'white' })
    expect(resultOf(played.value)).toBe('1-0')
    expect(terminationOf(played.value)).toBe('checkmate')
  })

  it('is the Philidor Defence, as every book has it', () => {
    const parsed = parsePgnGame(OPERA_GAME)
    if (!parsed.ok) return
    const opening = detectOpeningFromMoves(mainLine(parsed.value).map((move) => move.san))
    expect(opening.ok).toBe(true)
    if (!opening.ok || opening.value === null) throw new Error('no opening was detected')
    expect(opening.value.eco?.startsWith('C4')).toBe(true)
    expect(`${opening.value.name} ${opening.value.variation ?? ''}`).toContain('Philidor')
  })

  it('sees 16.Qb8+ as a whole queen given up', () => {
    const parsed = parsePgnGame(OPERA_GAME)
    if (!parsed.ok) return
    const queenSacrifice = mainLine(parsed.value)[30]
    expect(queenSacrifice?.san).toBe('Qb8+')
    expect(queenSacrifice).toBeDefined()
    if (queenSacrifice === undefined) return
    const exchange = staticExchangeEvaluation(queenSacrifice.fenBefore, queenSacrifice.uci)
    expect(exchange.ok).toBe(true)
    if (!exchange.ok) return
    expect(exchange.value).toBe(-900)
  })

  it('calls 16.Qb8+ brilliant, because it forces mate', () => {
    const parsed = parsePgnGame(OPERA_GAME)
    if (!parsed.ok) return
    const queenSacrifice = mainLine(parsed.value)[30]
    expect(queenSacrifice).toBeDefined()
    if (queenSacrifice === undefined) return
    const quality = classifyMove({
      mover: 'white',
      // Mate in two before it; Black is mated in one after it.
      scoreBefore: { kind: 'mate', moves: 2 },
      scoreAfter: { kind: 'mate', moves: -1 },
      playedUci: queenSacrifice.uci,
      fenBefore: queenSacrifice.fenBefore,
    })
    expect(quality).toBe('brilliant')
  })

  it('round-trips through the serializer unchanged', () => {
    const parsed = parsePgnGame(OPERA_GAME)
    if (!parsed.ok) return
    const again = parsePgnGame(serializePgn(parsed.value))
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(mainLine(again.value).map((move) => move.san)).toEqual(
      mainLine(parsed.value).map((move) => move.san),
    )
    expect(again.value.headers.White).toBe('Paul Morphy')
  })
})

describe('the Immortal Game', () => {
  it('plays through to mate with White two rooks and a queen down', () => {
    const parsed = parsePgnGame(IMMORTAL_GAME)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const start = createGame()
    if (!start.ok) return
    const played = playMoves(
      start.value,
      mainLine(parsed.value).map((move) => move.san),
    )
    expect(played.ok).toBe(true)
    if (!played.ok) return
    expect(played.value.status).toEqual({ kind: 'checkmate', winner: 'white' })
    // The famous count: at mate White has given up both rooks, a bishop and the queen.
    const balance = materialBalance(played.value.fen)
    expect(balance.leader).toBe('black')
    expect(balance.advantage).toBeGreaterThanOrEqual(15)
  })

  it("is the King's Gambit Accepted", () => {
    const parsed = parsePgnGame(IMMORTAL_GAME)
    if (!parsed.ok) return
    const opening = detectOpeningFromMoves(mainLine(parsed.value).map((move) => move.san))
    expect(opening.ok).toBe(true)
    if (!opening.ok || opening.value === null) throw new Error('no opening was detected')
    expect(opening.value.eco?.startsWith('C3')).toBe(true)
    expect(opening.value.name).toContain("King's Gambit")
  })
})
