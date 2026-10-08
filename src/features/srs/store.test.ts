import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { kvRepo, mistakesRepo, srsCardsRepo } from '@/data'
import { makeMistakeEntry, makeSrsCard, toMistakeId, toSrsCardId, toTimestamp } from '@/domain'

import { reviewCard } from './fsrs'
import {
  DAILY_NEW_CAP,
  DAILY_REVIEW_CAP,
  loadItemFor,
  loadReviewQueue,
  postponeDue,
  saveReviewedCard,
} from './store'

const NOW = new Date()
const HOUR = 3_600_000

async function seed(id: string, state: 'new' | 'review', dueHours: number): Promise<void> {
  const mistakeId = toMistakeId(id)
  await mistakesRepo.add(makeMistakeEntry({ id: mistakeId, srsCardId: toSrsCardId(`card-${id}`) }))
  await srsCardsRepo.put(
    makeSrsCard({
      id: toSrsCardId(`card-${id}`),
      subject: { kind: 'mistake', mistakeId },
      state,
      reps: state === 'new' ? 0 : 3,
      lastReviewedAt: null,
      due: toTimestamp(NOW.getTime() + dueHours * HOUR),
    }),
  )
}

beforeEach(async () => {
  await mistakesRepo.clear()
  await srsCardsRepo.clear()
  await kvRepo.clear()
})

describe('loadReviewQueue', () => {
  it('pairs each due card with its mistake and leaves out cards not yet due', async () => {
    await seed('a', 'review', -2)
    await seed('b', 'review', 5)
    const items = await loadReviewQueue(NOW)
    expect(items.map((item) => item.mistake.id)).toEqual(['a'])
  })

  it('caps new cards at the daily limit', async () => {
    for (let i = 0; i < DAILY_NEW_CAP + 3; i += 1) await seed(`n${String(i)}`, 'new', -1)
    const items = await loadReviewQueue(NOW)
    expect(items).toHaveLength(DAILY_NEW_CAP)
  })

  it('counts what was already asked today against the caps', async () => {
    for (let i = 0; i < DAILY_REVIEW_CAP + 2; i += 1) await seed(`r${String(i)}`, 'review', -1 - i)
    const [first] = await loadReviewQueue(NOW)
    if (first === undefined) throw new Error('expected a due card')
    await saveReviewedCard(first.card, reviewCard(first.card, 'good', NOW), NOW)
    const left = await loadReviewQueue(NOW)
    // One was just reviewed (and rescheduled), one slot of the day's cap is spent.
    expect(left.length).toBe(DAILY_REVIEW_CAP - 1)
  })
})

describe('saveReviewedCard', () => {
  it('writes the scheduler’s card back', async () => {
    await seed('a', 'review', -1)
    const [item] = await loadReviewQueue(NOW)
    if (item === undefined) throw new Error('expected a due card')
    const after = reviewCard(item.card, 'good', NOW)
    const saved = await saveReviewedCard(item.card, after, NOW)
    expect(saved.ok).toBe(true)
    expect((await srsCardsRepo.get(item.card.id))?.due).toBe(after.due)
  })

  it('takes one slot per card per day, however many times it is seen', async () => {
    await seed('a', 'new', -1)
    const [item] = await loadReviewQueue(NOW)
    if (item === undefined) throw new Error('expected a due card')
    const once = reviewCard(item.card, 'again', NOW)
    await saveReviewedCard(item.card, once, NOW)
    await saveReviewedCard(once, reviewCard(once, 'good', NOW), NOW)
    for (let i = 0; i < DAILY_NEW_CAP; i += 1) await seed(`x${String(i)}`, 'new', -1)
    expect(await loadReviewQueue(NOW)).toHaveLength(DAILY_NEW_CAP - 1)
  })
})

describe('loadItemFor', () => {
  it('returns an existing card as it is', async () => {
    await seed('a', 'review', 40)
    const loaded = await loadItemFor(toMistakeId('a'), NOW)
    expect(loaded.ok && loaded.value?.card.state).toBe('review')
  })

  it('creates and links a card for a mistake that never got one', async () => {
    await mistakesRepo.add(makeMistakeEntry({ id: toMistakeId('bare'), srsCardId: undefined }))
    const loaded = await loadItemFor(toMistakeId('bare'), NOW)
    expect(loaded.ok && loaded.value?.card.state).toBe('new')
    expect((await mistakesRepo.get(toMistakeId('bare')))?.srsCardId).toBeDefined()
  })

  it('reports a missing mistake as nothing, not an error', async () => {
    const loaded = await loadItemFor(toMistakeId('ghost'), NOW)
    expect(loaded.ok && loaded.value).toBeUndefined()
  })
})

describe('postponeDue', () => {
  it('moves every due mistake a day on and leaves the rest alone', async () => {
    await seed('a', 'review', -1)
    await seed('b', 'review', 30)
    await postponeDue(NOW)
    expect(await loadReviewQueue(NOW)).toHaveLength(0)
    const moved = await srsCardsRepo.get(toSrsCardId('card-a'))
    expect(moved === undefined ? 0 : moved.due).toBeGreaterThan(NOW.getTime() + 20 * HOUR)
  })
})
