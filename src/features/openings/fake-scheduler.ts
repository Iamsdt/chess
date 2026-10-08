import { timestampFromDate, type SrsCard } from '@/domain'

import type { Scheduler } from './scheduler'

const DAY_MS = 86_400_000

/**
 * A stand-in scheduler for tests: grades map to fixed intervals.
 *
 * Why not the real one in every test: the drill's contract is "hand the scheduler the
 * card and the grade, store what comes back". A deterministic fake pins that contract
 * without tying these tests to FSRS's numbers, which have their own golden tests.
 */
export function createFakeScheduler(): Scheduler {
  return {
    reviewCard: (card, grade, now): SrsCard => {
      const days = { again: 0, hard: 1, good: 3, easy: 7 }[grade]
      return {
        ...card,
        state: grade === 'again' ? 'relearning' : 'review',
        reps: card.reps + 1,
        lapses: grade === 'again' ? card.lapses + 1 : card.lapses,
        stability: Math.max(card.stability, days),
        scheduledDays: days,
        lastReviewedAt: timestampFromDate(now),
        due: timestampFromDate(new Date(now.getTime() + days * DAY_MS)),
        updatedAt: timestampFromDate(now),
      }
    },
    buildDueQueue: (cards, now, caps) =>
      cards
        .filter((card) => card.state !== 'mastered' && card.due <= now.getTime())
        .sort((a, b) => a.due - b.due)
        .slice(0, caps.dailyNewCap + caps.dailyReviewCap),
  }
}
