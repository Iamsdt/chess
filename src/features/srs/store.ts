import { z } from 'zod'

import { defineKvKey, kvRepo, mistakesRepo, srsCardsRepo } from '@/data'
import {
  localDateOf,
  LocalDateSchema,
  now as nowTimestamp,
  ok,
  timestampFromDate,
  toTimestamp,
  type MistakeId,
  type Result,
  type SrsCard,
} from '@/domain'

import { newCardFrom } from './cards'
import { buildDueQueue } from './queue'

import type { ReviewItem } from './session'

/**
 * Where review sessions meet storage: loading the day's queue and writing each result.
 *
 * Only mistake cards are queued here. Opening-line cards share the scheduler but have
 * their own drill (S17), so a review of the Mistake Bank never asks about a repertoire.
 */

/** Settled reviews asked per day. With the new-card cap, "never more than 10 a day". */
export const DAILY_REVIEW_CAP = 6

/** New mistakes introduced per day. */
export const DAILY_NEW_CAP = 4

const MS_PER_DAY = 86_400_000

/** How many cards were already asked today, so reopening the screen cannot reset the caps. */
const DailyCountSchema = z.object({
  day: LocalDateSchema,
  newDone: z.number().int().min(0),
  reviewDone: z.number().int().min(0),
})
type DailyCount = z.infer<typeof DailyCountSchema>

const DAILY_KEY = defineKvKey('srs-daily', DailyCountSchema)

function today(at: Date) {
  return localDateOf(timestampFromDate(at), Intl.DateTimeFormat().resolvedOptions().timeZone)
}

async function countsToday(at: Date): Promise<DailyCount> {
  const stored = await kvRepo.get(DAILY_KEY)
  const day = today(at)
  return stored?.day === day ? stored : { day, newDone: 0, reviewDone: 0 }
}

/** The cards to ask now, capped by what today has left, each paired with its mistake. */
export async function loadReviewQueue(at: Date): Promise<ReviewItem[]> {
  const [due, done] = await Promise.all([
    srsCardsRepo.listDue({ at: timestampFromDate(at), kind: 'mistake' }),
    countsToday(at),
  ])
  const queue = buildDueQueue(due, at, {
    dailyNewCap: Math.max(DAILY_NEW_CAP - done.newDone, 0),
    dailyReviewCap: Math.max(DAILY_REVIEW_CAP - done.reviewDone, 0),
  })
  return pair(queue)
}

async function pair(cards: readonly SrsCard[]): Promise<ReviewItem[]> {
  const items: ReviewItem[] = []
  for (const card of cards) {
    if (card.subject.kind !== 'mistake') continue
    const mistake = await mistakesRepo.get(card.subject.mistakeId)
    if (mistake !== undefined) items.push({ card, mistake })
  }
  return items
}

/**
 * One mistake as a session of its own, for "Try it" on a card that is not due yet.
 * Creates the card if the mistake never got one.
 */
export async function loadItemFor(
  mistakeId: MistakeId,
  at: Date,
): Promise<Result<ReviewItem | undefined>> {
  const mistake = await mistakesRepo.get(mistakeId)
  if (mistake === undefined) return ok(undefined)
  const found = await srsCardsRepo.findBySubject({ kind: 'mistake', mistakeId })
  if (found !== undefined) return ok({ card: found, mistake })
  const card = newCardFrom({ kind: 'mistake', mistakeId }, at)
  const stored = await srsCardsRepo.put(card)
  if (!stored.ok) return stored
  const linked = await mistakesRepo.attachCard(mistakeId, card.id)
  if (!linked.ok) return linked
  return ok({ card, mistake: linked.value })
}

/** Writes a reviewed card and counts it against today's caps. */
export async function saveReviewedCard(
  before: SrsCard,
  after: SrsCard,
  at: Date,
): Promise<Result<SrsCard>> {
  const stored = await srsCardsRepo.put(after)
  if (!stored.ok) return stored
  // A card takes one slot a day, on its first review that day: a "new" slot if it had never
  // been seen, a "review" slot otherwise. A second look after a miss is the same card.
  const seenToday =
    before.lastReviewedAt !== null && today(new Date(before.lastReviewedAt)) === today(at)
  if (!seenToday) {
    const done = await countsToday(at)
    const isNew = before.state === 'new'
    await kvRepo.set(DAILY_KEY, {
      ...done,
      newDone: done.newDone + (isNew ? 1 : 0),
      reviewDone: done.reviewDone + (isNew ? 0 : 1),
    })
  }
  return stored
}

/** "Not today": every due mistake waits one more day, and the streak is untouched. */
export async function postponeDue(at: Date): Promise<Result<number>> {
  const due = await srsCardsRepo.listDue({ at: timestampFromDate(at), kind: 'mistake' })
  const tomorrow = toTimestamp(Math.max(at.getTime(), nowTimestamp()) + MS_PER_DAY)
  return srsCardsRepo.putMany(
    due.map((card) => ({ ...card, due: tomorrow, updatedAt: nowTimestamp() })),
  )
}
