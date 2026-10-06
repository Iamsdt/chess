import { type LocalDate, type StreakState, type Timestamp } from '@/domain'

/**
 * S24 · The streak, the freeze and today's progress, as pure functions.
 *
 * Why calendar days and not instants: "did you practise today" is a question about the
 * user's own calendar. The caller turns an instant into a `LocalDate` in the profile's
 * time zone, so flying east or the clocks changing cannot break or double-count a day.
 *
 * The rules, in one place:
 * - Any practice on a day keeps the streak; reaching the daily goal is tracked separately.
 * - Missing exactly one day spends the freeze if there is one; the missed day is recorded
 *   so the heatmap can paint it. Missing more, or missing one without a freeze, restarts at 1.
 * - A freeze is earned once a streak reaches `FREEZE_AFTER_DAYS`, and then at most once a
 *   week. There is never more than one in the bank.
 * - A clock that moves backwards never changes the streak: the day is simply not later
 *   than the last one that counted.
 */

const DAY_MS = 86_400_000
const FREEZE_AFTER_DAYS = 3
const FREEZE_EVERY_DAYS = 7
const FREEZE_HISTORY = 120

function utcMs(day: LocalDate): number {
  return Date.parse(`${day}T00:00:00Z`)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS)
}

function shiftDay(day: LocalDate, days: number): LocalDate {
  return new Date(utcMs(day) + days * DAY_MS).toISOString().slice(0, 10) as LocalDate
}

export interface PracticeInput {
  /** The user's local calendar day for this practice. */
  readonly today: LocalDate
  /** Time practised, in milliseconds. Zero only refreshes the day's goal. */
  readonly ms: number
  readonly goalMs: number
  readonly at: Timestamp
}

function freshState(input: PracticeInput): StreakState {
  return {
    current: 0,
    longest: 0,
    lastPracticeDay: null,
    freezesAvailable: 0,
    freezeEarnedOn: null,
    freezeDaysUsed: [],
    today: { day: input.today, practisedMs: 0, goalMs: input.goalMs, pathDone: 0, pathTotal: 0 },
    updatedAt: input.at,
  }
}

/** Records `ms` of practice on `today` and returns the new state; `prev` is never mutated. */
export function advanceStreak(prev: StreakState | undefined, input: PracticeInput): StreakState {
  const base = prev ?? freshState(input)
  const sameDay = base.today.day === input.today
  const today = {
    ...(sameDay ? base.today : { ...base.today, pathDone: 0, pathTotal: 0, practisedMs: 0 }),
    day: input.today,
    goalMs: input.goalMs,
    practisedMs: (sameDay ? base.today.practisedMs : 0) + Math.max(input.ms, 0),
  }

  const last = base.lastPracticeDay
  const gap = last === null ? null : daysBetween(last, input.today)
  // No time practised, the same day again, or a clock that went backwards: nothing to count.
  if (input.ms <= 0 || (gap !== null && gap <= 0)) {
    return { ...base, today, updatedAt: input.at }
  }

  let { current, freezesAvailable } = base
  let freezeDaysUsed = base.freezeDaysUsed
  if (gap === null || gap > 2 || (gap === 2 && freezesAvailable < 1)) {
    current = 1
  } else if (gap === 2) {
    freezesAvailable -= 1
    freezeDaysUsed = [...freezeDaysUsed, shiftDay(input.today, -1)].slice(-FREEZE_HISTORY)
    current += 1
  } else {
    current += 1
  }

  let freezeEarnedOn = base.freezeEarnedOn
  const dueForFreeze =
    freezeEarnedOn === null || daysBetween(freezeEarnedOn, input.today) >= FREEZE_EVERY_DAYS
  if (freezesAvailable < 1 && current >= FREEZE_AFTER_DAYS && dueForFreeze) {
    freezesAvailable = 1
    freezeEarnedOn = input.today
  }

  return {
    current,
    longest: Math.max(base.longest, current),
    lastPracticeDay: input.today,
    freezesAvailable: Math.min(freezesAvailable, 1),
    freezeEarnedOn,
    freezeDaysUsed,
    today,
    updatedAt: input.at,
  }
}

export interface StreakView {
  /** What to show now: a lapsed streak reads 0 even before the next practice rewrites it. */
  readonly current: number
  readonly longest: number
  readonly practisedToday: boolean
  /** Practised yesterday but not yet today: today is what keeps it alive. */
  readonly atRisk: boolean
  readonly freezeAvailable: boolean
  readonly todayMs: number
  readonly goalMs: number | undefined
}

/** How the stored state reads on `today`, which may be days after it was last written. */
export function viewStreak(state: StreakState | undefined, today: LocalDate): StreakView {
  const last = state?.lastPracticeDay ?? null
  if (state === undefined || last === null) {
    return {
      current: 0,
      longest: state?.longest ?? 0,
      practisedToday: false,
      atRisk: false,
      freezeAvailable: false,
      todayMs: 0,
      goalMs: state?.today.goalMs,
    }
  }
  const gap = daysBetween(last, today)
  const alive = gap <= 1 || (gap === 2 && state.freezesAvailable > 0)
  return {
    current: alive ? state.current : 0,
    longest: state.longest,
    practisedToday: gap <= 0,
    atRisk: alive && gap >= 1,
    freezeAvailable: state.freezesAvailable > 0,
    todayMs: state.today.day === today ? state.today.practisedMs : 0,
    goalMs: state.today.goalMs,
  }
}
