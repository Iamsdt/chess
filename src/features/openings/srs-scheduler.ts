import { buildDueQueue, reviewCard } from '@/features/srs'

import type { Scheduler } from './scheduler'

/**
 * The shared FSRS scheduler (S15), as the drill sees it.
 *
 * Why a thin wrapper: the drill's `Scheduler` port names only the two functions it uses,
 * so S15 can change everything else without touching openings.
 */
export const srsScheduler: Scheduler = {
  reviewCard: (card, grade, now) => reviewCard(card, grade, now),
  buildDueQueue: (cards, now, caps) => buildDueQueue(cards, now, caps),
}
