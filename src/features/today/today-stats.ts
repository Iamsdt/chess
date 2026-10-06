import {
  localDateOf,
  toTimestamp,
  type LocalDate,
  type PuzzleAttempt,
  type StreakState,
} from '@/domain'

const DAY_MS = 86_400_000
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export type WeekCellKind = 'done' | 'freeze' | 'today' | 'missed' | 'upcoming'

export interface WeekCell {
  readonly letter: string
  readonly name: string
  readonly kind: WeekCellKind
  /** Minutes practised that day, for the ring on today's cell. */
  readonly minutes: number
}

function utcMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`)
}

/**
 * The seven days of the current week, Monday first, as the streak card draws them.
 *
 * Today is its own kind until the day's practice is done, so the card can show progress
 * towards the goal instead of an empty circle.
 */
export function weekCells(
  today: LocalDate,
  practiceMsByDay: ReadonlyMap<LocalDate, number>,
  streak: StreakState | undefined,
): WeekCell[] {
  const weekday = (new Date(utcMs(today)).getUTCDay() + 6) % 7
  const monday = utcMs(today) - weekday * DAY_MS
  const freezes = new Set<string>(streak?.freezeDaysUsed ?? [])

  return LETTERS.map((letter, index) => {
    const day = new Date(monday + index * DAY_MS).toISOString().slice(0, 10) as LocalDate
    const ms = practiceMsByDay.get(day) ?? 0
    const minutes = Math.round(ms / 60_000)
    const base = { letter, name: NAMES[index] ?? letter, minutes }
    if (day > today) return { ...base, kind: 'upcoming' as const }
    if (day === today) return { ...base, kind: ms > 0 ? ('done' as const) : ('today' as const) }
    if (ms > 0) return { ...base, kind: 'done' as const }
    if (freezes.has(day)) return { ...base, kind: 'freeze' as const }
    return { ...base, kind: 'missed' as const }
  })
}

export interface RatingTrend {
  /** SVG path in a 240×56 box, or `undefined` with fewer than two rated attempts. */
  readonly path: string | undefined
  /** Points gained over the window; `undefined` when there is nothing to compare. */
  readonly change: number | undefined
}

const SPARK = { width: 240, height: 56, pad: 6 } as const

/** The last 30 days of rated puzzle attempts as a sparkline and a net change. */
export function ratingTrend(attempts: readonly PuzzleAttempt[], now: number): RatingTrend {
  const from = now - 30 * DAY_MS
  const rated = attempts
    .filter((a) => a.rated && a.endedAt >= from && a.endedAt <= now)
    .sort((a, b) => a.endedAt - b.endedAt)
  const first = rated[0]
  const last = rated.at(-1)
  if (first === undefined || last === undefined) return { path: undefined, change: undefined }
  const change = last.ratingAfter - first.ratingBefore
  if (rated.length < 2) return { path: undefined, change }

  const values = rated.map((a) => a.ratingAfter)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = Math.max(hi - lo, 1)
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * SPARK.width
      const y = SPARK.height - SPARK.pad - ((value - lo) / span) * (SPARK.height - 2 * SPARK.pad)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return { path, change }
}

/** Today's local date, in the user's zone rather than the browser's. */
export function todayIn(timeZone: string, at: number = Date.now()): LocalDate {
  return localDateOf(toTimestamp(at), timeZone)
}
