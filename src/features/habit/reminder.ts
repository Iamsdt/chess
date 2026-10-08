import {
  localDateOf,
  toTimestamp,
  type ClockTime,
  type LocalDate,
  type StreakState,
  type Timestamp,
} from '@/domain'

import { viewStreak } from './streak'

/**
 * S24 · The optional daily reminder, as pure decisions.
 *
 * Why local and not push: the app has no server and no accounts, so the reminder is a
 * timer inside the page. It fires only while the app is open (or installed and running),
 * which is honest about what a browser can do without a push service.
 */

const MINUTE_MS = 60_000
const DAY_MINUTES = 1_440

/** Minutes past local midnight at `at`, in `timeZone`. */
export function localMinutesOf(at: Timestamp, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at))
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

function minutesOfClock(time: ClockTime): number {
  const [hour = '0', minute = '0'] = time.split(':')
  return Number(hour) * 60 + Number(minute)
}

/** `target - actual` folded into (-12h, 12h], so a correction never jumps a whole day. */
function foldedDifference(target: number, actual: number): number {
  const raw = (((target - actual) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return raw > DAY_MINUTES / 2 ? raw - DAY_MINUTES : raw
}

/**
 * Milliseconds until the next time the local clock reads `time`.
 *
 * Why it is recomputed from the wall clock each time instead of adding 24 hours: a day
 * can be 23 or 25 hours long, and a person who flew east wants 20:00 where they are now.
 * A reminder time that is exactly now means tomorrow, so one cannot fire twice. The
 * candidate instant is checked against the clock in `timeZone` and nudged by the offset
 * change, so the night the clocks move it still lands on 20:00 and not on 19:00 or 21:00.
 */
export function msUntilReminder(at: Timestamp, timeZone: string, time: ClockTime): number {
  const target = minutesOfClock(time)
  let wait = target - localMinutesOf(at, timeZone)
  if (wait <= 0) wait += DAY_MINUTES
  // Seconds into the current minute have already passed.
  const candidate = at - (at % MINUTE_MS) + wait * MINUTE_MS
  const drift = foldedDifference(target, localMinutesOf(toTimestamp(candidate), timeZone))
  const corrected = candidate + drift * MINUTE_MS
  // A target that does not exist that night (02:30 when 02:00 jumps to 03:00) has no
  // exact answer; keep the uncorrected candidate rather than fire in the past.
  return (corrected > at ? corrected : candidate) - at
}

export interface ReminderContext {
  readonly enabled: boolean
  readonly permission: NotificationPermission | 'unsupported'
  readonly streak: StreakState | undefined
  readonly at: Timestamp
  readonly timeZone: string
}

/** Whether a reminder due now should actually be shown. */
export function shouldRemind(context: ReminderContext): boolean {
  if (!context.enabled || context.permission !== 'granted') return false
  const today: LocalDate = localDateOf(context.at, context.timeZone)
  // Practising already today is the whole point, so the nudge stays quiet.
  return context.streak?.lastPracticeDay !== today
}

/**
 * The words of the nudge: the streak at stake when there is one, an invitation when not.
 * A streak that has already lapsed is not "at stake", so it is read as of `today`.
 */
export function reminderText(streak: StreakState | undefined, today: LocalDate): string {
  const alive = viewStreak(streak, today).current
  if (alive > 0) {
    return `Keep your ${String(alive)}-day streak going: a few minutes is enough.`
  }
  return 'Five minutes of chess today? Your path is ready.'
}
