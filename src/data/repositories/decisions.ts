import {
  DatasetRowSchema,
  domainError,
  err,
  labelsFromProbs,
  now,
  ok,
  parseValid,
  DecisionRecordSchema,
  type DatasetRow,
  type DecisionLabels,
  type DecisionProbs,
  type DecisionRecord,
  type Result,
} from '@/domain'

import { notFound, runWrite } from '../internal'

import type { ChessKingDb } from '../db'

/**
 * The local log of what the on-device decision model decided, and what the user corrected.
 *
 * Why it is a table and not a kv blob: it grows with use, the Settings screen lists it newest
 * first, and the export streams it. Why the text is stored: that is the training example. It
 * never leaves the device unless the user exports it, and it is part of the JSON backup like any
 * other user table.
 */

/** What a caller supplies; the repository derives `labels` and the bookkeeping fields. */
export interface NewDecision {
  readonly id: string
  readonly text: string
  readonly screen: string | null
  readonly modelId: string
  readonly latencyMs: number
  readonly probs: DecisionProbs
}

export interface DecisionCounts {
  readonly total: number
  readonly corrected: number
}

export interface DecisionsRepository {
  get: (id: string) => Promise<DecisionRecord | undefined>
  add: (decision: NewDecision) => Promise<Result<DecisionRecord>>
  /** Newest first. */
  list: (limit?: number) => Promise<DecisionRecord[]>
  /** Merges `labels` into the correction; later corrections of the same key win. */
  correct: (id: string, labels: DecisionLabels) => Promise<Result<DecisionRecord>>
  count: () => Promise<DecisionCounts>
  clear: () => Promise<Result<void>>
  /** The logged rows as training examples, oldest first. */
  exportRows: () => Promise<DatasetRow[]>
}

/** Predicted labels with the user's corrections laid over them. */
export function effectiveLabels(record: DecisionRecord): DecisionLabels {
  return { ...record.labels, ...(record.correction ?? {}) }
}

export function toDatasetRow(record: DecisionRecord): DatasetRow {
  const corrected = record.corrected === 1
  return DatasetRowSchema.parse({
    text: record.text,
    screen: record.screen,
    labels: corrected ? effectiveLabels(record) : record.labels,
    source: corrected ? 'corrected' : 'predicted',
    model_id: record.modelId,
    probs: record.probs,
    created_at: new Date(record.createdAt).toISOString(),
  })
}

export function createDecisionsRepository(db: ChessKingDb): DecisionsRepository {
  return {
    get: (id) => db.decisions.get(id),

    add: async (decision) => {
      const parsed = parseValid(
        DecisionRecordSchema,
        {
          ...decision,
          createdAt: now(),
          labels: labelsFromProbs(decision.probs),
          correction: null,
          corrected: 0,
        },
        'decisions.add',
      )
      if (!parsed.ok) return parsed
      const written = await runWrite('decisions.add', () => db.decisions.put(parsed.value))
      return written.ok ? ok(parsed.value) : written
    },

    list: (limit = 200) => db.decisions.orderBy('createdAt').reverse().limit(limit).toArray(),

    correct: async (id, labels) => {
      const outcome = await runWrite('decisions.correct', () =>
        db.transaction('rw', db.decisions, async (): Promise<Result<DecisionRecord>> => {
          const existing = await db.decisions.get(id)
          if (existing === undefined) return err(notFound('decisions.correct', id))
          const merged = { ...(existing.correction ?? {}), ...labels }
          const parsed = parseValid(
            DecisionRecordSchema,
            { ...existing, correction: merged, corrected: 1 },
            'decisions.correct',
          )
          if (!parsed.ok) {
            return err(
              domainError('validation', 'That correction is not valid', {
                where: 'decisions.correct',
              }),
            )
          }
          await db.decisions.put(parsed.value)
          return ok(parsed.value)
        }),
      )
      return outcome.ok ? outcome.value : outcome
    },

    count: async () => ({
      total: await db.decisions.count(),
      corrected: await db.decisions.where('corrected').equals(1).count(),
    }),

    clear: () => runWrite('decisions.clear', () => db.decisions.clear()),

    exportRows: async () => {
      const records = await db.decisions.orderBy('createdAt').toArray()
      return records.map(toDatasetRow)
    },
  }
}
