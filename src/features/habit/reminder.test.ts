import { describe, expect, it } from 'vitest'

import { makeStreakState, toLocalDate, toTimestamp } from '@/domain'

import { localMinutesOf, msUntilReminder, reminderText, shouldRemind } from './reminder'

const at = (iso: string) => toTimestamp(Date.parse(iso))
const HOUR = 3_600_000

describe('msUntilReminder', () => {
  it('waits until later today when the time has not come', () => {
    expect(msUntilReminder(at('2026-06-01T18:00:00Z'), 'UTC', '20:00')).toBe(2 * HOUR)
  })

  it('waits until tomorrow when the time has passed, and when it is exactly now', () => {
    expect(msUntilReminder(at('2026-06-01T21:00:00Z'), 'UTC', '20:00')).toBe(23 * HOUR)
    expect(msUntilReminder(at('2026-06-01T20:00:00Z'), 'UTC', '20:00')).toBe(24 * HOUR)
  })

  it('reads the clock where the person is, not where the server is', () => {
    expect(localMinutesOf(at('2026-06-01T18:00:00Z'), 'Asia/Tokyo')).toBe(3 * 60)
    expect(msUntilReminder(at('2026-06-01T18:00:00Z'), 'Asia/Tokyo', '04:00')).toBe(HOUR)
  })

  it('still lands on 20:00 local the night the clocks go forward (a 23-hour day)', () => {
    // 7 March 20:00 in New York, then 8 March 20:00 after the change: 23 hours apart.
    expect(msUntilReminder(at('2026-03-08T01:00:00Z'), 'America/New_York', '20:00')).toBe(23 * HOUR)
    expect(msUntilReminder(at('2026-03-28T19:00:00Z'), 'Europe/Berlin', '20:00')).toBe(23 * HOUR)
  })

  it('still lands on 20:00 local the night the clocks go back (a 25-hour day)', () => {
    expect(msUntilReminder(at('2026-11-01T00:00:00Z'), 'America/New_York', '20:00')).toBe(25 * HOUR)
    expect(msUntilReminder(at('2026-10-24T18:00:00Z'), 'Europe/Berlin', '20:00')).toBe(25 * HOUR)
  })

  it('never answers with a time in the past for a time that does not exist', () => {
    const wait = msUntilReminder(at('2026-03-08T05:00:00Z'), 'America/New_York', '02:30')
    expect(wait).toBeGreaterThan(0)
    expect(wait).toBeLessThanOrEqual(25 * HOUR)
  })

  it('discounts the seconds already into the current minute', () => {
    expect(msUntilReminder(at('2026-06-01T19:59:30Z'), 'UTC', '20:00')).toBe(30_000)
  })
})

describe('shouldRemind', () => {
  const base = {
    enabled: true,
    permission: 'granted' as const,
    at: at('2026-06-01T20:00:00Z'),
    timeZone: 'UTC',
    streak: undefined,
  }

  it('reminds someone who has not practised today', () => {
    expect(shouldRemind(base)).toBe(true)
  })

  it('stays quiet when practice already happened today', () => {
    const streak = makeStreakState({ lastPracticeDay: toLocalDate('2026-06-01') })
    expect(shouldRemind({ ...base, streak })).toBe(false)
  })

  it('stays quiet when disabled or without permission', () => {
    expect(shouldRemind({ ...base, enabled: false })).toBe(false)
    expect(shouldRemind({ ...base, permission: 'denied' })).toBe(false)
    expect(shouldRemind({ ...base, permission: 'unsupported' })).toBe(false)
  })
})

describe('reminderText', () => {
  it('names the streak at stake', () => {
    const streak = makeStreakState({ current: 6, lastPracticeDay: toLocalDate('2026-06-01') })
    expect(reminderText(streak, toLocalDate('2026-06-02'))).toContain('6-day streak')
  })
  it('invites a newcomer', () => {
    expect(reminderText(undefined, toLocalDate('2026-06-02'))).toContain('Five minutes')
  })
  it('does not boast about a streak that has already lapsed', () => {
    const streak = makeStreakState({ current: 6, lastPracticeDay: toLocalDate('2026-05-20') })
    expect(reminderText(streak, toLocalDate('2026-06-02'))).toContain('Five minutes')
  })
})
