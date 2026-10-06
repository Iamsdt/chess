import { useEffect } from 'react'

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
  useEffect(() => {
    const handle = window.setTimeout(() => {
      void import('@/features/review/review-job')
        .then((module) => {
          module.registerReviewHandler()
        })
        .catch(() => undefined)
    }, START_DELAY_MS)
    return () => {
      window.clearTimeout(handle)
    }
  }, [])
  return null
}
