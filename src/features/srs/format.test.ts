import { describe, expect, it } from 'vitest'

import { calendarDaysUntil, comesBackLabel, dueLabel } from './format'

const NOW = new Date(2026, 2, 10, 20, 0, 0)
const at = (days: number, hour = 9): number => new Date(2026, 2, 10 + days, hour, 0, 0).getTime()

describe('dueLabel', () => {
  it('counts calendar days, so 9 am tomorrow is Tomorrow at 8 pm tonight', () => {
    expect(dueLabel(at(1), NOW)).toBe('Tomorrow')
    expect(calendarDaysUntil(at(1), NOW)).toBe(1)
  })

  it('treats anything already due, or later today, as due today', () => {
    expect(dueLabel(NOW.getTime() - 1, NOW)).toBe('Due today')
    expect(dueLabel(at(0, 23), NOW)).toBe('Due today')
  })

  it('scales from days to weeks to months', () => {
    expect(dueLabel(at(3), NOW)).toBe('In 3 days')
    expect(dueLabel(at(21), NOW)).toBe('In 3 weeks')
    expect(dueLabel(at(90), NOW)).toBe('In 3 months')
  })
})

describe('comesBackLabel', () => {
  it('speaks in minutes for a learning step and in days afterwards', () => {
    expect(comesBackLabel(NOW.getTime() + 600_000, NOW)).toBe('Back again in a few minutes.')
    expect(comesBackLabel(at(1), NOW)).toBe('Back tomorrow.')
    expect(comesBackLabel(at(7), NOW)).toBe('Back in 7 days.')
  })
})
