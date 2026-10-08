import { describe, expect, it } from 'vitest'

import { localDateOf, toTimestamp, type StreakState } from '@/domain'

import { advanceStreak, viewStreak } from './streak'

const GOAL = 15 * 60_000
const MIN = 60_000

/** Practise at an instant, the way `recordPractice` does: instant, then calendar day. */
function practiseAt(prev: StreakState | undefined, iso: string, timeZone: string): StreakState {
  const at = toTimestamp(Date.parse(iso))
  return advanceStreak(prev, { today: localDateOf(at, timeZone), ms: 5 * MIN, goalMs: GOAL, at })
}

describe('streak across the calendar', () => {
  it('counts 23:59 and 00:01 local as two days even though they are two minutes apart', () => {
    const tz = 'Europe/Berlin'
    const first = practiseAt(undefined, '2026-03-10T22:59:00Z', tz)
    const second = practiseAt(first, '2026-03-10T23:01:00Z', tz)
    expect(first.lastPracticeDay).toBe('2026-03-10')
    expect(second.lastPracticeDay).toBe('2026-03-11')
    expect(second.current).toBe(2)
  })

  it('keeps the streak through the night the clocks go forward (a 23-hour day)', () => {
    const tz = 'America/New_York'
    let state = practiseAt(undefined, '2026-03-07T20:00:00-05:00', tz)
    state = practiseAt(state, '2026-03-08T20:00:00-04:00', tz)
    state = practiseAt(state, '2026-03-09T20:00:00-04:00', tz)
    expect(state.current).toBe(3)
  })

  it('does not double-count the night the clocks go back (a 25-hour day)', () => {
    const tz = 'America/New_York'
    let state = practiseAt(undefined, '2026-10-31T20:00:00-04:00', tz)
    state = practiseAt(state, '2026-11-01T00:30:00-04:00', tz)
    state = practiseAt(state, '2026-11-01T23:30:00-05:00', tz)
    expect(state.current).toBe(2)
    expect(state.today.practisedMs).toBe(10 * MIN)
  })

  it('survives flying east: a day that "ends" earlier is still one day', () => {
    let state = practiseAt(undefined, '2026-05-01T09:00:00-07:00', 'America/Los_Angeles')
    state = practiseAt(state, '2026-05-02T09:00:00+01:00', 'Europe/London')
    expect(state.current).toBe(2)
  })

  it('never breaks a streak when a timezone change makes the same instant an earlier day', () => {
    let state = practiseAt(undefined, '2026-05-02T01:00:00Z', 'Asia/Tokyo')
    state = practiseAt(state, '2026-05-02T01:30:00Z', 'Pacific/Honolulu')
    expect(state.current).toBe(1)
    expect(state.lastPracticeDay).toBe('2026-05-02')
  })

  it('reads a long gap as lapsed, and a single missed day as saved only with a freeze', () => {
    const tz = 'UTC'
    let state = practiseAt(undefined, '2026-06-01T10:00:00Z', tz)
    state = practiseAt(state, '2026-06-02T10:00:00Z', tz)
    state = practiseAt(state, '2026-06-03T10:00:00Z', tz)
    expect(state.freezesAvailable).toBe(1)
    expect(
      viewStreak(state, localDateOf(toTimestamp(Date.parse('2026-06-05T10:00:00Z')), tz)).current,
    ).toBe(3)
    expect(
      viewStreak(state, localDateOf(toTimestamp(Date.parse('2026-06-09T10:00:00Z')), tz)).current,
    ).toBe(0)
  })

  it('shrugs off a device clock set a year ahead and then corrected', () => {
    const tz = 'UTC'
    let state = practiseAt(undefined, '2026-06-01T10:00:00Z', tz)
    state = practiseAt(state, '2026-06-02T10:00:00Z', tz)
    const skewed = practiseAt(state, '2027-06-02T10:00:00Z', tz)
    // A wild jump forward restarts at one, which is the honest reading of what was recorded...
    expect(skewed.current).toBe(1)
    // ...and the corrected clock afterwards is "earlier", so it neither extends nor wipes it.
    const corrected = practiseAt(skewed, '2026-06-03T10:00:00Z', tz)
    expect(corrected.current).toBe(1)
    expect(corrected.lastPracticeDay).toBe('2026-06-03')
    expect(corrected.longest).toBe(2)
    // ...and from there the streak grows again instead of waiting a year.
    expect(practiseAt(corrected, '2026-06-04T10:00:00Z', tz).current).toBe(2)
  })

  it('a clock only a few hours behind changes nothing', () => {
    const tz = 'UTC'
    const state = practiseAt(undefined, '2026-06-02T10:00:00Z', tz)
    const earlier = practiseAt(state, '2026-06-02T06:00:00Z', tz)
    expect(earlier.current).toBe(1)
    expect(earlier.lastPracticeDay).toBe('2026-06-02')
  })
})

describe('streak on the real clock-change dates', () => {
  const cases = [
    {
      name: 'US spring forward',
      tz: 'America/New_York',
      eve: '2026-03-07',
      night: '2026-03-08',
      next: '2026-03-09',
      offsets: ['-05:00', '-04:00', '-04:00'],
    },
    {
      name: 'US fall back',
      tz: 'America/New_York',
      eve: '2026-10-31',
      night: '2026-11-01',
      next: '2026-11-02',
      offsets: ['-04:00', '-05:00', '-05:00'],
    },
    {
      name: 'EU spring forward',
      tz: 'Europe/Berlin',
      eve: '2026-03-28',
      night: '2026-03-29',
      next: '2026-03-30',
      offsets: ['+01:00', '+02:00', '+02:00'],
    },
    {
      name: 'EU fall back',
      tz: 'Europe/Berlin',
      eve: '2026-10-24',
      night: '2026-10-25',
      next: '2026-10-26',
      offsets: ['+02:00', '+01:00', '+01:00'],
    },
  ] as const

  it.each(cases)(
    'counts three consecutive days across $name',
    ({ tz, eve, night, next, offsets }) => {
      let state = practiseAt(undefined, `${eve}T20:00:00${offsets[0]}`, tz)
      state = practiseAt(state, `${night}T20:00:00${offsets[1]}`, tz)
      state = practiseAt(state, `${next}T20:00:00${offsets[2]}`, tz)
      expect(state.current).toBe(3)
      expect(state.lastPracticeDay).toBe(next)
    },
  )

  it.each(cases)(
    'reads 23:50 and 00:10 either side of midnight on $name as two days',
    ({ tz, night, next, offsets }) => {
      const first = practiseAt(undefined, `${night}T23:50:00${offsets[1]}`, tz)
      const second = practiseAt(first, `${next}T00:10:00${offsets[2]}`, tz)
      expect(second.current).toBe(2)
      expect(second.today.practisedMs).toBe(5 * MIN)
    },
  )

  it.each(cases)(
    'counts two sessions on $name as one day however long the day was',
    ({ tz, night, offsets }) => {
      const first = practiseAt(undefined, `${night}T08:00:00${offsets[1]}`, tz)
      const second = practiseAt(first, `${night}T20:00:00${offsets[1]}`, tz)
      expect(second.current).toBe(1)
      expect(second.today.practisedMs).toBe(10 * MIN)
    },
  )

  it('keeps a streak alive over the missed clock-change day when a freeze is banked', () => {
    const tz = 'Europe/Berlin'
    let state = practiseAt(undefined, '2026-03-26T12:00:00+01:00', tz)
    state = practiseAt(state, '2026-03-27T12:00:00+01:00', tz)
    state = practiseAt(state, '2026-03-28T12:00:00+01:00', tz)
    expect(state.freezesAvailable).toBe(1)
    // Nothing on 29 March (the 23-hour day), back on the 30th.
    state = practiseAt(state, '2026-03-30T12:00:00+02:00', tz)
    expect(state).toMatchObject({ current: 4, freezesAvailable: 0 })
    expect(state.freezeDaysUsed).toEqual(['2026-03-29'])
  })

  it('loses the streak after two missed days across the same change', () => {
    const tz = 'America/New_York'
    let state = practiseAt(undefined, '2026-03-05T12:00:00-05:00', tz)
    state = practiseAt(state, '2026-03-06T12:00:00-05:00', tz)
    state = practiseAt(state, '2026-03-09T12:00:00-04:00', tz)
    expect(state.current).toBe(1)
    expect(state.longest).toBe(2)
  })
})
