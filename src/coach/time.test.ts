import { describe, expect, it } from 'vitest'

import { makeCoachMessage, toTimestamp, type Timestamp } from '@/domain'

import { formatMessageTime, groupMessagesByDay } from './time'

const UTC = 'UTC'
/** 2026-09-19T12:00:00Z, the fixture clock. */
const NOON: Timestamp = toTimestamp(1_789_819_200_000)
const DAY = 86_400_000

function at(offsetMs: number) {
  return makeCoachMessage({ createdAt: toTimestamp(NOON + offsetMs) })
}

describe('groupMessagesByDay', () => {
  it('labels today, yesterday and older days', () => {
    const groups = groupMessagesByDay([at(-2 * DAY), at(-DAY), at(0)], {
      today: NOON,
      timeZone: UTC,
      locale: 'en-GB',
    })
    expect(groups.map((group) => group.label).slice(1)).toEqual(['Yesterday', 'Today'])
    expect(groups[0]?.label).toMatch(/Thu.*17.*Sep/)
  })

  it('keeps messages from the same day in one group', () => {
    const groups = groupMessagesByDay([at(0), at(60_000), at(-DAY)], {
      today: NOON,
      timeZone: UTC,
    })
    expect(groups.map((group) => group.messages.length)).toEqual([2, 1])
  })

  it('lets a seeded thread name its first divider', () => {
    const groups = groupMessagesByDay([at(0)], {
      today: NOON,
      timeZone: UTC,
      firstLabel: 'Adaptive set',
    })
    expect(groups[0]?.label).toBe('Adaptive set')
  })

  it('returns nothing for an empty thread', () => {
    expect(groupMessagesByDay([], { today: NOON, timeZone: UTC })).toEqual([])
  })
})

describe('formatMessageTime', () => {
  it('formats as the prototype does', () => {
    expect(formatMessageTime(NOON, 'en-US')).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/)
  })
})
