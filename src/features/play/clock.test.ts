import { describe, expect, it } from 'vitest'

import { toTimestamp } from '@/domain'
import type { TimeControl } from '@/domain'

import {
  applyMoveToClock,
  createClock,
  flaggedAt,
  formatClock,
  formatTimeControl,
  isLowTime,
  LOW_TIME_MS,
  remainingAt,
  rewindClock,
  startClock,
  stopClock,
} from './clock'

const T0 = toTimestamp(0)
const at = (ms: number) => toTimestamp(ms)
const BLITZ: TimeControl = { kind: 'increment', initialMs: 60_000, incrementMs: 3_000 }

describe('the clock', () => {
  it('does not start itself', () => {
    const clock = createClock(BLITZ, T0)
    expect(clock.runningFor).toBeNull()
    expect(remainingAt(clock, 'white', at(10_000))).toBe(60_000)
  })

  it('counts down only for the side whose clock is running', () => {
    const clock = startClock(createClock(BLITZ, T0), 'white', T0)
    expect(remainingAt(clock, 'white', at(4_000))).toBe(56_000)
    expect(remainingAt(clock, 'black', at(4_000))).toBe(60_000)
  })

  it('charges the mover and pays the increment on the move', () => {
    const clock = applyMoveToClock(
      startClock(createClock(BLITZ, T0), 'white', T0),
      'white',
      at(5_000),
    )
    expect(clock.whiteMs).toBe(58_000)
    expect(clock.runningFor).toBe('black')
    expect(clock.since).toBe(5_000)
  })

  it('flags at zero and never reports a negative figure', () => {
    const clock = startClock(createClock(BLITZ, T0), 'white', T0)
    expect(flaggedAt(clock, at(59_000))).toBeNull()
    expect(flaggedAt(clock, at(60_000))).toBe('white')
    expect(remainingAt(clock, 'white', at(120_000))).toBe(0)
  })

  it('stops where it stood', () => {
    const clock = stopClock(startClock(createClock(BLITZ, T0), 'white', T0), at(7_500))
    expect(clock.runningFor).toBeNull()
    expect(clock.whiteMs).toBe(52_500)
    expect(remainingAt(clock, 'white', at(99_000))).toBe(52_500)
  })

  it('rewinds both clocks to a ply boundary', () => {
    const clock = startClock(createClock(BLITZ, T0), 'black', at(10_000))
    const back = rewindClock(clock, { whiteMs: 40_000, blackMs: 35_000 }, 'white', at(20_000))
    expect(back.whiteMs).toBe(40_000)
    expect(back.blackMs).toBe(35_000)
    expect(back.runningFor).toBe('white')
    expect(remainingAt(back, 'white', at(21_000))).toBe(39_000)
  })

  it('leaves an untimed game alone', () => {
    const untimed = createClock({ kind: 'untimed' }, T0)
    expect(untimed.timed).toBe(false)
    expect(startClock(untimed, 'white', T0).runningFor).toBeNull()
    expect(flaggedAt(untimed, at(10_000_000))).toBeNull()
    expect(isLowTime(untimed, 'white', at(10_000_000))).toBe(false)
  })

  it('warns exactly at the low-time line', () => {
    const clock = startClock(createClock(BLITZ, T0), 'white', T0)
    expect(isLowTime(clock, 'white', at(60_000 - LOW_TIME_MS - 1))).toBe(false)
    expect(isLowTime(clock, 'white', at(60_000 - LOW_TIME_MS))).toBe(true)
  })
})

describe('clock labels', () => {
  it('drops to tenths only once they matter', () => {
    expect(formatClock(612_000)).toBe('10:12')
    expect(formatClock(20_000)).toBe('0:20')
    expect(formatClock(8_400)).toBe('0:08.4')
    expect(formatClock(-5)).toBe('0:00.0')
  })

  it('names a time control the way the setup screen does', () => {
    expect(formatTimeControl({ kind: 'untimed' })).toBe('Untimed')
    expect(formatTimeControl(BLITZ)).toBe('1 + 3')
    expect(formatTimeControl({ kind: 'increment', initialMs: 600_000, incrementMs: 5_000 })).toBe(
      '10 + 5',
    )
    expect(formatTimeControl({ kind: 'correspondence', daysPerMove: 1 })).toBe('1 day/move')
  })
})
