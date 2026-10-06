import { describe, expect, it } from 'vitest'

import {
  FIXTURE_NOW,
  makePuzzleAttempt,
  makeStreakState,
  toAttemptId,
  toLocalDate,
  toTimestamp,
} from '@/domain'

import { ratingTrend, todayIn, weekCells } from './today-stats'

const day = toLocalDate
const MIN = 60_000

describe('weekCells', () => {
  // Saturday 19 September 2026; the week runs Mon 14th to Sun 20th.
  const today = day('2026-09-19')

  it('marks practised days, the freeze, a missed day, today and the days to come', () => {
    const ms = new Map([
      [day('2026-09-14'), 10 * MIN],
      [day('2026-09-16'), 5 * MIN],
      [day('2026-09-19'), 6 * MIN],
    ])
    const streak = makeStreakState({ freezeDaysUsed: [day('2026-09-15')] })
    const cells = weekCells(today, ms, streak)
    expect(cells.map((c) => c.kind)).toEqual([
      'done',
      'freeze',
      'done',
      'missed',
      'missed',
      'done',
      'upcoming',
    ])
    expect(cells.map((c) => c.letter).join('')).toBe('MTWTFSS')
  })

  it('keeps today open, with its minutes, until something has been practised', () => {
    const cells = weekCells(today, new Map(), undefined)
    expect(cells[5]).toMatchObject({ kind: 'today', minutes: 0, name: 'Saturday' })
  })

  it('starts the week on Monday even when today is a Monday or a Sunday', () => {
    expect(weekCells(day('2026-09-14'), new Map(), undefined)[0]?.kind).toBe('today')
    expect(weekCells(day('2026-09-20'), new Map(), undefined)[6]?.kind).toBe('today')
  })
})

describe('ratingTrend', () => {
  const now = FIXTURE_NOW
  const attempt = (id: string, daysAgo: number, before: number, after: number) =>
    makePuzzleAttempt({
      id: toAttemptId(id),
      endedAt: toTimestamp(now - daysAgo * 86_400_000),
      ratingBefore: before,
      ratingAfter: after,
    })

  it('has nothing to say without rated attempts', () => {
    expect(ratingTrend([], now)).toEqual({ path: undefined, change: undefined })
  })

  it('reports the change with a single attempt but draws no line', () => {
    expect(ratingTrend([attempt('a', 2, 1400, 1412)], now)).toEqual({ path: undefined, change: 12 })
  })

  it('draws a rising line for a rising rating, inside the box', () => {
    const trend = ratingTrend(
      [attempt('a', 20, 1400, 1410), attempt('b', 10, 1410, 1440), attempt('c', 1, 1440, 1460)],
      now,
    )
    expect(trend.change).toBe(60)
    const ys = [...(trend.path ?? '').matchAll(/,(\d+\.\d)/g)].map((m) => Number(m[1]))
    expect(ys).toHaveLength(3)
    expect(ys[0]).toBeGreaterThan(ys[2] ?? 0) // higher rating = smaller y
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBeLessThanOrEqual(56)
  })

  it('ignores unrated attempts and anything older than thirty days', () => {
    const trend = ratingTrend(
      [
        makePuzzleAttempt({
          id: toAttemptId('u'),
          rated: false,
          endedAt: toTimestamp(now - 86_400_000),
        }),
        attempt('old', 45, 1000, 1100),
      ],
      now,
    )
    expect(trend.change).toBeUndefined()
  })
})

describe('todayIn', () => {
  it('uses the zone it is given, not the browser’s', () => {
    const at = Date.parse('2026-09-19T23:30:00Z')
    expect(todayIn('UTC', at)).toBe('2026-09-19')
    expect(todayIn('Asia/Dhaka', at)).toBe('2026-09-20')
  })
})
