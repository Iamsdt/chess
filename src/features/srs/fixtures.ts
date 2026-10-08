import {
  FIXTURE_NOW,
  makeMistakeEntry,
  makePuzzle,
  makeSrsCard,
  toMistakeId,
  toSan,
  toSrsCardId,
  toUci,
  type MistakeEntry,
  type SrsCard,
} from '@/domain'

import type { ReviewItem } from './session'

/**
 * Test fixtures for the review loop.
 *
 * Built on the shared puzzle fixture: Black plays Qf3+ (f6f3), White answers Kg1, Black
 * finishes with Qe2. That is a three-move line with a forced reply in the middle, which is
 * the shape a session has to handle.
 */

const LINE = makePuzzle().solution

export function newCard(id: string, overrides: Partial<SrsCard> = {}): SrsCard {
  return makeSrsCard({
    id: toSrsCardId(id),
    subject: { kind: 'mistake', mistakeId: toMistakeId(`mistake-${id}`) },
    state: 'new',
    due: FIXTURE_NOW,
    lastReviewedAt: null,
    stability: 0,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    learningStep: null,
    consecutiveCorrect: 0,
    masteredAt: null,
    ...overrides,
  })
}

export function lineMistake(id: string, overrides: Partial<MistakeEntry> = {}): MistakeEntry {
  return makeMistakeEntry({
    id: toMistakeId(`mistake-${id}`),
    fen: makePuzzle().fen,
    yourColor: 'black',
    playedSan: toSan('Qe7'),
    playedUci: toUci('f6e7'),
    bestSan: toSan('Qf3+'),
    bestUci: LINE[0] ?? toUci('f6f3'),
    solution: LINE,
    srsCardId: toSrsCardId(id),
    ...overrides,
  })
}

export function lineItem(id: string, overrides: Partial<SrsCard> = {}): ReviewItem {
  return { card: newCard(id, overrides), mistake: lineMistake(id) }
}
