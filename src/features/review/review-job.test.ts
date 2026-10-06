import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearAllData, gamesRepo, mistakesRepo, movesRepo, srsCardsRepo } from '@/data'
import { domainError, err, toGameId, type EngineEval, type Fen, type Result } from '@/domain'
import type { JobsApi } from '@/jobs'

import { GAME_ID, SCHOLARS, gameFrom, scripted } from './review-fixtures'
import {
  createReviewHandler,
  reviewDedupeKey,
  registerReviewHandler,
  startReview,
} from './review-job'

const context = (signal = new AbortController().signal) => ({ signal, report: vi.fn() })

async function seed(youPlay: 'white' | 'black' = 'black') {
  const game = gameFrom(SCHOLARS, youPlay)
  const saved = await gamesRepo.save(game)
  if (!saved.ok) throw new Error(saved.error.message)
  return game
}

function engineFor(
  game: ReturnType<typeof gameFrom>,
  best: Record<number, string> = { 5: 'g8e7' },
) {
  const { evaluate } = scripted(game, best)
  return { evaluate: (fen: Fen) => evaluate(fen) }
}

describe('the review job', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('reviews the game and saves verdicts, accuracy, counts and the mistake with its card', async () => {
    const game = await seed()
    const handler = createReviewHandler({ engine: engineFor(game) })
    const { report, signal } = context()
    await handler({ gameId: GAME_ID }, { signal, report })

    const row = await gamesRepo.get(GAME_ID)
    expect(row).toMatchObject({ reviewState: 'reviewed', mistakeCount: 1 })
    expect(row?.accuracy?.black).toBeLessThan(row?.accuracy?.white ?? 0)
    expect(row?.qualityCounts?.black.blunder).toBe(1)

    const moves = await movesRepo.listForGame(GAME_ID)
    expect(moves.map((m) => m.quality)).toHaveLength(SCHOLARS.length)
    expect(moves[5]).toMatchObject({ quality: 'blunder', bestMoveSan: 'Nge7' })

    const mistakes = await mistakesRepo.listForGame(GAME_ID)
    expect(mistakes).toHaveLength(1)
    const card = await srsCardsRepo.listDue()
    expect(card).toHaveLength(1)
    expect(card[0]).toMatchObject({
      state: 'new',
      subject: { kind: 'mistake', mistakeId: mistakes[0]?.id },
    })
    expect(mistakes[0]?.srsCardId).toBe(card[0]?.id)
  })

  it('reports progress up to done', async () => {
    const game = await seed()
    const { report, signal } = context()
    await createReviewHandler({ engine: engineFor(game) })({ gameId: GAME_ID }, { signal, report })
    expect(report).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringMatching(/^position \d+ of \d+$/),
    )
    expect(report).toHaveBeenLastCalledWith(1, 'done')
  })

  it('shows the game as analysing while it runs', async () => {
    const game = await seed()
    let during: string | undefined
    const evaluate = engineFor(game).evaluate
    const spying = {
      evaluate: async (fen: Fen) => {
        during ??= (await gamesRepo.get(GAME_ID))?.reviewState
        return evaluate(fen)
      },
    }
    await createReviewHandler({ engine: spying })({ gameId: GAME_ID }, context())
    expect(during).toBe('analysing')
  })

  it('replaces an earlier review’s mistakes instead of adding to them', async () => {
    const game = await seed()
    const handler = createReviewHandler({ engine: engineFor(game) })
    await handler({ gameId: GAME_ID }, context())
    await handler({ gameId: GAME_ID }, context())
    expect(await mistakesRepo.listForGame(GAME_ID)).toHaveLength(1)
    expect(await srsCardsRepo.listDue()).toHaveLength(1)
  })

  it('banks nothing for a game the user played cleanly', async () => {
    const game = await seed('white')
    await createReviewHandler({ engine: engineFor(game, {}) })({ gameId: GAME_ID }, context())
    expect(await gamesRepo.get(GAME_ID)).toMatchObject({ reviewState: 'reviewed', mistakeCount: 0 })
    expect(await srsCardsRepo.listDue()).toHaveLength(0)
  })

  it('does not retry a job that can never succeed', async () => {
    const handler = createReviewHandler({
      engine: { evaluate: () => Promise.reject(new Error('unused')) },
    })
    await expect(handler({ gameId: 'nope' }, context())).rejects.toMatchObject({
      name: 'NonRetryableJobError',
      code: 'not-found',
    })
    await expect(handler({ wrong: true }, context())).rejects.toMatchObject({ code: 'bad-payload' })
  })

  it('marks the game failed, and says why, when the engine stops', async () => {
    await seed()
    const failing = {
      evaluate: (): Promise<Result<EngineEval>> =>
        Promise.resolve(err(domainError('engine', 'The engine stopped', { where: 'test' }))),
    }
    await expect(
      createReviewHandler({ engine: failing })({ gameId: GAME_ID }, context()),
    ).rejects.toThrow('The engine stopped')
    expect((await gamesRepo.get(GAME_ID))?.reviewState).toBe('failed')
  })

  it('puts a cancelled review back to queued, so the library does not claim it is running', async () => {
    const game = await seed()
    const controller = new AbortController()
    const evaluate = engineFor(game).evaluate
    const engine = {
      evaluate: async (fen: Fen) => {
        const result = await evaluate(fen)
        controller.abort()
        return result
      },
    }
    const run = createReviewHandler({ engine })({ gameId: GAME_ID }, context(controller.signal))
    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
    expect((await gamesRepo.get(GAME_ID))?.reviewState).toBe('queued')
  })
})

describe('startReview and registerReviewHandler', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  function fakeJobs() {
    const enqueue = vi.fn(() => Promise.resolve('job_1' as never))
    const registerHandler = vi.fn()
    return { api: { enqueue, registerHandler } as unknown as JobsApi, enqueue, registerHandler }
  }

  it('queues one review per game, low-noise, and shows the game as queued', async () => {
    await seed()
    const { api, enqueue, registerHandler } = fakeJobs()
    const result = await startReview(GAME_ID, api)

    expect(result.ok).toBe(true)
    expect(registerHandler).toHaveBeenCalledWith('analyse-game', expect.any(Function))
    expect(enqueue).toHaveBeenCalledWith(
      'analyse-game',
      { gameId: GAME_ID },
      { priority: 'normal', dedupeKey: reviewDedupeKey(GAME_ID) },
    )
    expect((await gamesRepo.get(GAME_ID))?.reviewState).toBe('queued')
  })

  it('registers its handler once per queue, however many screens ask', () => {
    const { api, registerHandler } = fakeJobs()
    registerReviewHandler(api)
    registerReviewHandler(api)
    expect(registerHandler).toHaveBeenCalledTimes(1)
  })

  it('says so when the queue refuses, instead of throwing', async () => {
    await seed()
    const api = {
      registerHandler: vi.fn(),
      enqueue: () => Promise.reject(new Error('quota exceeded')),
    } as unknown as JobsApi
    const result = await startReview(toGameId(GAME_ID), api)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('quota exceeded')
  })
})
