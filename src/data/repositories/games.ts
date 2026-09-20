import {
  err,
  MoveRecordSchema,
  now,
  ok,
  parseValid,
  type Result,
  type Color,
  type EcoCode,
  type Game,
  type GameId,
  type GameResult,
  type GameSource,
  type ReviewState,
  type Timestamp,
} from '@/domain'

import { notFound, runWrite, validateMany, writeValidated } from '../internal'
import { GameRowSchema, type GameRow } from '../schema'

import type { ChessKingDb } from '../db'
import type { Collection } from 'dexie'

/**
 * Games: the library table, the review header and the sparring autosave.
 *
 * Reads return plain values so `useLiveQuery` can call them directly; writes
 * return a `Result`, because a quota failure or a duplicate import is a
 * condition the caller has to handle rather than an exception to let escape.
 */

/** The S20 library filters, each backed by an index or a cheap predicate. */
export interface GameFilter {
  source?: GameSource | undefined
  result?: GameResult | undefined
  reviewState?: ReviewState | undefined
  youPlay?: Color | undefined
  /** Matches `opening.eco` exactly; the filter chips offer whole codes. */
  eco?: EcoCode | undefined
  /** One of `tags`, matched through the multi-entry index. */
  tag?: string | undefined
  /** Inclusive `startedAt` bounds. */
  from?: Timestamp | undefined
  to?: Timestamp | undefined
  /** Minimum accuracy for the side the user played. Not indexable; a predicate. */
  minAccuracy?: number | undefined
  /** Substring of either player's name, case-insensitive. */
  opponent?: string | undefined
}

export interface GamePage {
  offset?: number | undefined
  limit?: number | undefined
}

const MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER

/** Why: the user's own accuracy depends on which side they played, so it is derived. */
function yourAccuracy(row: GameRow): number | undefined {
  return row.accuracy === undefined ? undefined : row.accuracy[row.youPlay]
}

function matchesPredicates(row: GameRow, filter: GameFilter): boolean {
  if (filter.result !== undefined && row.result !== filter.result) return false
  if (filter.youPlay !== undefined && row.youPlay !== filter.youPlay) return false
  if (filter.eco !== undefined && row.opening?.eco !== filter.eco) return false
  if (filter.tag !== undefined && !row.tags.includes(filter.tag)) return false
  if (filter.from !== undefined && row.startedAt < filter.from) return false
  if (filter.to !== undefined && row.startedAt > filter.to) return false
  if (filter.minAccuracy !== undefined) {
    const accuracy = yourAccuracy(row)
    if (accuracy === undefined || accuracy < filter.minAccuracy) return false
  }
  if (filter.opponent !== undefined) {
    const needle = filter.opponent.toLowerCase()
    const names = `${row.white.name} ${row.black.name}`.toLowerCase()
    if (!names.includes(needle)) return false
  }
  return true
}

/**
 * Pick the narrowest index the filter allows.
 *
 * `ordered` says whether the chosen index already sorts by `startedAt`. When it
 * does, paging is a cursor walk; when it does not the rows are sorted in memory,
 * which is the price of a filter no single index covers.
 */
function baseCollection(
  db: ChessKingDb,
  filter: GameFilter,
): { collection: Collection<GameRow, GameId>; ordered: boolean } {
  const lower = filter.from ?? 0
  const upper = filter.to ?? MAX_TIMESTAMP
  if (filter.reviewState !== undefined) {
    return {
      collection: db.games
        .where('[reviewState+startedAt]')
        .between([filter.reviewState, lower], [filter.reviewState, upper], true, true),
      ordered: true,
    }
  }
  if (filter.source !== undefined) {
    return {
      collection: db.games
        .where('[source+startedAt]')
        .between([filter.source, lower], [filter.source, upper], true, true),
      ordered: true,
    }
  }
  if (filter.tag !== undefined) {
    return { collection: db.games.where('tags').equals(filter.tag), ordered: false }
  }
  if (filter.eco !== undefined) {
    return { collection: db.games.where('opening.eco').equals(filter.eco), ordered: false }
  }
  return {
    collection: db.games.where('startedAt').between(lower, upper, true, true),
    ordered: true,
  }
}

export interface GamesRepository {
  get: (id: GameId) => Promise<GameRow | undefined>
  /** The header plus its moves, which is what the review and analysis screens need. */
  getWithMoves: (id: GameId) => Promise<Game | undefined>
  /** Newest first. Any filter combination is legal; the index is chosen for you. */
  list: (filter?: GameFilter, page?: GamePage) => Promise<GameRow[]>
  count: (filter?: GameFilter) => Promise<number>
  /** The library's "recent games" strip and the Today screen. */
  listRecent: (limit?: number) => Promise<GameRow[]>
  /** S13 asks this to decide what to enqueue next. */
  listByReviewState: (state: ReviewState, limit?: number) => Promise<GameRow[]>
  findByExternalId: (source: GameSource, externalId: string) => Promise<GameRow | undefined>
  /** Writes the header and the whole move list in one transaction. */
  save: (game: Game) => Promise<Result<GameRow>>
  /** Autosave after a move: the header only, leaving the move list alone. */
  saveMeta: (row: GameRow) => Promise<Result<GameRow>>
  /** Read-modify-write inside a transaction, so two autosaves cannot interleave. */
  update: (id: GameId, patch: Partial<GameRow>) => Promise<Result<GameRow>>
  setReviewState: (id: GameId, state: ReviewState) => Promise<Result<GameRow>>
  /**
   * Import that never duplicates: a repeated `(source, externalId)` updates the
   * existing row and reports `duplicate: true`, so S20 can count what it skipped.
   */
  importGame: (game: Game) => Promise<Result<{ id: GameId; duplicate: boolean }>>
  remove: (id: GameId) => Promise<Result<void>>
  clear: () => Promise<Result<void>>
}

export function createGamesRepository(db: ChessKingDb): GamesRepository {
  async function readRows(filter: GameFilter, page: GamePage): Promise<GameRow[]> {
    const { collection, ordered } = baseCollection(db, filter)
    const filtered = collection.filter((row) => matchesPredicates(row, filter))
    const offset = page.offset ?? 0
    const limit = page.limit ?? Infinity
    if (ordered) {
      const walked = filtered.reverse().offset(offset)
      return Number.isFinite(limit) ? walked.limit(limit).toArray() : walked.toArray()
    }
    const rows = await filtered.sortBy('startedAt')
    rows.reverse()
    return Number.isFinite(limit) ? rows.slice(offset, offset + limit) : rows.slice(offset)
  }

  async function save(game: Game): Promise<Result<GameRow>> {
    const parsedRow = parseValid(
      GameRowSchema,
      { ...game.meta, ...(game.pgn === undefined ? {} : { pgn: game.pgn }) },
      'games.save',
    )
    if (!parsedRow.ok) return parsedRow
    const moves = validateMany(MoveRecordSchema, game.moves, 'games.save.moves')
    if (!moves.ok) return moves
    const row = parsedRow.value
    return runWrite('games.save', async () => {
      await db.transaction('rw', db.games, db.moves, async () => {
        await db.games.put(row)
        await db.moves.where('gameId').equals(row.id).delete()
        if (moves.value.length > 0) await db.moves.bulkPut(moves.value)
      })
      return row
    })
  }

  async function update(id: GameId, patch: Partial<GameRow>): Promise<Result<GameRow>> {
    const outcome = await runWrite('games.update', () =>
      db.transaction('rw', db.games, async (): Promise<Result<GameRow>> => {
        const existing = await db.games.get(id)
        if (existing === undefined) return err(notFound('games.update', id))
        const parsed = parseValid(
          GameRowSchema,
          { ...existing, ...patch, updatedAt: patch.updatedAt ?? now() },
          'games.update',
        )
        if (!parsed.ok) return parsed
        await db.games.put(parsed.value)
        return ok(parsed.value)
      }),
    )
    return outcome.ok ? outcome.value : outcome
  }

  async function importGame(game: Game): Promise<Result<{ id: GameId; duplicate: boolean }>> {
    const externalId = game.meta.externalId
    if (externalId !== undefined) {
      const existing = await db.games
        .where('[source+externalId]')
        .equals([game.meta.source, externalId])
        .first()
      if (existing !== undefined) {
        const saved = await save({ ...game, meta: { ...game.meta, id: existing.id } })
        return saved.ok ? ok({ id: existing.id, duplicate: true }) : saved
      }
    }
    const saved = await save(game)
    return saved.ok ? ok({ id: saved.value.id, duplicate: false }) : saved
  }

  return {
    get: (id) => db.games.get(id),

    getWithMoves: async (id) => {
      const row = await db.games.get(id)
      if (row === undefined) return undefined
      const moves = await db.moves
        .where('[gameId+ply]')
        .between([id, 0], [id, Infinity], true, true)
        .toArray()
      const { pgn, ...meta } = row
      return pgn === undefined ? { meta, moves } : { meta, moves, pgn }
    },

    list: (filter = {}, page = {}) => readRows(filter, page),

    count: async (filter = {}) => {
      const { collection } = baseCollection(db, filter)
      return collection.filter((row) => matchesPredicates(row, filter)).count()
    },

    listRecent: (limit = 10) => readRows({}, { limit }),

    listByReviewState: (state, limit) =>
      readRows({ reviewState: state }, limit === undefined ? {} : { limit }),

    findByExternalId: (source, externalId) =>
      db.games.where('[source+externalId]').equals([source, externalId]).first(),

    save,

    saveMeta: (row) =>
      writeValidated(GameRowSchema, row, 'games.saveMeta', async (validated) => {
        await db.games.put(validated)
        return validated
      }),

    update,

    setReviewState: (id, state) => update(id, { reviewState: state }),

    importGame,

    remove: (id) =>
      runWrite('games.remove', async () => {
        await db.transaction('rw', db.games, db.moves, async () => {
          await db.moves.where('gameId').equals(id).delete()
          await db.games.delete(id)
        })
      }),

    clear: () =>
      runWrite('games.clear', async () => {
        await db.transaction('rw', db.games, db.moves, async () => {
          await db.moves.clear()
          await db.games.clear()
        })
      }),
  }
}
