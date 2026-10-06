import { describe, expect, it, vi } from 'vitest'

import { domainError, err, type EngineEval, type Result } from '@/domain'

import { explainMove, reviewGame, whiteWinSeries, type Evaluator } from './analyse'
import { GAME_ID, SCHOLARS, gameFrom, scripted } from './review-fixtures'

describe('reviewGame', () => {
  const game = gameFrom(SCHOLARS, 'black')

  it('evaluates every position once, the finished one by the rules and not the engine', async () => {
    const { evaluate, asked } = scripted(game, { 5: 'd8e7' })
    const result = await reviewGame(game, evaluate)
    expect(result.ok).toBe(true)
    expect(asked).toHaveLength(SCHOLARS.length) // 7 moves = 8 positions, the mated one is free
  })

  it('names Black’s 3…Nf6 a blunder and says what it cost', async () => {
    const { evaluate } = scripted(game, { 5: 'g8f6' })
    const review = await reviewGame(game, evaluate)
    if (!review.ok) throw new Error(review.error.message)

    const nf6 = review.value.moves[5]
    expect(nf6).toMatchObject({ san: 'Nf6', quality: 'blunder' })
    expect(nf6?.explanation).toMatch(
      /^Nf6 was a blunder\. Your winning chances went from \d+% to \d+%\./,
    )
    expect(nf6?.evalBefore).toBeDefined()
    expect(nf6?.evalAfter).toBeDefined()
  })

  it('stores the engine’s preference only when it differs from the move played', async () => {
    const { evaluate } = scripted(game, { 5: 'g8e7' })
    const review = await reviewGame(game, evaluate)
    if (!review.ok) throw new Error(review.error.message)
    expect(review.value.moves[5]).toMatchObject({ bestMove: 'g8e7', bestMoveSan: 'Nge7' })
    expect(review.value.moves[5]?.explanation).toContain('Nge7 was the engine')
    expect(review.value.moves[4]?.bestMove).toBeUndefined()
  })

  it('puts the user’s own blunder in the bank, ready to be solved, and no one else’s', async () => {
    const { evaluate } = scripted(game, { 5: 'g8e7' })
    const review = await reviewGame(game, evaluate)
    if (!review.ok) throw new Error(review.error.message)
    expect(review.value.mistakes).toHaveLength(1)
    expect(review.value.mistakes[0]).toMatchObject({
      source: 'game-review',
      gameId: GAME_ID,
      ply: 5,
      yourColor: 'black',
      playedSan: 'Nf6',
      bestSan: 'Nge7',
      bestUci: 'g8e7',
      solution: ['g8e7'],
      quality: 'blunder',
      originLabel: 'vs Stockfish 1200',
    })

    // White blundered nothing; the same review for White banks nothing from this game.
    const asWhite = gameFrom(SCHOLARS, 'white')
    const other = await reviewGame(asWhite, scripted(asWhite).evaluate)
    if (!other.ok) throw new Error(other.error.message)
    expect(other.value.mistakes).toEqual([])
  })

  it('skips a blunder it cannot show the answer to', async () => {
    const { evaluate } = scripted(game) // the engine named no best move anywhere
    const review = await reviewGame(game, evaluate)
    if (!review.ok) throw new Error(review.error.message)
    expect(review.value.moves[5]?.quality).toBe('blunder')
    expect(review.value.mistakes).toEqual([])
  })

  it('scores accuracy for both sides, lower for the side that blundered', async () => {
    const review = await reviewGame(game, scripted(game, { 5: 'g8e7' }).evaluate)
    if (!review.ok) throw new Error(review.error.message)
    const accuracy = review.value.accuracy
    expect(accuracy).toBeDefined()
    expect(accuracy?.black).toBeLessThan(accuracy?.white ?? 0)
  })

  it('counts verdicts per side and picks the turning point', async () => {
    const review = await reviewGame(game, scripted(game, { 5: 'g8e7' }).evaluate)
    if (!review.ok) throw new Error(review.error.message)
    expect(review.value.counts.black.blunder).toBe(1)
    expect(review.value.counts.white.blunder).toBe(0)
    expect(review.value.keyMoments).toHaveLength(1)
    expect(review.value.keyMoments[0]).toMatchObject({ ply: 5, san: 'Nf6', quality: 'blunder' })
    expect(review.value.keyMoments[0]?.swing).toBeGreaterThan(15)
  })

  it('reports progress as it goes', async () => {
    const onProgress = vi.fn()
    await reviewGame(game, scripted(game).evaluate, { onProgress })
    expect(onProgress).toHaveBeenCalledTimes(SCHOLARS.length + 1)
    expect(onProgress).toHaveBeenLastCalledWith(SCHOLARS.length + 1, SCHOLARS.length + 1)
  })

  it('stops when told to', async () => {
    const controller = new AbortController()
    const { evaluate } = scripted(game)
    const stopping: Evaluator = async (fen) => {
      const result = await evaluate(fen)
      controller.abort()
      return result
    }
    const result = await reviewGame(game, stopping, { signal: controller.signal })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('cancelled')
  })

  it('passes an engine failure straight back, naming nothing it did not see', async () => {
    const failing: Evaluator = () =>
      Promise.resolve(
        err(domainError('engine', 'The engine stopped', { where: 'test' })) as Result<EngineEval>,
      )
    const result = await reviewGame(game, failing)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('The engine stopped')
  })

  it('refuses a game with no moves', async () => {
    const result = await reviewGame({ ...game, moves: [] }, scripted(game).evaluate)
    expect(result.ok).toBe(false)
  })

  it('leaves out a move that was taken back, as it was never played', async () => {
    const withTakeback = gameFrom(SCHOLARS, 'black', [0])
    const result = await reviewGame(withTakeback, scripted(withTakeback).evaluate)
    // The first move is dropped, so the rest no longer chain from its position: the
    // review evaluates what is left rather than inventing a continuation.
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.moves).toHaveLength(SCHOLARS.length - 1)
  })

  it('does not call a standard opening move a mistake', async () => {
    const review = await reviewGame(game, scripted(game, { 5: 'g8e7' }).evaluate)
    if (!review.ok) throw new Error(review.error.message)
    expect(review.value.moves[0]?.quality).toBe('book')
  })
})

describe('explainMove', () => {
  const base = {
    san: 'Qxf7#' as never,
    bestSan: undefined,
    winBefore: 50,
    winAfter: 50,
    matedAfter: false,
  }

  it('quotes only what the numbers say, and flags a forced mate', () => {
    expect(
      explainMove({
        ...base,
        san: 'Nf6' as never,
        quality: 'mistake',
        winBefore: 62,
        winAfter: 31,
        matedAfter: true,
        bestSan: 'Nge7' as never,
      }),
    ).toBe(
      "Nf6 was a mistake. Your winning chances went from 62% to 31%. It allows a forced mate. Nge7 was the engine's choice.",
    )
  })

  it('has a sentence for every verdict', () => {
    for (const quality of [
      'brilliant',
      'great',
      'best',
      'excellent',
      'good',
      'book',
      'inaccuracy',
      'miss',
    ] as const) {
      expect(explainMove({ ...base, quality }).length).toBeGreaterThan(5)
    }
  })
})

describe('whiteWinSeries', () => {
  it('has one more point than there are moves, rising when White improves', async () => {
    const game = gameFrom(SCHOLARS, 'black')
    const review = await reviewGame(game, scripted(game, { 5: 'g8e7' }).evaluate)
    if (!review.ok) throw new Error(review.error.message)
    const series = whiteWinSeries(review.value.moves)
    expect(series).toHaveLength(SCHOLARS.length + 1)
    expect(series.at(-1)).toBeGreaterThan(series[0] ?? 100)
    expect(series.at(-1)).toBeGreaterThan(95)
  })

  it('is empty before a game has been reviewed', () => {
    expect(whiteWinSeries(gameFrom(SCHOLARS, 'black').moves)).toEqual([])
  })
})
