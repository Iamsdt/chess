import type { Dexie, Transaction } from 'dexie'

/**
 * Versioned schema, as data.
 *
 * Why the versions are a list rather than a chain of `db.version(n).stores(…)`
 * calls in the constructor: a migration test must be able to open the database
 * *as an older build saw it*, write the rows that build would have written, and
 * then let the upgrade run. `applyMigrations(dexie, 1)` gives the test exactly
 * that, and the production path is the same code with no `upTo`.
 *
 * Index choices are downstream queries, not guesses. Each line below names the
 * sprint whose query it serves; getting one wrong costs a migration later.
 */

/** One schema version: the stores it declares and the data fix-up it runs. */
export interface Migration {
  readonly version: number
  /** Dexie store definitions. `null` drops a table. */
  readonly stores: Readonly<Record<string, string | null>>
  /** Runs inside the upgrade transaction, after the stores exist. */
  readonly upgrade?: (tx: Transaction) => Promise<void>
}

/** A game row as an older build may have left it — fields absent, not wrong. */
interface LegacyGameRow {
  mistakeCount?: unknown
  tags?: unknown
  reviewState?: unknown
}

/**
 * v1 — the shipping schema.
 *
 * - `games.createdAt/startedAt` · S20 library sorts newest first.
 * - `games.source/result/reviewState/youPlay/opening.eco/*tags` · S20 filter chips.
 * - `moves.[gameId+ply]` · S13 walks one game's moves in order from its primary key.
 * - `puzzles.[band+subLevel]/[band+rating]/[theme+rating]` · S14 band curriculum
 *   and theme-weighted selection.
 * - `srsCards.[state+due]` and the four `subject.*` paths · S15 due queue and
 *   "is there already a card for this mistake/puzzle/lesson/line".
 * - `jobs.[state+priority]/[state+createdAt]/[type+state]` · S11 scheduler picks.
 */
const V1: Migration = {
  version: 1,
  stores: {
    games: 'id, createdAt, startedAt, source, result, reviewState, youPlay, opening.eco, *tags',
    moves: '[gameId+ply], gameId',
    puzzles:
      'id, band, rating, theme, difficulty, subLevel, packId, *tags, [band+subLevel], [band+rating], [theme+rating]',
    attempts: 'id, puzzleId, sessionId, endedAt, mode, [puzzleId+endedAt], [mode+endedAt]',
    srsCards:
      'id, due, state, updatedAt, [state+due], subject.kind, subject.mistakeId, subject.puzzleId, subject.lessonId, subject.nodeId',
    mistakes:
      'id, createdAt, source, gameId, puzzleId, quality, srsCardId, *themes, [source+createdAt], [quality+createdAt]',
    packs: 'id, kind, source, updatedAt',
    lessonsProgress: 'lessonId, packId, status, updatedAt, [packId+status]',
    repertoire:
      'id, parentId, color, ply, positionKey, srsCardId, updatedAt, [color+ply], [color+positionKey]',
    sessions: 'id, kind, state, day, startedAt, [kind+startedAt], [state+startedAt], [day+kind]',
    jobs: 'id, type, state, priority, createdAt, nextRunAt, [state+priority], [state+createdAt], [type+state], [type+dedupeKey]',
    settings: 'id',
    profile: 'id, updatedAt',
    kv: 'key, updatedAt',
  },
}

/**
 * v2 — the indexes the feature sprints turned out to need, plus the backfill
 * that makes v1 rows valid against the current `GameMeta` schema.
 *
 * Added:
 * - `games.endedAt`, `games.[reviewState+startedAt]`, `games.[source+startedAt]`
 *   · S20 "unreviewed games, newest first" and per-provider paging.
 * - `games.[source+externalId]` · S20 import dedupe. Deliberately **not** unique:
 *   a duplicate is a row the importer can reject, whereas a unique index that
 *   rejects during an upgrade takes the whole database offline.
 * - `moves.[gameId+quality]` · S13 key moments reads only the bad moves.
 * - `puzzles.[band+subLevel+rating]` and `[difficulty+rating]` · S14 selection
 *   targets a rating window inside one rung of the curriculum.
 * - `srsCards.[subject.kind+state+due]` · S15 interleaves due queues per subject,
 *   and `masteredAt` answers "cleared this week".
 *
 * Backfilled: `mistakeCount`, `tags` and `reviewState`, which gained defaults
 * after v1 shipped. A row written by v1 has them missing, and a missing field
 * fails `GameMetaSchema` on the next read.
 */
const V2: Migration = {
  version: 2,
  stores: {
    games:
      'id, createdAt, startedAt, endedAt, source, result, reviewState, youPlay, opening.eco, *tags, [source+externalId], [reviewState+startedAt], [source+startedAt]',
    moves: '[gameId+ply], gameId, [gameId+quality]',
    puzzles:
      'id, band, rating, theme, difficulty, subLevel, packId, *tags, [band+subLevel], [band+rating], [theme+rating], [band+subLevel+rating], [difficulty+rating]',
    srsCards:
      'id, due, state, updatedAt, masteredAt, [state+due], [subject.kind+state+due], subject.kind, subject.mistakeId, subject.puzzleId, subject.lessonId, subject.nodeId',
  },
  upgrade: async (tx) => {
    await tx
      .table<LegacyGameRow>('games')
      .toCollection()
      .modify((row) => {
        if (typeof row.mistakeCount !== 'number') row.mistakeCount = 0
        if (!Array.isArray(row.tags)) row.tags = []
        if (typeof row.reviewState !== 'string') row.reviewState = 'not-reviewed'
      })
  },
}

export const MIGRATIONS: readonly Migration[] = [V1, V2]

/** The version a fresh install opens at. Bump it by appending to `MIGRATIONS`. */
export const CURRENT_DB_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 1

/**
 * Declare versions on a Dexie instance, optionally stopping at an older one.
 *
 * `upTo` is the migration test harness: open at `1`, write rows the way v1 did,
 * close, reopen with no `upTo`, and the upgrade path runs for real.
 */
export function applyMigrations(dexie: Dexie, upTo: number = CURRENT_DB_VERSION): void {
  for (const migration of MIGRATIONS) {
    if (migration.version > upTo) break
    const version = dexie.version(migration.version).stores(migration.stores)
    if (migration.upgrade !== undefined) version.upgrade(migration.upgrade)
  }
}
