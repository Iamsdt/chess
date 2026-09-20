import {
  PuzzleAttemptSchema,
  type Result,
  type AttemptId,
  type PuzzleAttempt,
  type PuzzleId,
  type SessionId,
  type SessionKind,
  type Timestamp,
} from '@/domain'

import { runWrite, validateMany, writeValidated } from '../internal'

import type { ChessKingDb } from '../db'

/**
 * Puzzle attempts: the rating history, the "have I seen this before" check and
 * the per-theme mastery numbers all read this table.
 */

export interface AttemptRange {
  from?: Timestamp | undefined
  to?: Timestamp | undefined
  limit?: number | undefined
}

const MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER

export interface AttemptsRepository {
  get: (id: AttemptId) => Promise<PuzzleAttempt | undefined>
  /** Every attempt at one puzzle, oldest first. */
  listForPuzzle: (puzzleId: PuzzleId) => Promise<PuzzleAttempt[]>
  listForSession: (sessionId: SessionId) => Promise<PuzzleAttempt[]>
  /** The S22 rating chart: attempts in a window, oldest first. */
  listByDate: (range?: AttemptRange) => Promise<PuzzleAttempt[]>
  listByMode: (mode: SessionKind, range?: AttemptRange) => Promise<PuzzleAttempt[]>
  /** Newest first — the Today screen's "you solved N today". */
  listRecent: (limit?: number) => Promise<PuzzleAttempt[]>
  /** The ids S14 must not offer again yet. */
  recentPuzzleIds: (since: Timestamp) => Promise<PuzzleId[]>
  /** The last rated attempt, which is where the current Glicko-2 numbers live. */
  lastRated: () => Promise<PuzzleAttempt | undefined>
  count: () => Promise<number>
  add: (attempt: PuzzleAttempt) => Promise<Result<PuzzleAttempt>>
  addMany: (attempts: readonly PuzzleAttempt[]) => Promise<Result<number>>
  removeForPuzzle: (puzzleId: PuzzleId) => Promise<Result<number>>
  clear: () => Promise<Result<void>>
}

export function createAttemptsRepository(db: ChessKingDb): AttemptsRepository {
  function windowed(range: AttemptRange) {
    return db.attempts
      .where('endedAt')
      .between(range.from ?? 0, range.to ?? MAX_TIMESTAMP, true, true)
  }

  return {
    get: (id) => db.attempts.get(id),

    listForPuzzle: (puzzleId) =>
      db.attempts
        .where('[puzzleId+endedAt]')
        .between([puzzleId, 0], [puzzleId, MAX_TIMESTAMP], true, true)
        .toArray(),

    listForSession: (sessionId) => db.attempts.where('sessionId').equals(sessionId).toArray(),

    listByDate: (range = {}) => {
      const collection = windowed(range)
      return range.limit === undefined
        ? collection.toArray()
        : collection.limit(range.limit).toArray()
    },

    listByMode: (mode, range = {}) => {
      const collection = db.attempts
        .where('[mode+endedAt]')
        .between([mode, range.from ?? 0], [mode, range.to ?? MAX_TIMESTAMP], true, true)
      return range.limit === undefined
        ? collection.toArray()
        : collection.limit(range.limit).toArray()
    },

    listRecent: (limit = 20) => db.attempts.orderBy('endedAt').reverse().limit(limit).toArray(),

    recentPuzzleIds: async (since) => {
      const ids = new Set<PuzzleId>()
      await db.attempts
        .where('endedAt')
        .between(since, MAX_TIMESTAMP, true, true)
        .each((attempt) => {
          ids.add(attempt.puzzleId)
        })
      return [...ids]
    },

    lastRated: () =>
      db.attempts
        .orderBy('endedAt')
        .reverse()
        .filter((attempt) => attempt.rated)
        .first(),

    count: () => db.attempts.count(),

    add: (attempt) =>
      writeValidated(PuzzleAttemptSchema, attempt, 'attempts.add', async (validated) => {
        await db.attempts.put(validated)
        return validated
      }),

    addMany: async (attempts) => {
      const validated = validateMany(PuzzleAttemptSchema, attempts, 'attempts.addMany')
      if (!validated.ok) return validated
      return runWrite('attempts.addMany', async () => {
        await db.attempts.bulkPut(validated.value)
        return validated.value.length
      })
    },

    removeForPuzzle: (puzzleId) =>
      runWrite('attempts.removeForPuzzle', () =>
        db.attempts.where('puzzleId').equals(puzzleId).delete(),
      ),

    clear: () => runWrite('attempts.clear', () => db.attempts.clear()),
  }
}
