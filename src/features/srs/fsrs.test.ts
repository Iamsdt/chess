import { describe, expect, it } from 'vitest'

import { toMistakeId, type ReviewGrade, type SrsCard } from '@/domain'

import { newCardFrom } from './cards'
import {
  DEFAULT_FSRS_CONFIG,
  DEFAULT_FSRS_PARAMS,
  cardRetrievability,
  forgetStability,
  initialDifficulty,
  initialStability,
  MASTERY_STREAK,
  nextDifficulty,
  nextInterval,
  recallStability,
  retrievability,
  reviewCard,
  shortTermStability,
  type FsrsConfig,
} from './fsrs'

/**
 * Reference vectors.
 *
 * Every expected number below was worked out by hand from the FSRS-6 formulas quoted in
 * `fsrs.ts` with the `WORKED` weights, then rounded to four places; none was read back from
 * the code under test. The working is shown beside each value.
 *
 * `WORKED` is deliberately not the shipped default: this file checks the formulas, and
 * `fsrs-reference.test.ts` checks the shipped defaults against py-fsrs itself.
 */
const WORKED: readonly number[] = [
  0.2172, 1.1771, 3.2602, 16.1507, 7.0114, 0.57, 2.0966, 0.0069, 1.5261, 0.112, 1.0178, 1.849,
  0.1133, 0.3127, 2.2934, 0.2191, 3.0004, 0.7536, 0.3332, 0.1437, 0.2,
]
const WORKED_CONFIG: FsrsConfig = { ...DEFAULT_FSRS_CONFIG, params: WORKED }

const MINUTE = 60_000
const DAY = 86_400_000
const T0 = new Date('2026-01-01T09:00:00Z')

const subject = { kind: 'mistake', mistakeId: toMistakeId('mistake_a') } as const

function after(base: Date, ms: number): Date {
  return new Date(base.getTime() + ms)
}

/** Runs a card through grades at given gaps and returns every step. */
function run(steps: readonly { grade: ReviewGrade; after: number }[]): SrsCard[] {
  let card = newCardFrom(subject, T0)
  let at = T0
  const trail: SrsCard[] = []
  for (const step of steps) {
    at = after(at, step.after)
    card = reviewCard(card, step.grade, at, WORKED_CONFIG)
    trail.push(card)
  }
  return trail
}

describe('parameters', () => {
  it('ships 21 FSRS-6 weights with the published 0.1542 decay', () => {
    expect(DEFAULT_FSRS_PARAMS).toHaveLength(21)
    expect(DEFAULT_FSRS_PARAMS[20]).toBe(0.1542)
  })
})

describe('the forgetting curve', () => {
  it('is 90% when the elapsed time equals the stability', () => {
    // FACTOR = 0.9^(-1/0.2) - 1 = 0.6935, so R(S, S) = (1 + 0.6935)^-0.2 = 0.9.
    expect(retrievability(10, 10, WORKED)).toBeCloseTo(0.9, 10)
  })

  it('gives an interval equal to the stability at 90% retention', () => {
    expect(nextInterval(10, WORKED_CONFIG)).toBe(10)
    expect(nextInterval(3.2602, WORKED_CONFIG)).toBe(3)
  })

  it('reads R = 0.8906 after four days at stability 3.5362', () => {
    // (1 + 0.6935 * 4 / 3.5362)^-0.2 = 1.7845^-0.2 = 0.8906
    expect(retrievability(3.5362, 4, WORKED)).toBeCloseTo(0.8906, 3)
  })
})

describe('first review of a new card', () => {
  it('starts stability at w[grade - 1]', () => {
    expect(initialStability('again', WORKED)).toBe(0.2172)
    expect(initialStability('hard', WORKED)).toBe(1.1771)
    expect(initialStability('good', WORKED)).toBe(3.2602)
    expect(initialStability('easy', WORKED)).toBe(16.1507)
  })

  it('starts difficulty at w4 - e^(w5 (G - 1)) + 1', () => {
    // Good: 7.0114 - e^(0.57 * 2) + 1 = 7.0114 - 3.1268 + 1 = 4.8846
    expect(initialDifficulty('good', WORKED)).toBeCloseTo(4.8846, 3)
    // Easy: 7.0114 - e^(0.57 * 3) + 1 = 7.0114 - 5.5290 + 1 = 2.4824
    expect(initialDifficulty('easy', WORKED)).toBeCloseTo(2.4824, 3)
    // Again: e^0 = 1, so 7.0114 exactly.
    expect(initialDifficulty('again', WORKED)).toBeCloseTo(7.0114, 4)
  })

  it('clamps difficulty into 1..10', () => {
    expect(initialDifficulty('again', [0, 0, 0, 0, 99, 0.57])).toBe(10)
    expect(initialDifficulty('easy', [0, 0, 0, 0, 0, 5])).toBe(1)
  })
})

describe('difficulty drift', () => {
  it('moves toward easier on Easy and harder on Again, damped near the ends', () => {
    // Good from 4.8846: delta 0, so D' = 0.0069 * 2.4824 + 0.9931 * 4.8846 = 4.8681
    expect(nextDifficulty(4.8846, 'good', WORKED)).toBeCloseTo(4.8681, 3)
    // Again from 4.8681: delta = 2.0966 * 2 = 4.1932; damped = 4.8681 + 4.1932 * 5.1319 / 9 = 7.2591;
    // D' = 0.0069 * 2.4824 + 0.9931 * 7.2591 = 7.2261
    expect(nextDifficulty(4.8681, 'again', WORKED)).toBeCloseTo(7.2261, 3)
  })

  it('never leaves 1..10', () => {
    let hard = 5
    for (let i = 0; i < 200; i += 1) hard = nextDifficulty(hard, 'again', WORKED)
    expect(hard).toBeLessThanOrEqual(10)
    let easy = 5
    for (let i = 0; i < 200; i += 1) easy = nextDifficulty(easy, 'easy', WORKED)
    expect(easy).toBeGreaterThanOrEqual(1)
  })
})

describe('stability updates', () => {
  it('same-day Good grows stability by e^(w17 (G - 3 + w18)) * S^-w19', () => {
    // 3.2602 * e^(0.7536 * 0.3332) * 3.2602^-0.1437 = 3.2602 * 1.2853 * 0.8438 = 3.5362
    expect(shortTermStability(3.2602, 'good', WORKED)).toBeCloseTo(3.5362, 3)
  })

  it('a same-day pass (Hard, Good or Easy) never lowers stability; Again does', () => {
    expect(shortTermStability(50, 'hard', WORKED)).toBeGreaterThanOrEqual(50)
    expect(shortTermStability(50, 'good', WORKED)).toBeGreaterThanOrEqual(50)
    expect(shortTermStability(50, 'easy', WORKED)).toBeGreaterThanOrEqual(50)
    expect(shortTermStability(50, 'again', WORKED)).toBeLessThan(50)
  })

  it('recall on a later day follows S (1 + e^w8 (11 - D) S^-w9 (e^(w10 (1 - R)) - 1))', () => {
    const base = { difficulty: 4.8681, stability: 3.5362, retrievability: 0.8906 }
    expect(recallStability({ ...base, grade: 'good' }, WORKED)).toBeCloseTo(13.7321, 2)
    // Hard multiplies the growth term by w15 = 0.2191, Easy by w16 = 3.0004.
    expect(recallStability({ ...base, grade: 'hard' }, WORKED)).toBeCloseTo(5.77, 1)
    expect(recallStability({ ...base, grade: 'easy' }, WORKED)).toBeCloseTo(34.13, 1)
  })

  it('a lapse keeps a fraction of the old stability, and never more than the old', () => {
    // 1.849 * 4.8681^-0.1133 * (4.5362^0.3127 - 1) * e^(2.2934 * 0.1094) = 1.2006
    const lapsed = forgetStability(
      {
        difficulty: 4.8681,
        stability: 3.5362,
        retrievability: 0.8906,
      },
      WORKED,
    )
    expect(lapsed).toBeCloseTo(1.2006, 3)
    expect(lapsed).toBeLessThan(3.5362)
  })
})

describe('sequence: new -> Good -> Good (same day) -> Good after 4 days', () => {
  const trail = run([
    { grade: 'good', after: 0 },
    { grade: 'good', after: 10 * MINUTE },
    { grade: 'good', after: 4 * DAY },
  ])

  it('first Good enters learning step 1, due in 10 minutes', () => {
    const [first] = trail
    expect(first?.state).toBe('learning')
    expect(first?.learningStep).toBe(1)
    expect(first?.stability).toBeCloseTo(3.2602, 4)
    expect(first?.difficulty).toBeCloseTo(4.8846, 3)
    expect(first?.due).toBe(T0.getTime() + 10 * MINUTE)
    expect(first?.reps).toBe(1)
  })

  it('second Good graduates to review with a 4 day interval', () => {
    const second = trail[1]
    expect(second?.state).toBe('review')
    expect(second?.learningStep).toBeNull()
    expect(second?.stability).toBeCloseTo(3.5362, 3)
    expect(second?.difficulty).toBeCloseTo(4.8681, 3)
    // round(3.5362) = 4 days
    expect(second?.scheduledDays).toBe(4)
    expect(second?.due).toBe(T0.getTime() + 10 * MINUTE + 4 * DAY)
  })

  it('a Good recall four days later schedules 14 days and starts the streak', () => {
    const third = trail[2]
    expect(third?.state).toBe('review')
    expect(third?.elapsedDays).toBe(4)
    expect(third?.stability).toBeCloseTo(13.7321, 2)
    expect(third?.scheduledDays).toBe(14)
    // D' = 0.0069 * 2.4824 + 0.9931 * 4.8681 = 4.8516
    expect(third?.difficulty).toBeCloseTo(4.8516, 3)
    expect(third?.consecutiveCorrect).toBe(1)
  })
})

describe('sequence: new -> Easy', () => {
  it('graduates at once with S = 16.1507 and a 16 day interval', () => {
    const [card] = run([{ grade: 'easy', after: 0 }])
    expect(card?.state).toBe('review')
    expect(card?.stability).toBeCloseTo(16.1507, 4)
    expect(card?.difficulty).toBeCloseTo(2.4824, 3)
    expect(card?.scheduledDays).toBe(16)
    // A first success is not a day-scale recall, so no streak yet.
    expect(card?.consecutiveCorrect).toBe(0)
  })
})

describe('sequence: a lapse', () => {
  const trail = run([
    { grade: 'good', after: 0 },
    { grade: 'good', after: 10 * MINUTE },
    { grade: 'again', after: 4 * DAY },
  ])

  it('moves to relearning, counts the lapse and waits ten minutes', () => {
    const lapsed = trail[2]
    expect(lapsed?.state).toBe('relearning')
    expect(lapsed?.lapses).toBe(1)
    expect(lapsed?.learningStep).toBe(0)
    expect(lapsed?.due).toBe(T0.getTime() + 10 * MINUTE + 4 * DAY + 10 * MINUTE)
    expect(lapsed?.consecutiveCorrect).toBe(0)
  })

  it('applies the forget formula and the Again difficulty step', () => {
    const lapsed = trail[2]
    expect(lapsed?.stability).toBeCloseTo(1.2006, 3)
    expect(lapsed?.difficulty).toBeCloseTo(7.2261, 3)
  })

  it('returns to review after a Good in relearning', () => {
    const recovered = reviewCard(
      trail[2]!,
      'good',
      after(new Date(trail[2]?.lastReviewedAt ?? 0), 10 * MINUTE),
      WORKED_CONFIG,
    )
    expect(recovered.state).toBe('review')
    expect(recovered.lapses).toBe(1)
    expect(recovered.scheduledDays).toBeGreaterThanOrEqual(1)
  })
})

describe('learning steps', () => {
  it('Again on a new card waits one minute', () => {
    const [card] = run([{ grade: 'again', after: 0 }])
    expect(card?.state).toBe('learning')
    expect(card?.due).toBe(T0.getTime() + MINUTE)
    expect(card?.stability).toBeCloseTo(0.2172, 4)
  })

  it('Hard on the first step waits the average of the first two steps', () => {
    const [card] = run([{ grade: 'hard', after: 0 }])
    expect(card?.state).toBe('learning')
    expect(card?.due).toBe(T0.getTime() + 5.5 * MINUTE)
  })
})

describe('review intervals', () => {
  it('give each grade its own interval, as py-fsrs does, so Hard < Good < Easy', () => {
    const [seed] = run([{ grade: 'good', after: 0 }])
    const graduated = reviewCard(seed!, 'good', after(T0, 10 * MINUTE), WORKED_CONFIG)
    const at = after(T0, 10 * MINUTE + 4 * DAY)
    const hard = reviewCard(graduated, 'hard', at, WORKED_CONFIG).scheduledDays
    const good = reviewCard(graduated, 'good', at, WORKED_CONFIG).scheduledDays
    const easy = reviewCard(graduated, 'easy', at, WORKED_CONFIG).scheduledDays
    expect(hard).toBeLessThanOrEqual(good)
    expect(good).toBeLessThan(easy)
    expect([hard, good, easy]).toEqual([6, 14, 34])
  })
})

describe('the mastery rule', () => {
  it('promotes after three recalls on three different days', () => {
    let card = reviewCard(newCardFrom(subject, T0), 'easy', T0, WORKED_CONFIG)
    let at = T0
    const states: string[] = []
    for (let i = 0; i < MASTERY_STREAK; i += 1) {
      at = after(at, card.scheduledDays * DAY)
      card = reviewCard(card, 'good', at, WORKED_CONFIG)
      states.push(card.state)
    }
    expect(states).toEqual(['review', 'review', 'mastered'])
    expect(card.consecutiveCorrect).toBe(3)
    expect(card.masteredAt).toBe(at.getTime())
  })

  it('does not count minute-scale steps as recalls', () => {
    const trail = run([
      { grade: 'good', after: 0 },
      { grade: 'good', after: 10 * MINUTE },
    ])
    expect(trail[1]?.consecutiveCorrect).toBe(0)
  })

  it('Hard keeps the streak, Again resets it', () => {
    let card = reviewCard(newCardFrom(subject, T0), 'easy', T0, WORKED_CONFIG)
    let at = after(T0, card.scheduledDays * DAY)
    card = reviewCard(card, 'good', at, WORKED_CONFIG)
    expect(card.consecutiveCorrect).toBe(1)
    at = after(at, card.scheduledDays * DAY)
    card = reviewCard(card, 'hard', at, WORKED_CONFIG)
    expect(card.consecutiveCorrect).toBe(1)
    at = after(at, card.scheduledDays * DAY)
    card = reviewCard(card, 'again', at, WORKED_CONFIG)
    expect(card.consecutiveCorrect).toBe(0)
    expect(card.state).toBe('relearning')
  })

  it('a lapse takes a mastered card back into the rotation', () => {
    const mastered: SrsCard = {
      ...reviewCard(newCardFrom(subject, T0), 'easy', T0, WORKED_CONFIG),
      state: 'mastered',
      consecutiveCorrect: 3,
      masteredAt: T0.getTime() as SrsCard['createdAt'],
    }
    const lapsed = reviewCard(mastered, 'again', after(T0, 20 * DAY), WORKED_CONFIG)
    expect(lapsed.state).toBe('relearning')
    expect(lapsed.masteredAt).toBeNull()
  })
})

describe('purity', () => {
  it('does not modify the card it was given', () => {
    const card = newCardFrom(subject, T0)
    const frozen = structuredClone(card)
    reviewCard(card, 'good', T0, WORKED_CONFIG)
    expect(card).toEqual(frozen)
  })

  it('reports no retrievability for a card never reviewed', () => {
    expect(cardRetrievability(newCardFrom(subject, T0), T0, WORKED)).toBe(0)
  })

  it('reports 0.9 for a reviewed card on its due date', () => {
    const card = reviewCard(newCardFrom(subject, T0), 'easy', T0, WORKED_CONFIG)
    expect(cardRetrievability(card, after(T0, card.stability * DAY), WORKED)).toBeCloseTo(0.9, 2)
  })
})
