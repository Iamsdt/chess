import { describe, expect, it } from 'vitest'

import {
  makeMistakeEntry,
  makeSrsCard,
  toMistakeId,
  toPuzzleId,
  toSrsCardId,
  toTimestamp,
} from '@/domain'

import { arrangeRows, buildBank, estimateMinutes, themeLabel } from './bank'

const NOW = new Date(2026, 2, 10, 20, 0, 0)
const DAY = 86_400_000
const daysFromNow = (days: number, hour = 9): ReturnType<typeof toTimestamp> =>
  toTimestamp(new Date(2026, 2, 10 + days, hour, 0, 0).getTime())

function pair(
  id: string,
  card: Parameters<typeof makeSrsCard>[0],
  mistake: Parameters<typeof makeMistakeEntry>[0] = {},
) {
  const mistakeId = toMistakeId(id)
  return {
    mistake: makeMistakeEntry({
      id: mistakeId,
      srsCardId: toSrsCardId(`card-${id}`),
      createdAt: toTimestamp(NOW.getTime() - DAY),
      themes: ['fork'],
      ...mistake,
    }),
    card: makeSrsCard({
      id: toSrsCardId(`card-${id}`),
      subject: { kind: 'mistake', mistakeId },
      ...card,
    }),
  }
}

const fixtures = [
  pair('m1', { state: 'new', reps: 0, due: daysFromNow(-1) }, { themes: ['fork'] }),
  pair('m2', { state: 'learning', reps: 2, due: daysFromNow(0, 8) }, { themes: ['backRankMate'] }),
  pair(
    'm3',
    { state: 'review', reps: 4, due: daysFromNow(1), consecutiveCorrect: 2 },
    { themes: ['fork'] },
  ),
  pair('m4', { state: 'review', reps: 4, due: daysFromNow(3) }, { themes: ['pin'] }),
  pair('m5', { state: 'review', reps: 4, due: daysFromNow(6) }, { themes: ['pin'] }),
  pair(
    'm6',
    {
      state: 'mastered',
      reps: 9,
      due: daysFromNow(30),
      consecutiveCorrect: 3,
      masteredAt: toTimestamp(NOW.getTime() - 2 * DAY),
    },
    { themes: ['endgame'] },
  ),
  pair('m7', { state: 'relearning', reps: 5, due: daysFromNow(0, 22) }, { themes: ['fork'] }),
]

const bank = buildBank(
  fixtures.map((item) => item.mistake),
  fixtures.map((item) => item.card),
  NOW,
)

describe('buildBank', () => {
  it('counts what is due now, split into new and already seen', () => {
    expect(bank.dueCount).toBe(2)
    expect(bank.newDue).toBe(1)
    expect(bank.seenDue).toBe(1)
  })

  it('fills the schedule strip from the cards’ real due dates', () => {
    // Today also holds the learning card due this evening; mastered cards never count.
    expect(bank.strip).toEqual({ today: 3, tomorrow: 1, inThreeDays: 1, thisWeek: 1 })
  })

  it('groups the pipeline, with relearning counted as learning', () => {
    expect(bank.pipeline).toEqual({ new: 1, learning: 2, reviewing: 3, mastered: 1 })
    expect(bank.total).toBe(7)
  })

  it('counts what was mastered in the last week', () => {
    expect(bank.masteredThisWeek).toBe(1)
  })

  it('builds theme chips from the stored themes, largest first', () => {
    expect(bank.chips.map((chip) => `${chip.label}:${String(chip.count)}`)).toEqual([
      'All:7',
      'Fork:3',
      'Pin:2',
      'Back rank mate:1',
      'Endgame:1',
    ])
  })

  it('labels rows in calendar words and caps the streak dots at three', () => {
    const byId = new Map(bank.rows.map((row) => [row.id, row]))
    expect(byId.get(toMistakeId('m1'))?.dueText).toBe('Due today')
    expect(byId.get(toMistakeId('m3'))?.dueText).toBe('Tomorrow')
    expect(byId.get(toMistakeId('m4'))?.dueText).toBe('In 3 days')
    expect(byId.get(toMistakeId('m6'))?.dueText).toBe('Mastered')
    expect(byId.get(toMistakeId('m3'))?.recallStreak).toBe(2)
    expect(byId.get(toMistakeId('m3'))?.stateLabel).toBe('Next tomorrow')
  })

  it('treats a mistake with no card yet as new and due', () => {
    const lone = makeMistakeEntry({
      id: toMistakeId('lone'),
      createdAt: toTimestamp(NOW.getTime() - DAY),
    })
    const result = buildBank([lone], [], NOW)
    expect(result.pipeline.new).toBe(1)
    expect(result.rows[0]?.stateLabel).toBe('New')
  })

  it('ignores cards that belong to other subjects', () => {
    const opening = makeSrsCard({
      id: toSrsCardId('opening'),
      state: 'mastered',
      masteredAt: toTimestamp(NOW.getTime() - DAY),
      subject: { kind: 'puzzle', puzzleId: toPuzzleId('p') },
    })
    expect(buildBank([], [opening], NOW).masteredThisWeek).toBe(0)
  })
})

describe('arrangeRows', () => {
  it('filters by theme', () => {
    expect(arrangeRows(bank.rows, 'pin', 'due')).toHaveLength(2)
    expect(arrangeRows(bank.rows, 'all', 'due')).toHaveLength(7)
  })

  it('orders by due date, newest, or origin without mutating the bank', () => {
    const due = arrangeRows(bank.rows, 'all', 'due').map((row) => row.dueAt)
    expect(due).toEqual([...due].sort((a, b) => a - b))
    const newest = arrangeRows(bank.rows, 'all', 'newest').map((row) => row.mistake.createdAt)
    expect(newest).toEqual([...newest].sort((a, b) => b - a))
    expect(bank.rows).toHaveLength(7)
  })
})

describe('helpers', () => {
  it('turns Lichess theme ids into words', () => {
    expect(themeLabel('backRankMate')).toBe('Back rank mate')
    expect(themeLabel('hanging_piece')).toBe('Hanging piece')
  })

  it('never estimates under a minute', () => {
    expect(estimateMinutes(0)).toBe(1)
    expect(estimateMinutes(8)).toBe(6)
  })
})
