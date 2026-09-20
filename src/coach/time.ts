import {
  localDateOf,
  now as nowTimestamp,
  timestampToDate,
  toTimestamp,
  type Timestamp,
  type CoachMessage,
} from '@/domain'

/**
 * Day dividers and bubble timestamps.
 *
 * Why grouping lives here and not in the thread component: "is this message on a
 * new day?" is a calendar question, not a rendering one, and the answer depends
 * on the user's time zone — which makes it worth testing without a DOM.
 */

/** The prototype's `7:42 PM`. */
export function formatMessageTime(at: Timestamp, locale?: string): string {
  return timestampToDate(at).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

function resolveTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function formatDayLabel(
  at: Timestamp,
  today: Timestamp,
  timeZone: string,
  locale?: string,
): string {
  const day = localDateOf(at, timeZone)
  if (day === localDateOf(today, timeZone)) return 'Today'
  const yesterday = toTimestamp(today - 86_400_000)
  if (day === localDateOf(yesterday, timeZone)) return 'Yesterday'
  return timestampToDate(at).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  })
}

export interface CoachDayGroup {
  /** The `YYYY-MM-DD` the group covers; stable enough to be a React key. */
  readonly key: string
  readonly label: string
  readonly messages: readonly CoachMessage[]
}

export interface GroupMessagesOptions {
  /** Injected in tests so "Today" does not depend on when the suite runs. */
  readonly today?: Timestamp | undefined
  readonly timeZone?: string | undefined
  readonly locale?: string | undefined
  /**
   * Replaces the first divider, so a seeded thread can open with the screen's
   * own label — the prototype's "Adaptive set · 7:54 PM" — instead of "Today".
   */
  readonly firstLabel?: string | undefined
}

/** Split a thread into the runs of messages that share a calendar day. */
export function groupMessagesByDay(
  messages: readonly CoachMessage[],
  options: GroupMessagesOptions = {},
): readonly CoachDayGroup[] {
  const timeZone = options.timeZone ?? resolveTimeZone()
  const today = options.today ?? nowTimestamp()
  const groups: { key: string; label: string; messages: CoachMessage[] }[] = []

  for (const message of messages) {
    const key: string = localDateOf(message.createdAt, timeZone)
    const open = groups.at(-1)
    if (open?.key === key) {
      open.messages.push(message)
      continue
    }
    groups.push({
      key,
      label: formatDayLabel(message.createdAt, today, timeZone, options.locale),
      messages: [message],
    })
  }

  const first = groups[0]
  if (first !== undefined && options.firstLabel !== undefined) {
    groups[0] = { ...first, label: options.firstLabel }
  }
  return groups
}
