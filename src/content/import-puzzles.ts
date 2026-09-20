import {
  PUZZLE_BANDS,
  domainError,
  err,
  now as nowTimestamp,
  ok,
  type Err,
  type DomainError,
  type PuzzleBand,
  type Result,
  type Timestamp,
} from '@/domain'

import {
  DEFAULT_QUIZ_BASE_URL,
  bandCsvUrl,
  bandVersion,
  parseQuizManifest,
  quizManifestUrl,
} from './manifest'
import { DEFAULT_BATCH_SIZE, type PuzzleParser } from './puzzle-parser'
import { createWorkerPuzzleParser } from './puzzle-parser-worker'
import {
  findBandState,
  withBandState,
  type ImportedBandState,
  type PuzzleImportState,
  type PuzzleSink,
  type PuzzleStoreStats,
} from './puzzle-sink'

import type { SkippedPuzzleRow } from './puzzle-row'

/**
 * First-run import of the band CSVs into storage.
 *
 * Three properties matter more than speed, and all three come from the same
 * design — the manifest is the unit of freshness, `Puzzle.id` is the unit of
 * identity, and the band state is written after every batch:
 *
 * - **Idempotent.** The sink upserts by id, so a second run rewrites the same
 *   10,000 rows and changes nothing anyone can observe.
 * - **Incremental.** A band whose manifest version already matches what is stored
 *   is not downloaded at all, so a content update costs one band, not six.
 * - **Resumable.** A run that is cancelled, or a tab that is closed, leaves a
 *   part-imported band with its row cursor on disk; the next run starts there.
 *   That is also the shape S11's job queue needs: chunked work, a persisted
 *   cursor, progress after every chunk, and cancellation between chunks.
 */

/** What a band's import did, for the report and the dev panel. */
export type BandImportStatus = 'imported' | 'resumed' | 'up-to-date'

export interface BandImportOutcome {
  readonly band: PuzzleBand
  readonly status: BandImportStatus
  readonly rowsRead: number
  readonly puzzlesImported: number
  readonly skippedRows: number
}

export interface PuzzleImportReport {
  readonly manifestVersion: number
  readonly bands: readonly BandImportOutcome[]
  /** Rows written across every band this run, skipped rows excluded. */
  readonly puzzlesImported: number
  readonly rowsRead: number
  /** Every row that failed validation, with the reason. Never silently dropped. */
  readonly skipped: readonly SkippedPuzzleRow[]
  readonly durationMs: number
}

export interface ImportProgress {
  readonly phase: 'manifest' | 'band' | 'done'
  readonly band: PuzzleBand | null
  /** 0-based position in `PUZZLE_BANDS`, so a caller can render "3 of 6". */
  readonly bandIndex: number
  readonly bandCount: number
  /** Rows consumed in the current band, skipped ones included. */
  readonly bandRowsRead: number
  /** Rows written across the whole run so far. */
  readonly puzzlesImported: number
  readonly skippedRows: number
}

export interface ImportPuzzleBandsOptions {
  readonly sink: PuzzleSink
  readonly onProgress?: ((progress: ImportProgress) => void) | undefined
  readonly signal?: AbortSignal | undefined
  /** Defaults to the worker-backed parser; the CLI and tests pass an inline one. */
  readonly parser?: PuzzleParser | undefined
  readonly baseUrl?: string | undefined
  readonly batchSize?: number | undefined
  /** Injected so tests need no network; defaults to `fetch` + `parseQuizManifest`. */
  readonly fetchJson?: ((url: string) => Promise<Result<unknown>>) | undefined
  /** Re-import every band even when its version matches. Used by "repair data". */
  readonly force?: boolean | undefined
  readonly now?: (() => Timestamp) | undefined
}

const fetchJsonDefault = async (url: string): Promise<Result<unknown>> => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return err(
        domainError('io', `Could not read ${url} (HTTP ${String(response.status)})`, {
          where: url,
        }),
      )
    }
    const body: unknown = await response.json()
    return ok(body)
  } catch (cause) {
    return err(domainError('network', `Could not read ${url}`, { where: url, cause }))
  }
}

const cancelled = (): DomainError => domainError('cancelled', 'Puzzle import was cancelled')

/** Why a function: `AbortSignal.aborted` is readonly, so an inline check narrows to
 * `false` for the rest of the run and the next check is dead code to the compiler. */
const isAborted = (signal: AbortSignal | undefined): boolean => signal?.aborted ?? false

/** Why: a macrotask between batches is what lets the UI paint its own progress bar. */
const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

export async function importPuzzleBands(
  options: ImportPuzzleBandsOptions,
): Promise<Result<PuzzleImportReport>> {
  const {
    sink,
    onProgress,
    signal,
    baseUrl = DEFAULT_QUIZ_BASE_URL,
    batchSize = DEFAULT_BATCH_SIZE,
    fetchJson = fetchJsonDefault,
    force = false,
    now = nowTimestamp,
  } = options

  const startedAt = Date.now()
  const ownsParser = options.parser === undefined
  const parser = options.parser ?? createWorkerPuzzleParser()
  const bandCount = PUZZLE_BANDS.length

  const report = (progress: ImportProgress): void => {
    onProgress?.(progress)
  }

  try {
    if (isAborted(signal)) return err(cancelled())

    report({
      phase: 'manifest',
      band: null,
      bandIndex: 0,
      bandCount,
      bandRowsRead: 0,
      puzzlesImported: 0,
      skippedRows: 0,
    })

    const manifestUrl = quizManifestUrl(baseUrl)
    const body = await fetchJson(manifestUrl)
    if (!body.ok) return body
    const manifest = parseQuizManifest(body.value, manifestUrl)
    if (!manifest.ok) return manifest

    const stored = await sink.readImportState()
    if (!stored.ok) return stored
    let state: PuzzleImportState | null = stored.value

    const outcomes: BandImportOutcome[] = []
    const skipped: SkippedPuzzleRow[] = []
    let puzzlesImported = 0
    let rowsRead = 0

    for (const [bandIndex, band] of PUZZLE_BANDS.entries()) {
      if (isAborted(signal)) return err(cancelled())

      const version = bandVersion(manifest.value, band)
      const prior = findBandState(state, band)
      // Only state written for *this* version can be reused: a version bump may have
      // changed the rows themselves, so the band starts over rather than resumes.
      const reusable = !force && prior !== null && prior.version === version ? prior : null

      if (reusable?.complete === true) {
        outcomes.push({
          band,
          status: 'up-to-date',
          rowsRead: reusable.rowsRead,
          puzzlesImported: 0,
          skippedRows: 0,
        })
        report({
          phase: 'band',
          band,
          bandIndex,
          bandCount,
          bandRowsRead: reusable.rowsRead,
          puzzlesImported,
          skippedRows: skipped.length,
        })
        continue
      }

      const resumeFrom = reusable?.rowsRead ?? 0
      let bandImported = reusable?.puzzlesImported ?? 0
      let bandSkipped = reusable?.skippedRows ?? 0
      let bandRows = resumeFrom

      const writeBandState = async (complete: boolean): Promise<Result<void>> => {
        const next: ImportedBandState = {
          band,
          version,
          rowsRead: bandRows,
          puzzlesImported: bandImported,
          skippedRows: bandSkipped,
          complete,
          updatedAt: now(),
        }
        state = withBandState(state, manifest.value.version, next)
        return sink.writeImportState(state)
      }

      // An array, not a `let`: a failure recorded inside the batch callback has to
      // survive the `await` that TypeScript's flow analysis cannot see through.
      const writeFailures: Err<DomainError>[] = []

      const parsed = await parser.parseBand(
        { band, url: bandCsvUrl(band, baseUrl), batchSize, startRow: resumeFrom },
        async (batch) => {
          if (writeFailures.length > 0) return
          if (batch.puzzles.length > 0) {
            const written = await sink.putPuzzles(batch.puzzles)
            if (!written.ok) {
              writeFailures.push(written)
              return
            }
            bandImported += written.value.written
            puzzlesImported += written.value.written
          }
          bandRows = batch.rowsRead
          bandSkipped += batch.skipped.length
          skipped.push(...batch.skipped)

          const persisted = await writeBandState(false)
          if (!persisted.ok) {
            writeFailures.push(persisted)
            return
          }
          report({
            phase: 'band',
            band,
            bandIndex,
            bandCount,
            bandRowsRead: bandRows,
            puzzlesImported,
            skippedRows: skipped.length,
          })
          await yieldToEventLoop()
        },
        signal,
      )

      const writeFailure = writeFailures[0]
      if (writeFailure !== undefined) return writeFailure
      if (!parsed.ok) return parsed

      bandRows = parsed.value.rowsRead
      const finished = await writeBandState(true)
      if (!finished.ok) return finished
      rowsRead += parsed.value.rowsRead - resumeFrom

      outcomes.push({
        band,
        status: resumeFrom > 0 ? 'resumed' : 'imported',
        rowsRead: parsed.value.rowsRead,
        puzzlesImported: bandImported,
        skippedRows: bandSkipped,
      })
    }

    report({
      phase: 'done',
      band: null,
      bandIndex: bandCount,
      bandCount,
      bandRowsRead: 0,
      puzzlesImported,
      skippedRows: skipped.length,
    })

    return ok({
      manifestVersion: manifest.value.version,
      bands: outcomes,
      puzzlesImported,
      rowsRead,
      skipped,
      durationMs: Date.now() - startedAt,
    })
  } finally {
    if (ownsParser) parser.close()
  }
}

export interface PuzzleStats extends PuzzleStoreStats {
  /** `null` before the first import. */
  readonly manifestVersion: number | null
  readonly bands: readonly ImportedBandState[]
  readonly importedAt: Timestamp | null
  /** True only when every band is present at its manifest version. */
  readonly complete: boolean
}

/**
 * What is actually in the database, for the puzzle hub and the settings screen.
 *
 * Why it reads the sink rather than caching: the only honest answer to "how many
 * puzzles do I have offline" is the one the store gives.
 */
export async function getPuzzleStats(sink: PuzzleSink): Promise<Result<PuzzleStats>> {
  const stats = await sink.stats()
  if (!stats.ok) return stats
  const state = await sink.readImportState()
  if (!state.ok) return state

  const bands = state.value?.bands ?? []
  const complete = bands.length === PUZZLE_BANDS.length && bands.every((entry) => entry.complete)

  return ok({
    ...stats.value,
    manifestVersion: state.value?.manifestVersion ?? null,
    bands,
    importedAt: state.value?.updatedAt ?? null,
    complete,
  })
}
