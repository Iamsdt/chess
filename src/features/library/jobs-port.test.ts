import { describe, expect, it, vi } from 'vitest'

import type { GamesRepository } from '@/data'
import { toGameId, toJobId } from '@/domain'
import type { JobsApi } from '@/jobs'

import { analyseGames, analysisDedupeKey, createJobsPort } from './jobs-port'

/**
 * The queue seam, mocked.
 *
 * S11 owns the queue; what this sprint owes is that it enqueues one job per game with a
 * dedupe key, marks the row only once the job was accepted, and survives a queue that is
 * not there yet — which is exactly the state `@/jobs` was in when this was written.
 */

const ids = [toGameId('game-1'), toGameId('game-2')] as const

function fakeApi(enqueue: JobsApi['enqueue']): JobsApi {
  return {
    enqueue,
    observe: () => () => undefined,
    cancel: () => Promise.resolve(),
    registerHandler: () => undefined,
    list: () => Promise.resolve([]),
  }
}

function fakeGames(): Pick<GamesRepository, 'setReviewState'> & { readonly marked: string[] } {
  const marked: string[] = []
  return {
    marked,
    setReviewState: (id, state) => {
      marked.push(`${id}:${state}`)
      return Promise.resolve({ ok: true, value: {} }) as ReturnType<
        GamesRepository['setReviewState']
      >
    },
  }
}

describe('queueing analysis', () => {
  it('enqueues one deduped job per game and marks the rows', async () => {
    const enqueue = vi.fn(() => Promise.resolve(toJobId('job-1')))
    const games = fakeGames()
    const report = await analyseGames(ids, { jobs: createJobsPort(fakeApi(enqueue)), games })

    expect(report.ok).toBe(true)
    if (!report.ok) return
    expect(report.value.enqueued).toBe(2)
    expect(enqueue).toHaveBeenCalledWith(
      'analyse-game',
      { gameId: ids[0] },
      { priority: 'low', dedupeKey: analysisDedupeKey(ids[0]) },
    )
    expect(games.marked).toEqual(['game-1:queued', 'game-2:queued'])
  })

  it('survives a queue that is not implemented yet', async () => {
    const games = fakeGames()
    const throwing = fakeApi(() => {
      throw new Error('S11 has not replaced the job queue seam yet.')
    })
    const report = await analyseGames(ids, { jobs: createJobsPort(throwing), games })

    expect(report.ok).toBe(true)
    if (!report.ok) return
    expect(report.value.enqueued).toBe(0)
    expect(report.value.failed).toBe(2)
    expect(report.value.reason).toContain('not available')
    expect(games.marked).toEqual([])
  })

  it('refuses an empty batch rather than pretending it worked', async () => {
    const report = await analyseGames([], {
      jobs: createJobsPort(fakeApi(() => Promise.resolve(toJobId('job-1')))),
      games: fakeGames(),
    })
    expect(report.ok).toBe(false)
  })

  it('counts every game as it goes', async () => {
    const seen: number[] = []
    await analyseGames(ids, {
      jobs: createJobsPort(fakeApi(() => Promise.resolve(toJobId('job-1')))),
      games: fakeGames(),
      onProgress: (done, total) => {
        seen.push(done / total)
      },
    })
    expect(seen).toEqual([0.5, 1])
  })
})
