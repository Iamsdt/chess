/**
 * Words for "when does this come back", shared by the recap and the bank.
 *
 * Calendar days, not 24-hour blocks: a card due at 9 am tomorrow is "Tomorrow" whether it is
 * 8 pm or 8 am now, which is how people count.
 */

const MS_PER_DAY = 86_400_000

/** Whole local calendar days from `now` to `due`; negative once it is overdue. */
export function calendarDaysUntil(due: number, now: Date): number {
  const startOf = (value: Date): number =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  return Math.round((startOf(new Date(due)) - startOf(now)) / MS_PER_DAY)
}

export function dueLabel(due: number, now: Date): string {
  if (due <= now.getTime()) return 'Due today'
  const days = calendarDaysUntil(due, now)
  if (days <= 0) return 'Due today'
  if (days === 1) return 'Tomorrow'
  if (days < 14) return `In ${String(days)} days`
  if (days < 60) return `In ${String(Math.round(days / 7))} weeks`
  return `In ${String(Math.round(days / 30))} months`
}

/** The recap's sentence about the next sighting, e.g. "Back in 3 days." */
export function comesBackLabel(due: number, now: Date): string {
  if (due - now.getTime() < MS_PER_DAY / 2) return 'Back again in a few minutes.'
  const days = calendarDaysUntil(due, now)
  if (days <= 1) return 'Back tomorrow.'
  return `${dueLabel(due, now).replace('In ', 'Back in ')}.`
}
