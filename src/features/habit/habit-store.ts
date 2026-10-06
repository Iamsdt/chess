import { KV_KEYS, kvRepo, profileRepo, settingsRepo } from '@/data'
import { localDateOf, now, type Result, type StreakState } from '@/domain'

import { advanceStreak } from './streak'

/** Tail of the write queue: two sessions ending together must not both read the old streak. */
let queue: Promise<unknown> = Promise.resolve()

/**
 * Records finished practice against the streak and today's goal.
 *
 * Every feature that ends a practice session calls this once, with the time that session
 * took, so the habit loop has a single writer and the rules in `advanceStreak` hold no
 * matter which screen the practice came from.
 */
export function recordPractice(ms: number): Promise<Result<StreakState>> {
  const run = queue.then(async () => {
    const [profile, settings, current] = await Promise.all([
      profileRepo.get(),
      settingsRepo.get(),
      kvRepo.get(KV_KEYS.streak),
    ])
    const at = now()
    const timeZone = profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const next = advanceStreak(current, {
      today: localDateOf(at, timeZone),
      ms,
      goalMs: settings.dailyGoalMinutes * 60_000,
      at,
    })
    return kvRepo.set(KV_KEYS.streak, next)
  })
  queue = run.catch(() => undefined)
  return run
}
