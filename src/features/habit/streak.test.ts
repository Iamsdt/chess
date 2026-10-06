import { describe, expect, it } from 'vitest'

import { FIXTURE_NOW, makeStreakState, toLocalDate } from '@/domain'

import { advanceStreak, daysBetween, viewStreak } from './streak'

const day = toLocalDate
const MIN = 60_000
const GOAL = 15 * MIN

function practise(
  prev: ReturnType<typeof makeStreakState> | undefined,
  date: string,
  ms = 5 * MIN,
) {
  return advanceStreak(prev, { today: day(date), ms, goalMs: GOAL, at: FIXTURE_NOW })
}

describe('daysBetween', () => {
  it('counts calendar days, across a month end and a clock change', () => {
    expect(daysBetween(day('2026-01-31'), day('2026-02-01'))).toBe(1)
    expect(daysBetween(day('2026-03-28'), day('2026-03-30'))).toBe(2)
    expect(daysBetween(day('2026-03-30'), day('2026-03-28'))).toBe(-2)
  })
})

describe('advanceStreak', () => {
  it('starts a streak on the first practice and adds today to the goal', () => {
    const state = practise(undefined, '2026-09-10')
    expect(state).toMatchObject({ current: 1, longest: 1, lastPracticeDay: '2026-09-10' })
    expect(state.today).toMatchObject({ day: '2026-09-10', practisedMs: 5 * MIN, goalMs: GOAL })
  })

  it('counts a second session on the same day once, but keeps adding the minutes', () => {
    const state = practise(practise(undefined, '2026-09-10'), '2026-09-10', 7 * MIN)
    expect(state.current).toBe(1)
    expect(state.today.practisedMs).toBe(12 * MIN)
  })

  it('extends on consecutive days and tracks the longest run', () => {
    let state = practise(undefined, '2026-09-10')
    state = practise(state, '2026-09-11')
    state = practise(state, '2026-09-12')
    expect(state).toMatchObject({ current: 3, longest: 3 })
  })

  it('resets today progress when a new day starts', () => {
    const state = practise(practise(undefined, '2026-09-10', 14 * MIN), '2026-09-11', 2 * MIN)
    expect(state.today).toMatchObject({ day: '2026-09-11', practisedMs: 2 * MIN })
  })

  it('earns one freeze at three days and not another until a week later', () => {
    let state = practise(undefined, '2026-09-10')
    state = practise(state, '2026-09-11')
    expect(state.freezesAvailable).toBe(0)
    state = practise(state, '2026-09-12')
    expect(state).toMatchObject({ freezesAvailable: 1, freezeEarnedOn: '2026-09-12' })
    state = practise(state, '2026-09-13')
    expect(state.freezesAvailable).toBe(1)
  })

  it('spends the freeze on a single missed day and keeps the streak going', () => {
    let state = practise(undefined, '2026-09-10')
    state = practise(state, '2026-09-11')
    state = practise(state, '2026-09-12') // freeze earned
    state = practise(state, '2026-09-14') // the 13th was missed
    expect(state).toMatchObject({ current: 4, freezesAvailable: 0 })
    expect(state.freezeDaysUsed).toEqual(['2026-09-13'])
  })

  it('restarts at one when a day is missed and there is no freeze', () => {
    let state = practise(undefined, '2026-09-10')
    state = practise(state, '2026-09-12')
    expect(state).toMatchObject({ current: 1, longest: 1 })
  })

  it('restarts at one after two missed days even with a freeze', () => {
    let state = practise(undefined, '2026-09-10')
    state = practise(state, '2026-09-11')
    state = practise(state, '2026-09-12')
    state = practise(state, '2026-09-15')
    expect(state).toMatchObject({ current: 1, longest: 3, freezesAvailable: 1 })
  })

  it('ignores a clock that goes backwards instead of breaking the streak', () => {
    const before = practise(practise(undefined, '2026-09-10'), '2026-09-11')
    const after = practise(before, '2026-09-09')
    expect(after).toMatchObject({ current: 2, lastPracticeDay: '2026-09-11' })
  })

  it('does not count zero minutes as practice', () => {
    expect(practise(undefined, '2026-09-10', 0)).toMatchObject({
      current: 0,
      lastPracticeDay: null,
    })
  })

  it('does not mutate the state it was given', () => {
    const prev = makeStreakState()
    const copy = structuredClone(prev)
    practise(prev, '2026-09-20')
    expect(prev).toEqual(copy)
  })
})

describe('viewStreak', () => {
  const state = makeStreakState({
    current: 5,
    longest: 9,
    lastPracticeDay: day('2026-09-10'),
    freezesAvailable: 0,
    today: {
      day: day('2026-09-10'),
      practisedMs: 6 * MIN,
      goalMs: GOAL,
      pathDone: 0,
      pathTotal: 0,
    },
  })

  it('reads zero for nobody who has practised', () => {
    expect(viewStreak(undefined, day('2026-09-10')).current).toBe(0)
  })

  it('is alive and done for the day on the day itself', () => {
    expect(viewStreak(state, day('2026-09-10'))).toMatchObject({
      current: 5,
      practisedToday: true,
      atRisk: false,
      todayMs: 6 * MIN,
    })
  })

  it('is at risk the next day, and today progress reads zero', () => {
    expect(viewStreak(state, day('2026-09-11'))).toMatchObject({
      current: 5,
      atRisk: true,
      todayMs: 0,
    })
  })

  it('has lapsed after a gap, even before the next practice rewrites it', () => {
    expect(viewStreak(state, day('2026-09-12')).current).toBe(0)
    expect(viewStreak(state, day('2026-09-12')).longest).toBe(9)
  })

  it('stays alive over one missed day when a freeze is in the bank', () => {
    const banked = { ...state, freezesAvailable: 1 as const }
    expect(viewStreak(banked, day('2026-09-12'))).toMatchObject({
      current: 5,
      freezeAvailable: true,
    })
  })
})
