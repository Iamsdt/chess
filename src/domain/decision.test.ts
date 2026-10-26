import { describe, expect, it } from 'vitest'

import { CoachMessageSchema } from './coach'
import {
  CoachDecisionSchema,
  DatasetRowSchema,
  DECISION_QUESTIONS,
  DecisionRecordSchema,
  labelsFromProbs,
} from './decision'
import { makeCoachMessage, makeSettings } from './fixtures'
import { DecisionSettingsSchema, SettingsSchema } from './profile'

describe('decision settings', () => {
  it('defaults to off, no manifest and logging on', () => {
    expect(DecisionSettingsSchema.parse({})).toEqual({ enabled: false, logDecisions: true })
  })

  it('a settings row written before the decision model existed still parses, to the defaults', () => {
    const parsed = SettingsSchema.parse({
      board: {},
      sound: {},
      coach: {},
      play: {},
      updatedAt: 1,
    })
    expect(parsed.decision).toEqual({ enabled: false, logDecisions: true })
  })

  it('keeps an explicit choice and rejects a manifest that is not a URL', () => {
    const settings = makeSettings({
      decision: { enabled: true, logDecisions: false, manifestUrl: 'https://example.com/m.json' },
    })
    expect(SettingsSchema.parse(settings).decision).toEqual(settings.decision)
    expect(DecisionSettingsSchema.safeParse({ manifestUrl: 'not a url' }).success).toBe(false)
  })
})

describe('the question registry', () => {
  it('has the mode question first and six binary questions', () => {
    expect(DECISION_QUESTIONS.map((q) => q.key)).toEqual([
      'mode',
      'needs_engine',
      'wants_solution',
      'needs_board',
      'about_history',
      'off_topic',
      'deep_answer',
    ])
    expect(DECISION_QUESTIONS.filter((q) => q.kind === 'binary')).toHaveLength(6)
  })
})

describe('labelsFromProbs', () => {
  it('takes the argmax mode and thresholds flags at 0.5', () => {
    expect(
      labelsFromProbs({
        mode: { grandmaster: 0.1, planner: 0.7, tutor: 0.2 },
        needs_engine: 0.5,
        off_topic: 0.49,
      }),
    ).toEqual({ mode: 'planner', needs_engine: 1, off_topic: 0 })
  })

  it('leaves unanswered questions out', () => {
    expect(labelsFromProbs({})).toEqual({})
  })
})

describe('records, rows and message decisions', () => {
  it('a record without a correction defaults to uncorrected', () => {
    const record = DecisionRecordSchema.parse({
      id: 'd1',
      createdAt: 5,
      text: 'hi',
      screen: null,
      modelId: 'm',
      latencyMs: 3,
      probs: {},
      labels: {},
    })
    expect(record.corrected).toBe(0)
    expect(record.correction).toBeNull()
  })

  it('the dataset row matches the shared contract', () => {
    const row = {
      text: 'hello',
      screen: 'puzzle',
      labels: { mode: 'tutor', needs_engine: 0 },
      source: 'predicted',
      model_id: 'm',
      probs: { mode: { tutor: 0.9 }, needs_engine: 0.1 },
      created_at: '2026-10-21T12:00:00.000Z',
    }
    expect(DatasetRowSchema.parse(row)).toEqual(row)
    expect(DatasetRowSchema.safeParse({ ...row, source: 'guess' }).success).toBe(false)
  })

  it('a message carries an optional compact decision, and old messages still parse', () => {
    const decision = {
      logId: 'dec_1',
      modelId: 'm',
      latencyMs: 12,
      mode: { label: 'grandmaster', prob: 0.87 },
      flags: { needs_engine: 0.9 },
    }
    expect(CoachDecisionSchema.safeParse(decision).success).toBe(true)
    const message = makeCoachMessage({ decision: CoachDecisionSchema.parse(decision) })
    expect(CoachMessageSchema.parse(message).decision?.mode.label).toBe('grandmaster')
    expect(CoachMessageSchema.parse(makeCoachMessage()).decision).toBeUndefined()
  })
})
