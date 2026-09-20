import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import {
  FIXTURE_NOW,
  makeMistakeEntry,
  makeSrsCard,
  toGameId,
  toMistakeId,
  toPuzzleId,
  toSrsCardId,
  toTimestamp,
  type SrsCard,
  type SrsSubject,
} from '@/domain'

import { createDb, type ChessKingDb } from '../db'

import { createMistakesRepository } from './mistakes'
import { createSrsCardsRepository } from './srs-cards'

let counter = 0
let db: ChessKingDb | undefined

afterEach(() => {
  db?.close()
  db = undefined
})

function setup(): {
  cards: ReturnType<typeof createSrsCardsRepository>
  mistakes: ReturnType<typeof createMistakesRepository>
} {
  counter += 1
  db = createDb(`srs-test-${String(counter)}`)
  return { cards: createSrsCardsRepository(db), mistakes: createMistakesRepository(db) }
}

const HOUR = 3_600_000

const card = (
  id: string,
  state: SrsCard['state'],
  dueHoursFromNow: number,
  subject: SrsSubject,
): SrsCard =>
  makeSrsCard({
    id: toSrsCardId(id),
    state,
    subject,
    due: toTimestamp(FIXTURE_NOW + dueHoursFromNow * HOUR),
  })

const mistakeSubject = (id: string): SrsSubject => ({ kind: 'mistake', mistakeId: toMistakeId(id) })
const puzzleSubject = (id: string): SrsSubject => ({ kind: 'puzzle', puzzleId: toPuzzleId(id) })

describe('srs cards repository', () => {
  it('returns only the cards that are due, soonest first', async () => {
    const { cards } = setup()
    await cards.putMany([
      card('c1', 'review', -48, mistakeSubject('m1')),
      card('c2', 'learning', -2, puzzleSubject('p1')),
      card('c3', 'review', 24, mistakeSubject('m2')),
    ])

    const due = await cards.listDue({ at: toTimestamp(FIXTURE_NOW) })
    expect(due.map((row) => row.id)).toEqual(['c1', 'c2'])
    expect(await cards.countDue({ at: toTimestamp(FIXTURE_NOW) })).toBe(2)
  })

  it('leaves mastered cards out of the rotation', async () => {
    const { cards } = setup()
    await cards.putMany([
      card('c1', 'review', -1, mistakeSubject('m1')),
      card('c2', 'mastered', -100, mistakeSubject('m2')),
    ])
    const due = await cards.listDue({ at: toTimestamp(FIXTURE_NOW) })
    expect(due.map((row) => row.id)).toEqual(['c1'])
  })

  it('interleaves by subject when asked for one kind', async () => {
    const { cards } = setup()
    await cards.putMany([
      card('c1', 'review', -3, mistakeSubject('m1')),
      card('c2', 'review', -2, puzzleSubject('p1')),
    ])

    const mistakesOnly = await cards.listDue({ at: toTimestamp(FIXTURE_NOW), kind: 'mistake' })
    expect(mistakesOnly.map((row) => row.id)).toEqual(['c1'])
    const puzzlesOnly = await cards.listDue({ at: toTimestamp(FIXTURE_NOW), kind: 'puzzle' })
    expect(puzzlesOnly.map((row) => row.id)).toEqual(['c2'])
  })

  it('respects the daily cap', async () => {
    const { cards } = setup()
    await cards.putMany([
      card('c1', 'review', -3, mistakeSubject('m1')),
      card('c2', 'review', -2, mistakeSubject('m2')),
      card('c3', 'review', -1, mistakeSubject('m3')),
    ])
    const capped = await cards.listDue({ at: toTimestamp(FIXTURE_NOW), limit: 2 })
    expect(capped.map((row) => row.id)).toEqual(['c1', 'c2'])
  })

  it('answers an empty state list with no cards rather than an error', async () => {
    const { cards } = setup()
    await cards.put(card('c1', 'review', -1, mistakeSubject('m1')))
    expect(await cards.listDue({ states: [] })).toEqual([])
  })

  it('finds an existing card by its subject, per kind', async () => {
    const { cards } = setup()
    await cards.putMany([
      card('c1', 'review', -1, mistakeSubject('m1')),
      card('c2', 'review', -1, puzzleSubject('m1')),
    ])

    expect((await cards.findBySubject(mistakeSubject('m1')))?.id).toBe('c1')
    expect((await cards.findBySubject(puzzleSubject('m1')))?.id).toBe('c2')
    expect(await cards.findBySubject(mistakeSubject('absent'))).toBeUndefined()
  })

  it('counts the pipeline and lists what was mastered in a window', async () => {
    const { cards } = setup()
    await cards.putMany([
      card('c1', 'new', 0, mistakeSubject('m1')),
      card('c2', 'learning', 0, mistakeSubject('m2')),
      {
        ...card('c3', 'mastered', 0, mistakeSubject('m3')),
        masteredAt: toTimestamp(FIXTURE_NOW - HOUR),
      },
    ])

    expect(await cards.countsByState()).toEqual({
      new: 1,
      learning: 1,
      review: 0,
      relearning: 0,
      mastered: 1,
    })
    const mastered = await cards.listMastered(
      toTimestamp(FIXTURE_NOW - 24 * HOUR),
      toTimestamp(FIXTURE_NOW),
    )
    expect(mastered.map((row) => row.id)).toEqual(['c3'])
  })

  it('applies a scheduler patch and refuses an unknown card', async () => {
    const { cards } = setup()
    await cards.put(card('c1', 'learning', -1, mistakeSubject('m1')))

    const updated = await cards.update(toSrsCardId('c1'), { state: 'review', stability: 9.5 })
    expect(updated.ok && updated.value.state).toBe('review')
    expect(updated.ok && updated.value.stability).toBe(9.5)

    const missing = await cards.update(toSrsCardId('nope'), { state: 'review' })
    expect(!missing.ok && missing.error.code).toBe('not-found')
  })

  it('rejects an out-of-range difficulty instead of storing it', async () => {
    const { cards } = setup()
    const invalid = { ...card('c1', 'review', 0, mistakeSubject('m1')), difficulty: 42 }
    const result = await cards.put(invalid)
    expect(result.ok).toBe(false)
    expect(await cards.countDue({ at: toTimestamp(FIXTURE_NOW + HOUR) })).toBe(0)
  })

  it('removes every card for a subject', async () => {
    const { cards } = setup()
    await cards.put(card('c1', 'review', -1, mistakeSubject('m1')))
    const removed = await cards.removeBySubject(mistakeSubject('m1'))
    expect(removed.ok && removed.value).toBe(1)
    expect(await cards.get(toSrsCardId('c1'))).toBeUndefined()
  })
})

describe('mistakes repository', () => {
  const entry = (id: string, daysAgo: number, overrides = {}) =>
    makeMistakeEntry({
      id: toMistakeId(id),
      createdAt: toTimestamp(FIXTURE_NOW - daysAgo * 24 * HOUR),
      updatedAt: toTimestamp(FIXTURE_NOW - daysAgo * 24 * HOUR),
      ...overrides,
    })

  it('lists newest first and filters by source, quality and theme', async () => {
    const { mistakes } = setup()
    await mistakes.addMany([
      entry('m1', 3, { source: 'game-review', quality: 'blunder', themes: ['fork'] }),
      entry('m2', 2, { source: 'puzzle', quality: 'mistake', themes: ['pin', 'fork'] }),
      entry('m3', 1, { source: 'puzzle', quality: 'blunder', themes: ['back-rank'] }),
    ])

    expect((await mistakes.list()).map((row) => row.id)).toEqual(['m3', 'm2', 'm1'])
    expect((await mistakes.list({ source: 'puzzle' })).map((row) => row.id)).toEqual(['m3', 'm2'])
    expect((await mistakes.list({ quality: 'blunder' })).map((row) => row.id)).toEqual(['m3', 'm1'])
    expect((await mistakes.list({ theme: 'fork' })).map((row) => row.id)).toEqual(['m2', 'm1'])
    expect(await mistakes.count({ source: 'puzzle' })).toBe(2)
  })

  it('separates scheduled from unscheduled entries', async () => {
    const { mistakes } = setup()
    // The fixture ships with a card attached, so the unscheduled one drops it.
    const { srsCardId: _attached, ...unscheduled } = entry('m2', 2)
    await mistakes.addMany([entry('m1', 1, { srsCardId: toSrsCardId('c1') }), unscheduled])

    expect((await mistakes.list({ scheduled: true })).map((row) => row.id)).toEqual(['m1'])
    expect((await mistakes.list({ scheduled: false })).map((row) => row.id)).toEqual(['m2'])
    expect((await mistakes.findByCard(toSrsCardId('c1')))?.id).toBe('m1')
  })

  it('links a card onto an entry', async () => {
    const { mistakes } = setup()
    await mistakes.add(entry('m1', 0))
    const linked = await mistakes.attachCard(toMistakeId('m1'), toSrsCardId('c9'))
    expect(linked.ok && linked.value.srsCardId).toBe('c9')
  })

  it('counts themes for the skill radar', async () => {
    const { mistakes } = setup()
    await mistakes.addMany([
      entry('m1', 1, { themes: ['fork', 'pin'] }),
      entry('m2', 2, { themes: ['fork'] }),
    ])
    expect(await mistakes.countsByTheme()).toEqual([
      { theme: 'fork', count: 2 },
      { theme: 'pin', count: 1 },
    ])
  })

  it('drops a reviewed game’s entries with the game', async () => {
    const { mistakes } = setup()
    await mistakes.addMany([
      entry('m1', 1, { gameId: toGameId('g1') }),
      entry('m2', 1, { gameId: toGameId('g2') }),
    ])
    const removed = await mistakes.removeForGame(toGameId('g1'))
    expect(removed.ok && removed.value).toBe(1)
    expect((await mistakes.listForGame(toGameId('g2'))).map((row) => row.id)).toEqual(['m2'])
  })
})
