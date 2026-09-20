import {
  err,
  now,
  ok,
  parseValid,
  type Result,
  type LocalDate,
  type SessionId,
  type SessionKind,
  type Timestamp,
} from '@/domain'

import { notFound, runWrite, writeValidated } from '../internal'
import { PracticeSessionSchema, type PracticeSession, type PracticeSessionState } from '../schema'

import type { ChessKingDb } from '../db'

/**
 * Practice sessions — one row per sitting.
 *
 * `[day+kind]` is the heatmap and the daily goal; `[state+startedAt]` is
 * "is there a session to resume?", which every runner asks on mount.
 */
const MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER

export interface SessionsRepository {
  get: (id: SessionId) => Promise<PracticeSession | undefined>
  /** The session a reload interrupted, newest first. */
  findActive: (kind?: SessionKind) => Promise<PracticeSession | undefined>
  listByDay: (day: LocalDate, kind?: SessionKind) => Promise<PracticeSession[]>
  listByKind: (kind: SessionKind, limit?: number) => Promise<PracticeSession[]>
  /** Newest first — the session history strip. */
  listRecent: (limit?: number) => Promise<PracticeSession[]>
  listBetween: (from: Timestamp, to: Timestamp) => Promise<PracticeSession[]>
  /** Today's practised milliseconds, which is what the goal ring fills against. */
  totalDurationForDay: (day: LocalDate) => Promise<number>
  start: (session: PracticeSession) => Promise<Result<PracticeSession>>
  update: (id: SessionId, patch: Partial<PracticeSession>) => Promise<Result<PracticeSession>>
  /** Stamps `endedAt` and the final state in one write. */
  finish: (
    id: SessionId,
    state: Exclude<PracticeSessionState, 'active'>,
    endedAt?: Timestamp,
  ) => Promise<Result<PracticeSession>>
  remove: (id: SessionId) => Promise<Result<void>>
  clear: () => Promise<Result<void>>
}

export function createSessionsRepository(db: ChessKingDb): SessionsRepository {
  async function update(
    id: SessionId,
    patch: Partial<PracticeSession>,
  ): Promise<Result<PracticeSession>> {
    const outcome = await runWrite('sessions.update', () =>
      db.transaction('rw', db.sessions, async (): Promise<Result<PracticeSession>> => {
        const existing = await db.sessions.get(id)
        if (existing === undefined) return err(notFound('sessions.update', id))
        const parsed = parseValid(
          PracticeSessionSchema,
          { ...existing, ...patch, updatedAt: patch.updatedAt ?? now() },
          'sessions.update',
        )
        if (!parsed.ok) return parsed
        await db.sessions.put(parsed.value)
        return ok(parsed.value)
      }),
    )
    return outcome.ok ? outcome.value : outcome
  }

  return {
    get: (id) => db.sessions.get(id),

    findActive: async (kind) => {
      const active = await db.sessions
        .where('[state+startedAt]')
        .between(['active', 0], ['active', MAX_TIMESTAMP], true, true)
        .reverse()
        .toArray()
      return kind === undefined ? active[0] : active.find((session) => session.kind === kind)
    },

    listByDay: (day, kind) =>
      kind === undefined
        ? db.sessions.where('day').equals(day).toArray()
        : db.sessions.where('[day+kind]').equals([day, kind]).toArray(),

    listByKind: (kind, limit) => {
      const collection = db.sessions
        .where('[kind+startedAt]')
        .between([kind, 0], [kind, MAX_TIMESTAMP], true, true)
        .reverse()
      return limit === undefined ? collection.toArray() : collection.limit(limit).toArray()
    },

    listRecent: (limit = 20) => db.sessions.orderBy('startedAt').reverse().limit(limit).toArray(),

    listBetween: (from, to) =>
      db.sessions.where('startedAt').between(from, to, true, true).toArray(),

    totalDurationForDay: async (day) => {
      let total = 0
      await db.sessions
        .where('day')
        .equals(day)
        .each((session) => {
          total += session.durationMs
        })
      return total
    },

    start: (session) =>
      writeValidated(PracticeSessionSchema, session, 'sessions.start', async (validated) => {
        await db.sessions.put(validated)
        return validated
      }),

    update,

    finish: (id, state, endedAt) => update(id, { state, endedAt: endedAt ?? now() }),

    remove: (id) =>
      runWrite('sessions.remove', async () => {
        await db.sessions.delete(id)
      }),

    clear: () => runWrite('sessions.clear', () => db.sessions.clear()),
  }
}
