import type { GamesRepository } from '@/data'
import { domainError, err, ok, type GameId, type Game, type Result } from '@/domain'

import type { PgnPort } from './pgn-port'
import type { PgnImportOptions, PgnWireSource, SkippedGame } from './worker-protocol'

/**
 * Import: parse in the worker, dedupe, store.
 *
 * The rule that shapes this file is "re-import creates no duplicates". It is enforced in
 * two places on purpose:
 *
 * - **Within one import**, by a set of keys already seen — a PGN file that contains the
 *   same game twice is common, and asking the database twice for it is wasteful.
 * - **Against the library**, by `findByExternalId` before the write. `gamesRepo.importGame`
 *   would also collapse the duplicate, but it collapses it by *overwriting* the stored
 *   row, and an already-reviewed game would lose its accuracy and classifications to a
 *   plain re-import. Checking first means a duplicate costs one read and nothing else.
 *
 * Every game is validated by `GameSchema` on the way out of the worker and again on the
 * way into the repository, so nothing unvalidated reaches IndexedDB.
 */

/** Skipped games are reported, not counted — but a broken 5 MB file must not be kept. */
export const MAX_REPORTED_SKIPS = 50

interface Scheduler {
  readonly yield?: () => Promise<void>
}

/**
 * Hand the main thread back to the browser.
 *
 * Why this is needed even though the parsing is in a worker: storing is not. Dexie
 * resolves its promises as microtasks, so a run of `await repo.write()` can drain from
 * start to finish inside a single task and never let the browser paint — which looks
 * exactly like the freeze this sprint promises not to cause. A real task boundary between
 * games is what lets a click land and a progress bar move while thousands of games are
 * written.
 *
 * `scheduler.yield()` where it exists (it returns to the *front* of the queue, so the
 * import keeps its priority); a `MessageChannel` otherwise, because nested `setTimeout`
 * is clamped to 4 ms and that clamp alone would add half a minute to a large import.
 */
const yieldChannel = typeof MessageChannel === 'function' ? new MessageChannel() : null
const yieldWaiters: (() => void)[] = []
if (yieldChannel !== null) {
  yieldChannel.port1.onmessage = () => {
    yieldWaiters.shift()?.()
  }
}

export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: Scheduler }).scheduler
  if (typeof scheduler?.yield === 'function') return scheduler.yield()
  if (yieldChannel === null) return Promise.resolve()
  return new Promise<void>((resolve) => {
    yieldWaiters.push(resolve)
    yieldChannel.port2.postMessage(undefined)
  })
}

export interface ImportProgress {
  readonly phase: 'parsing' | 'storing' | 'done'
  readonly gamesParsed: number
  readonly imported: number
  readonly duplicates: number
  readonly skipped: number
  readonly bytesRead: number
  readonly totalBytes: number | null
  /** What the progress bar says it is doing, e.g. `2024-08 · 31 games`. */
  readonly label?: string
}

export interface ImportReport {
  readonly imported: number
  readonly duplicates: number
  readonly skippedCount: number
  /** The first `MAX_REPORTED_SKIPS` failures, for the "what went wrong" list. */
  readonly skipped: readonly SkippedGame[]
  readonly gameIds: readonly GameId[]
}

/** Only the two methods the importer uses, so a test needs a two-line fake. */
export type GamesSink = Pick<GamesRepository, 'importGame' | 'findByExternalId'>

export interface ImportDeps {
  readonly pgn: PgnPort
  readonly games: GamesSink
  readonly onProgress?: (progress: ImportProgress) => void
  readonly signal?: AbortSignal
}

interface Tally {
  imported: number
  duplicates: number
  skippedCount: number
  gamesParsed: number
  bytesRead: number
  readonly skipped: SkippedGame[]
  readonly gameIds: GameId[]
  readonly seen: Set<string>
}

function newTally(): Tally {
  return {
    imported: 0,
    duplicates: 0,
    skippedCount: 0,
    gamesParsed: 0,
    bytesRead: 0,
    skipped: [],
    gameIds: [],
    seen: new Set<string>(),
  }
}

function record(tally: Tally, skip: SkippedGame): void {
  tally.skippedCount += 1
  if (tally.skipped.length < MAX_REPORTED_SKIPS) tally.skipped.push(skip)
}

function toReport(tally: Tally): ImportReport {
  return {
    imported: tally.imported,
    duplicates: tally.duplicates,
    skippedCount: tally.skippedCount,
    skipped: tally.skipped,
    gameIds: tally.gameIds,
  }
}

async function storeGame(game: Game, tally: Tally, games: GamesSink, at: number): Promise<void> {
  const externalId = game.meta.externalId
  if (externalId !== undefined) {
    const key = `${game.meta.source}:${externalId}`
    if (tally.seen.has(key)) {
      tally.duplicates += 1
      return
    }
    tally.seen.add(key)
    const existing = await games.findByExternalId(game.meta.source, externalId)
    if (existing !== undefined) {
      tally.duplicates += 1
      return
    }
  }
  const saved = await games.importGame(game)
  if (!saved.ok) {
    record(tally, {
      index: at,
      label: `${game.meta.white.name} vs ${game.meta.black.name}`,
      reason: saved.error.message,
    })
    return
  }
  if (saved.value.duplicate) {
    tally.duplicates += 1
    return
  }
  tally.imported += 1
  tally.gameIds.push(saved.value.id)
}

/**
 * Run one PGN source all the way into the library.
 *
 * `label` is threaded through so a multi-part import (a year of Chess.com archives) can
 * say which part it is on without this function knowing anything about providers.
 */
async function runSource(
  source: PgnWireSource,
  options: PgnImportOptions,
  deps: ImportDeps,
  tally: Tally,
  label: string | undefined,
  totalOverride: number | null,
): Promise<Result<void>> {
  const report = (
    phase: ImportProgress['phase'],
    bytesRead: number,
    total: number | null,
  ): void => {
    deps.onProgress?.({
      phase,
      gamesParsed: tally.gamesParsed,
      imported: tally.imported,
      duplicates: tally.duplicates,
      skipped: tally.skippedCount,
      bytesRead,
      totalBytes: total,
      ...(label === undefined ? {} : { label }),
    })
  }

  let index = 0
  const parsed = await deps.pgn.parse(
    source,
    options,
    async (batch) => {
      report('storing', tally.bytesRead + batch.bytesRead, totalOverride ?? batch.totalBytes)
      for (const skip of batch.skipped) record(tally, skip)
      for (const game of batch.games) {
        await storeGame(game, tally, deps.games, index)
        index += 1
        tally.gamesParsed += 1
        await yieldToMain()
      }
      report('parsing', tally.bytesRead + batch.bytesRead, totalOverride ?? batch.totalBytes)
    },
    deps.signal,
  )
  if (!parsed.ok) return parsed
  tally.bytesRead += parsed.value.bytesRead
  return ok(undefined)
}

/** Import a pasted string or a chosen file. The whole parse happens in the worker. */
export async function importPgn(
  source: PgnWireSource,
  options: PgnImportOptions,
  deps: ImportDeps,
): Promise<Result<ImportReport>> {
  const tally = newTally()
  const outcome = await runSource(source, options, deps, tally, undefined, null)
  if (!outcome.ok) return outcome
  deps.onProgress?.({
    phase: 'done',
    gamesParsed: tally.gamesParsed,
    imported: tally.imported,
    duplicates: tally.duplicates,
    skipped: tally.skippedCount,
    bytesRead: tally.bytesRead,
    totalBytes: tally.bytesRead,
  })
  return ok(toReport(tally))
}

/** One piece of a provider's answer: a month of archives, or a whole export. */
export interface FeedChunk {
  readonly label: string
  readonly pgn: string
  /** 1-based, so the label can read "3 of 12". */
  readonly index: number
  readonly total: number | null
}

/** Why `Result` items and not a throwing iterator: a rate limit is a value, not a crash. */
export type PgnFeed = (signal?: AbortSignal) => AsyncIterable<Result<FeedChunk>>

/**
 * Import everything a provider hands over.
 *
 * A chunk that contains no games at all is not an error — an empty month of archives is
 * the normal case for a player who did not play that month — so `importPgn`'s "there are
 * no games in this PGN" is tolerated per chunk and only becomes a failure if every chunk
 * was empty.
 */
export async function importFromFeed(
  feed: PgnFeed,
  options: PgnImportOptions,
  deps: ImportDeps,
): Promise<Result<ImportReport>> {
  const tally = newTally()
  let chunks = 0
  for await (const chunk of feed(deps.signal)) {
    if (!chunk.ok) return chunk
    if (deps.signal?.aborted === true) {
      return err(domainError('cancelled', 'The import was cancelled', { where: 'import' }))
    }
    chunks += 1
    if (chunk.value.pgn.trim() === '') continue
    const outcome = await runSource(
      { kind: 'text', text: chunk.value.pgn },
      options,
      deps,
      tally,
      chunk.value.label,
      null,
    )
    if (!outcome.ok && outcome.error.code !== 'validation') return outcome
  }
  if (chunks === 0) {
    return err(
      domainError('not-found', 'That account has no games we can read', { where: 'import' }),
    )
  }
  deps.onProgress?.({
    phase: 'done',
    gamesParsed: tally.gamesParsed,
    imported: tally.imported,
    duplicates: tally.duplicates,
    skipped: tally.skippedCount,
    bytesRead: tally.bytesRead,
    totalBytes: tally.bytesRead,
  })
  return ok(toReport(tally))
}
