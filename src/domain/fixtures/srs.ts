import { toGameId, toMistakeId, toSrsCardId } from '../ids'
import { toFen, toSan, toTimestamp, toUci } from '../primitives'

import { FIXTURE_NOW, withOverrides } from './base'

import type { MistakeEntry, ReviewOutcome, SrsCard } from '../srs'

const DAY_MS = 86_400_000

/** The Italian position where Ng5 hangs material — the bank's worked example. */
const MISTAKE_FEN = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7'

export function makeSrsCard(overrides?: Partial<SrsCard>): SrsCard {
  return withOverrides<SrsCard>(
    {
      id: toSrsCardId('card-fixture-1'),
      subject: { kind: 'mistake', mistakeId: toMistakeId('mistake-fixture-1') },
      state: 'learning',
      due: toTimestamp(FIXTURE_NOW + DAY_MS),
      lastReviewedAt: FIXTURE_NOW,
      stability: 3.2,
      difficulty: 5.4,
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      learningStep: 0,
      consecutiveCorrect: 1,
      masteredAt: null,
      createdAt: FIXTURE_NOW,
      updatedAt: FIXTURE_NOW,
    },
    overrides,
  )
}

export function makeReviewOutcome(overrides?: Partial<ReviewOutcome>): ReviewOutcome {
  return withOverrides<ReviewOutcome>(
    {
      cardId: toSrsCardId('card-fixture-1'),
      reviewedAt: FIXTURE_NOW,
      grade: 'good',
      correct: true,
      durationMs: 14_500,
      stateBefore: 'learning',
      stateAfter: 'review',
      stabilityBefore: 3.2,
      stabilityAfter: 7.9,
      difficultyBefore: 5.4,
      difficultyAfter: 5.2,
      dueBefore: FIXTURE_NOW,
      dueAfter: toTimestamp(FIXTURE_NOW + 7 * DAY_MS),
      scheduledDays: 7,
    },
    overrides,
  )
}

export function makeMistakeEntry(overrides?: Partial<MistakeEntry>): MistakeEntry {
  return withOverrides<MistakeEntry>(
    {
      id: toMistakeId('mistake-fixture-1'),
      createdAt: FIXTURE_NOW,
      updatedAt: FIXTURE_NOW,
      source: 'game-review',
      gameId: toGameId('game-fixture-1'),
      ply: 12,
      moveNumber: 7,
      fen: toFen(MISTAKE_FEN),
      yourColor: 'white',
      playedSan: toSan('Ng5'),
      playedUci: toUci('f3g5'),
      bestSan: toSan('Nbd2'),
      bestUci: toUci('b1d2'),
      solution: [toUci('b1d2')],
      quality: 'mistake',
      evalBefore: { kind: 'cp', value: 30 },
      evalAfter: { kind: 'cp', value: -140 },
      themes: ['hanging-piece', 'knight'],
      explanation: 'The knight had nothing to do on g5, and Black simply took it.',
      originLabel: 'vs Stockfish 1200',
      srsCardId: toSrsCardId('card-fixture-1'),
    },
    overrides,
  )
}
