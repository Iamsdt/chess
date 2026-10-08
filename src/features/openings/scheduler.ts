import type { SrsCard } from '@/domain'

import type { DrillGrade } from './drill'

/**
 * What the drill needs from the shared SRS scheduler, and no more.
 *
 * Why a port: the drill must be testable with a fake clock-driven scheduler, and the
 * repertoire should not care how FSRS works. The real one is wired in `srs-scheduler.ts`.
 */
export interface DailyCaps {
  readonly dailyNewCap: number
  readonly dailyReviewCap: number
}

export interface Scheduler {
  reviewCard: (card: SrsCard, grade: DrillGrade, now: Date) => SrsCard
  buildDueQueue: (cards: readonly SrsCard[], now: Date, caps: DailyCaps) => SrsCard[]
}

/** Openings share the day with mistakes and puzzles, so their own cap is modest. */
export const OPENING_DAILY_CAPS: DailyCaps = { dailyNewCap: 8, dailyReviewCap: 60 }
