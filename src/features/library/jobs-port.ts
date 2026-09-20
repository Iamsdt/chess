import type { GamesRepository } from '@/data'
import { domainError, err, ok, type GameId, type JobId, type Result } from '@/domain'
import { jobs as defaultJobs, type JobsApi } from '@/jobs'

/**
 * "Analyse these games" — enqueued, never run here.
 *
 * §4: features enqueue jobs, they never spawn their own workers. The PGN parser in this
 * folder is the library's own, but a full-game analysis costs Stockfish minutes and has
 * to survive a reload, so it belongs to S11's durable queue.
 *
 * The queue is a *port* rather than a direct call because S11 is still landing: the seam
 * in `@/jobs` throws today, so the UI has to be able to say "background analysis is not
 * available yet" instead of falling over, and the tests have to be able to count
 * enqueues without a queue existing at all.
 */
export interface LibraryJobsPort {
  enqueueAnalysis: (gameId: GameId) => Promise<Result<JobId>>
}

/** Why the dedupe key: analysing one game twice is waste, not parallelism. */
export function analysisDedupeKey(gameId: GameId): string {
  return `analyse-game:${gameId}`
}

/**
 * The real port.
 *
 * Every call is wrapped because the seam throws until S11 replaces it, and a thrown
 * "not implemented" must reach the user as a calm sentence rather than an error boundary.
 */
export function createJobsPort(api: JobsApi = defaultJobs): LibraryJobsPort {
  return {
    async enqueueAnalysis(gameId) {
      try {
        const id = await api.enqueue(
          'analyse-game',
          { gameId },
          { priority: 'low', dedupeKey: analysisDedupeKey(gameId) },
        )
        return ok(id)
      } catch (cause: unknown) {
        return err(
          domainError('unsupported', 'Background analysis is not available yet', {
            where: 'jobs.enqueue',
            cause,
          }),
        )
      }
    },
  }
}

export interface AnalyseReport {
  readonly enqueued: number
  readonly failed: number
  /** The first failure, which is what the toast shows; the rest are the same story. */
  readonly reason?: string
}

export interface AnalyseDeps {
  readonly jobs: LibraryJobsPort
  readonly games: Pick<GamesRepository, 'setReviewState'>
  readonly onProgress?: (done: number, total: number) => void
}

/**
 * Queue a batch of games for review.
 *
 * The row is marked `queued` only after the job is accepted, so a game can never sit in
 * the library claiming to be queued for work that was never enqueued.
 */
export async function analyseGames(
  gameIds: readonly GameId[],
  deps: AnalyseDeps,
): Promise<Result<AnalyseReport>> {
  if (gameIds.length === 0) {
    return err(domainError('validation', 'There are no games to analyse', { where: 'library' }))
  }
  let enqueued = 0
  let failed = 0
  let reason: string | undefined
  for (const [at, gameId] of gameIds.entries()) {
    const queued = await deps.jobs.enqueueAnalysis(gameId)
    if (!queued.ok) {
      failed += 1
      reason ??= queued.error.message
    } else {
      enqueued += 1
      await deps.games.setReviewState(gameId, 'queued')
    }
    deps.onProgress?.(at + 1, gameIds.length)
  }
  return ok({ enqueued, failed, ...(reason === undefined ? {} : { reason }) })
}
