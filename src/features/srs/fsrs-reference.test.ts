import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { toMistakeId, type SrsCard } from '@/domain'

import { newCardFrom } from './cards'
import { DEFAULT_FSRS_PARAMS, reviewCard } from './fsrs'
import reference from './fsrs-reference.json'

/**
 * Differential test against py-fsrs, the FSRS reference implementation.
 *
 * The hand-worked vectors in `fsrs.test.ts` can only prove the code matches our reading
 * of the formulas; these prove it matches FSRS itself. Regenerate the JSON with
 * `scripts/fsrs-reference.py` (instructions in its header) when FSRS publishes new defaults.
 */

const GradeSchema = z.enum(['again', 'hard', 'good', 'easy'])

const ReferenceSchema = z.object({
  source: z.string(),
  parameters: z.array(z.number()).length(21),
  scenarios: z.record(
    z.string(),
    z.array(
      z.object({
        grade: GradeSchema,
        minutesAfterPrevious: z.number(),
        state: z.enum(['learning', 'review', 'relearning']),
        step: z.number().nullable(),
        stability: z.number(),
        difficulty: z.number(),
        dueMinutesAfterReview: z.number(),
      }),
    ),
  ),
})

const data = ReferenceSchema.parse(reference)
const MINUTE = 60_000
const START = new Date('2026-01-05T09:00:00Z')
const subject = { kind: 'mistake', mistakeId: toMistakeId('mistake_reference') } as const

/** `mastered` is our addition on top of FSRS; to the reference it is still a review card. */
function fsrsState(card: SrsCard): string {
  return card.state === 'mastered' ? 'review' : card.state
}

describe(`FSRS-6 against ${data.source}`, () => {
  it('ships the reference default parameters', () => {
    expect(DEFAULT_FSRS_PARAMS).toEqual(data.parameters)
  })

  describe.each(Object.entries(data.scenarios))('%s', (_name, steps) => {
    let card = newCardFrom(subject, START)
    let at = START.getTime()
    const actual = steps.map((step) => {
      at += step.minutesAfterPrevious * MINUTE
      card = reviewCard(card, step.grade, new Date(at))
      return { card, at }
    })

    it.each(steps.map((step, index) => [index + 1, step.grade, step, index] as const))(
      'review %i (%s) matches the reference',
      (_n, _grade, expected, index) => {
        const result = actual[index]
        expect(result).toBeDefined()
        if (result === undefined) return
        expect(fsrsState(result.card)).toBe(expected.state)
        expect(result.card.learningStep).toBe(expected.step)
        expect(result.card.stability).toBeCloseTo(expected.stability, 6)
        expect(result.card.difficulty).toBeCloseTo(expected.difficulty, 6)
        expect((result.card.due - result.at) / MINUTE).toBeCloseTo(
          expected.dueMinutesAfterReview,
          3,
        )
      },
    )
  })
})
