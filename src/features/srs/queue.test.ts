import { describe, expect, it } from 'vitest'

import { toMistakeId, toPuzzleId, toTimestamp, type SrsCard, type SrsSubject } from '@/domain'

import { newCardFrom } from './cards'
import { reviewCard } from './fsrs'
import { buildDueQueue } from './queue'

const NOW = new Date('2026-03-10T12:00:00Z')
const HOUR = 3_600_000
const DAY = 86_400_000

let counter = 0
function card(overrides: Partial<SrsCard> & { kind?: 'mistake' | 'puzzle' } = {}): SrsCard {
  counter += 1
  const { kind = 'mistake', ...rest } = overrides
  const subject: SrsSubject =
    kind === 'mistake'
      ? { kind, mistakeId: toMistakeId(`m${String(counter)}`) }
      : { kind, puzzleId: toPuzzleId(`p${String(counter)}`) }
  return { ...newCardFrom(subject, new Date(NOW.getTime() - DAY)), ...rest }
}

const due = (hoursAgo: number): SrsCard['due'] => toTimestamp(NOW.getTime() - hoursAgo * HOUR)

describe('buildDueQueue', () => {
  it('leaves out cards that are not due yet and cards that are mastered', () => {
    const queue = buildDueQueue(
      [
        card({ state: 'review', due: due(-5) }),
        card({ state: 'mastered', due: due(5) }),
        card({ state: 'review', due: due(1) }),
      ],
      NOW,
      { dailyNewCap: 5, dailyReviewCap: 5 },
    )
    expect(queue).toHaveLength(1)
  })

  it('asks the most overdue review first', () => {
    const late = card({ state: 'review', due: due(48) })
    const recent = card({ state: 'review', due: due(2) })
    const queue = buildDueQueue([recent, late], NOW, { dailyNewCap: 5, dailyReviewCap: 5 })
    expect(queue.map((item) => item.id)).toEqual([late.id, recent.id])
  })

  it('caps new cards and review cards separately', () => {
    const cards = [
      ...Array.from({ length: 8 }, (_, i) => card({ state: 'review', due: due(10 + i) })),
      ...Array.from({ length: 8 }, () => card({ state: 'new', due: due(1) })),
    ]
    const queue = buildDueQueue(cards, NOW, { dailyNewCap: 3, dailyReviewCap: 5 })
    expect(queue.filter((item) => item.state === 'review')).toHaveLength(5)
    expect(queue.filter((item) => item.state === 'new')).toHaveLength(3)
  })

  it('keeps the oldest reviews when the cap bites', () => {
    const cards = Array.from({ length: 6 }, (_, i) => card({ state: 'review', due: due(i + 1) }))
    const queue = buildDueQueue(cards, NOW, { dailyNewCap: 0, dailyReviewCap: 2 })
    expect(queue.map((item) => item.id)).toEqual([cards[5]?.id, cards[4]?.id])
  })

  it('never caps cards that are mid-learning', () => {
    const cards = Array.from({ length: 4 }, () => card({ state: 'learning', due: due(0) }))
    expect(buildDueQueue(cards, NOW, { dailyNewCap: 0, dailyReviewCap: 0 })).toHaveLength(4)
  })

  it('puts learning first, then reviews, then new cards', () => {
    const fresh = card({ state: 'new', due: due(9) })
    const settled = card({ state: 'review', due: due(1) })
    const learning = card({ state: 'relearning', due: due(0) })
    const queue = buildDueQueue([fresh, settled, learning], NOW, {
      dailyNewCap: 5,
      dailyReviewCap: 5,
    })
    expect(queue.map((item) => item.state)).toEqual(['relearning', 'review', 'new'])
  })

  it('interleaves subjects instead of serving one kind in a block', () => {
    const mistakes = Array.from({ length: 3 }, (_, i) =>
      card({ state: 'review', due: due(30 - i), kind: 'mistake' }),
    )
    const puzzles = Array.from({ length: 3 }, (_, i) =>
      card({ state: 'review', due: due(10 - i), kind: 'puzzle' }),
    )
    const queue = buildDueQueue([...mistakes, ...puzzles], NOW, {
      dailyNewCap: 0,
      dailyReviewCap: 10,
    })
    expect(queue.map((item) => item.subject.kind)).toEqual([
      'mistake',
      'puzzle',
      'mistake',
      'puzzle',
      'mistake',
      'puzzle',
    ])
  })

  it('mixes by a caller-supplied group such as the theme', () => {
    const cards = ['fork', 'fork', 'pin', 'pin'].map((theme, i) => ({
      ...card({ state: 'review', due: due(10 - i) }),
      theme,
    }))
    const themeOf = new Map(cards.map((item) => [item.id, item.theme]))
    const queue = buildDueQueue(cards, NOW, {
      dailyNewCap: 0,
      dailyReviewCap: 10,
      groupOf: (item) => themeOf.get(item.id) ?? '',
    })
    expect(queue.map((item) => themeOf.get(item.id))).toEqual(['fork', 'pin', 'fork', 'pin'])
  })

  it('does not drop or invent cards', () => {
    const cards = Array.from({ length: 30 }, (_, i) =>
      card({
        state: i % 3 === 0 ? 'new' : 'review',
        due: due(i),
        kind: i % 2 ? 'puzzle' : 'mistake',
      }),
    )
    const queue = buildDueQueue(cards, NOW, { dailyNewCap: 100, dailyReviewCap: 100 })
    expect(new Set(queue.map((item) => item.id))).toEqual(new Set(cards.map((item) => item.id)))
  })
})

describe('performance', () => {
  it('schedules 200 cards in under 10 ms', () => {
    const cards = Array.from({ length: 200 }, () =>
      newCardFrom({ kind: 'mistake', mistakeId: toMistakeId(`m${String(counter++)}`) }, NOW),
    )
    // Warm the JIT: the budget is about steady-state cost, not the first call.
    for (const item of cards.slice(0, 20)) reviewCard(item, 'good', NOW)
    const started = performance.now()
    const next = cards.map((item, i) =>
      reviewCard(item, (['again', 'hard', 'good', 'easy'] as const)[i % 4] ?? 'good', NOW),
    )
    buildDueQueue(next, new Date(NOW.getTime() + 30 * DAY), {
      dailyNewCap: 20,
      dailyReviewCap: 200,
    })
    expect(performance.now() - started).toBeLessThan(10)
  })
})
