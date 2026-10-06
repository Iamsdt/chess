import { z } from 'zod'

import { gamesRepo } from '@/data'
import { domainError, err, type Fen, type GameId, type JobId, type Result } from '@/domain'
import { engine as defaultEngine, type Engine } from '@/engine'
import { jobs as defaultJobs, NonRetryableJobError, type JobHandler, type JobsApi } from '@/jobs'

import { reviewGame, type Evaluator } from './analyse'
import { saveReview } from './review-store'

/**
 * S13 · The background review.
 *
 * A review is a few dozen Stockfish searches, so it runs as a job on the batch lane: it
 * survives a reload, yields to a live game, and shows its progress wherever the game is
 * listed. This file is the only thing that connects the queue to the pure review.
 */

const PayloadSchema = z.object({ gameId: z.string().min(1) })

/** Deep enough to separate a blunder from noise, cheap enough to finish in under a minute. */
const REVIEW_DEPTH = 12
const REVIEW_MULTI_PV = 2

export function reviewDedupeKey(gameId: GameId): string {
  return `analyse-game:${gameId}`
}

export interface ReviewJobDeps {
  readonly engine: Pick<Engine, 'evaluate'>
}

/** Builds the handler. The engine is injected so a test can answer from a table. */
export function createReviewHandler(deps: ReviewJobDeps): JobHandler {
  return async (payload, { signal, report }) => {
    const parsed = PayloadSchema.safeParse(payload)
    if (!parsed.success) {
      throw new NonRetryableJobError('The review job had no game to review', 'bad-payload')
    }
    const gameId = parsed.data.gameId as GameId

    const game = await gamesRepo.getWithMoves(gameId)
    if (game === undefined) {
      // Deleted between queueing and running: there is nothing left to do, and retrying
      // would only fail the same way.
      throw new NonRetryableJobError('That game is no longer in the library', 'not-found')
    }
    if (game.moves.length === 0) {
      await gamesRepo.setReviewState(gameId, 'failed')
      throw new NonRetryableJobError('That game has no moves to review', 'empty')
    }

    await gamesRepo.setReviewState(gameId, 'analysing')

    const evaluate: Evaluator = (fen: Fen) =>
      deps.engine.evaluate(fen, {
        lane: 'batch',
        depth: REVIEW_DEPTH,
        multiPv: REVIEW_MULTI_PV,
        signal,
      })

    const reviewed = await reviewGame(game, evaluate, {
      signal,
      onProgress: (done, total) => {
        report(done / total, `position ${String(done)} of ${String(total)}`)
      },
    })

    if (!reviewed.ok) {
      if (reviewed.error.code === 'cancelled') {
        // Put back where it was, so the library does not show a review that is not running.
        await gamesRepo.setReviewState(gameId, 'queued')
        throw new DOMException('The review was cancelled', 'AbortError')
      }
      await gamesRepo.setReviewState(gameId, 'failed')
      throw new Error(reviewed.error.message)
    }

    const saved = await saveReview(gameId, reviewed.value)
    if (!saved.ok) {
      await gamesRepo.setReviewState(gameId, 'failed')
      throw new Error(saved.error.message)
    }
    report(1, 'done')
  }
}

const registeredOn = new WeakSet<object>()

/** Idempotent: every screen that might enqueue a review can call this without thinking. */
export function registerReviewHandler(
  api: JobsApi = defaultJobs,
  deps: ReviewJobDeps = { engine: defaultEngine },
): void {
  if (registeredOn.has(api)) return
  registeredOn.add(api)
  api.registerHandler('analyse-game', createReviewHandler(deps))
}

/** Queues a review (once per game) and makes sure something will run it. */
export async function startReview(
  gameId: GameId,
  api: JobsApi = defaultJobs,
): Promise<Result<JobId>> {
  try {
    registerReviewHandler(api)
    const id = await api.enqueue(
      'analyse-game',
      { gameId },
      { priority: 'normal', dedupeKey: reviewDedupeKey(gameId) },
    )
    await gamesRepo.setReviewState(gameId, 'queued')
    return { ok: true, value: id }
  } catch (cause: unknown) {
    const message = cause instanceof Error ? cause.message : 'The review could not be queued'
    return err(domainError('io', message, { where: 'review: enqueue', cause }))
  }
}
