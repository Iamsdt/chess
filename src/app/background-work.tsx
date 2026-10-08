import { useEffect } from 'react'

import { useDailyReminder } from '@/features/habit/reminder-host'

/** How long to wait after launch before the review worker is wired up. */
const START_DELAY_MS = 2_000

/**
 * Starts the background workers once the app has settled.
 *
 * A review that was queued before a reload only runs when something has registered a
 * handler for it, and the person should not have to open the Review screen for that to
 * happen. The worker pulls in the engine and the chess rules, so it is loaded on demand
 * and after the first screen is up: the first download has a budget, and this is not
 * something a first paint needs.
 */
export function BackgroundWork() {
  useDailyReminder()
  useEffect(() => {
    const handle = window.setTimeout(() => {
      void import('@/features/review/review-job')
        .then((module) => {
          module.registerReviewHandler()
        })
        .catch(() => undefined)
      // The stats job is pure aggregation, so it costs no engine; it is still deferred so
      // that a seeded `rebuild-stats` row left from last session runs after first paint.
      void import('@/features/progress/stats-job')
        .then((module) => {
          module.registerStatsHandler()
        })
        .catch(() => undefined)
    }, START_DELAY_MS)
    return () => {
      window.clearTimeout(handle)
    }
  }, [])
  return null
}
