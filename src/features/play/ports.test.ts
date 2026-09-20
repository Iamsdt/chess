import { describe, expect, it, vi } from 'vitest'

import { toGameId, toJobId } from '@/domain'
import { jobs } from '@/jobs'

import { defaultAnalysisQueue } from './ports'

/**
 * The queue is S11's and its stub still throws. These tests pin the two things
 * this feature promises regardless of when S11 lands: the review is asked for with
 * a dedupe key, and a queue that is not there yet comes back as a value rather
 * than as an exception that would take the game-over dialog down with it.
 */
describe('the analysis queue port', () => {
  it('turns the not-yet-implemented seam into an error value', async () => {
    const result = await defaultAnalysisQueue.enqueueGameReview(toGameId('game_1'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.where).toBe('play: queue review')
    expect(result.error.code).toBe('io')
  })

  it('asks for one analysis per game, at normal priority', async () => {
    const enqueue = vi.spyOn(jobs, 'enqueue').mockResolvedValue(toJobId('job_1'))

    const result = await defaultAnalysisQueue.enqueueGameReview(toGameId('game_7'))
    expect(result).toEqual({ ok: true, value: toJobId('job_1') })
    expect(enqueue).toHaveBeenCalledWith(
      'analyse-game',
      { gameId: toGameId('game_7') },
      { priority: 'normal', dedupeKey: 'analyse-game:game_7' },
    )
    enqueue.mockRestore()
  })
})
