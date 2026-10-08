import {
  attemptsRepo,
  gamesRepo,
  kvRepo,
  KV_KEYS,
  mistakesRepo,
  profileRepo,
  puzzlesRepo,
  sessionsRepo,
} from '@/data'
import { localDateOf, toTimestamp, type PuzzleId } from '@/domain'
import { jobs as defaultJobs, type JobHandler, type JobsApi } from '@/jobs'

import { buildProgress, type TimeRange } from './progress-stats'
import { STATS_SNAPSHOT_KEY, statsSignature, type StatsSnapshot } from './stats-snapshot'

/**
 * S22 · The `rebuild-stats` job.
 *
 * Growth reads one precomputed row instead of walking the whole history on every visit.
 * Every range is built in one pass over the rows, because the three charts share them.
 */

const RANGES: readonly TimeRange[] = ['30d', '90d', 'all']

/** Why a constant: the screen and the seed enqueue under the same key, so they collapse. */
export const STATS_DEDUPE_KEY = 'rebuild-stats'

/** Aggregates the stored rows into a snapshot. Exported so a test can skip the queue. */
export async function buildStatsSnapshot(nowMs: number = Date.now()): Promise<StatsSnapshot> {
  const now = toTimestamp(nowMs)
  const [profile, streak, attempts, sessions, games, mistakes] = await Promise.all([
    profileRepo.get(),
    kvRepo.get(KV_KEYS.streak),
    attemptsRepo.listByDate(),
    sessionsRepo.listBetween(toTimestamp(0), toTimestamp(Number.MAX_SAFE_INTEGER)),
    gamesRepo.list(),
    mistakesRepo.list(),
  ])
  const ids = [...new Set(attempts.map((attempt) => attempt.puzzleId))] as PuzzleId[]
  const puzzles = await puzzlesRepo.getMany(ids)
  const themeOf = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle.theme]))
  const timeZone = profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  const build = (range: TimeRange) =>
    buildProgress({
      now,
      range,
      timeZone,
      profile,
      streak,
      attempts,
      sessions,
      games,
      mistakes,
      themeOf,
    })

  return {
    version: 1,
    generatedAt: now,
    day: localDateOf(now, timeZone),
    timeZone,
    signature: statsSignature({ attempts, sessions, games, mistakes, profile, streak }),
    models: { '30d': build('30d'), '90d': build('90d'), all: build('all') },
  }
}

/** The queue handler; the payload carries nothing because the job always rebuilds everything. */
export function createStatsHandler(): JobHandler {
  return async (_payload, { signal, report }) => {
    signal.throwIfAborted()
    report(0.1, 'reading your history')
    const snapshot = await buildStatsSnapshot()
    signal.throwIfAborted()
    report(0.9, `${String(RANGES.length)} ranges built`)
    const saved = await kvRepo.set(STATS_SNAPSHOT_KEY, snapshot)
    if (!saved.ok) throw new Error(saved.error.message)
    report(1, 'done')
  }
}

const registeredOn = new WeakSet<object>()

/** Idempotent: the background host and the screen can both call it. */
export function registerStatsHandler(api: JobsApi = defaultJobs): void {
  if (registeredOn.has(api)) return
  registeredOn.add(api)
  api.registerHandler('rebuild-stats', createStatsHandler())
}

/**
 * Queues a rebuild on the low lane. A failure to queue is swallowed on purpose: the screen
 * has a live fallback, so a missing snapshot only costs speed.
 */
export async function requestStatsRebuild(api: JobsApi = defaultJobs): Promise<void> {
  try {
    registerStatsHandler(api)
    await api.enqueue('rebuild-stats', {}, { priority: 'low', dedupeKey: STATS_DEDUPE_KEY })
  } catch {
    // Nothing to do: the next visit will try again.
  }
}
