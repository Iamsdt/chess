import { createContext, use } from 'react'

import { domainError, err, ok } from '@/domain'
import type { GameId, JobId, Result } from '@/domain'
import { engine } from '@/engine'
import type { Engine } from '@/engine'
import { jobs } from '@/jobs'

/**
 * The three things the play screens cannot own: the engine, the job queue and
 * randomness.
 *
 * Each is reached through a port with a real default, so the screens work with no
 * wiring at all and a test can replace one of them without replacing the other
 * two. The job queue in particular is still a **stub that throws** — S11 is
 * building it in parallel — so the game-over dialog's "queue the review" path is
 * written against {@link AnalysisQueuePort} and tested with a fake. When S11
 * lands, {@link defaultAnalysisQueue} starts working and nothing else changes.
 */

/** Only the two verbs this feature uses; the rest of `Engine` is not its business. */
export interface EnginePort {
  readonly bestMove: Engine['bestMove']
  readonly analyse: Engine['analyse']
}

export interface AnalysisQueuePort {
  /** Queue the full-game review S13 runs. Returns the job so a caller can watch it. */
  readonly enqueueGameReview: (gameId: GameId) => Promise<Result<JobId>>
}

export interface PlayPorts {
  readonly engine: EnginePort
  readonly queue: AnalysisQueuePort
  /** Injected so "the opponent blundered" is reproducible in a test. */
  readonly random: () => number
}

export const defaultEnginePort: EnginePort = {
  bestMove: (fen, options) => engine.bestMove(fen, options),
  analyse: (fen, options) => engine.analyse(fen, options),
}

/**
 * The real queue, defensively wrapped.
 *
 * `jobs.enqueue` throws today and may fail tomorrow (quota, a closed database).
 * Either way a failed review must not take the game-over dialog down with it: the
 * game is already saved, and the review can be started again from the library.
 */
export const defaultAnalysisQueue: AnalysisQueuePort = {
  enqueueGameReview: async (gameId) => {
    try {
      const id = await jobs.enqueue(
        'analyse-game',
        { gameId },
        { priority: 'normal', dedupeKey: `analyse-game:${gameId}` },
      )
      return ok(id)
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : 'The review could not be queued'
      return err(domainError('io', message, { where: 'play: queue review', cause }))
    }
  },
}

export const defaultPlayPorts: PlayPorts = {
  engine: defaultEnginePort,
  queue: defaultAnalysisQueue,
  random: () => Math.random(),
}

export const PlayPortsContext = createContext<PlayPorts>(defaultPlayPorts)

/** Why a hook rather than direct imports: a component test swaps the engine and the
 *  queue by wrapping the tree, and never by mocking a module. */
export function usePlayPorts(): PlayPorts {
  return use(PlayPortsContext)
}
