import {
  domainError,
  err,
  ok,
  type DomainError,
  type Puzzle,
  type PuzzleBand,
  type Result,
} from '@/domain'

import { CsvStreamParser } from './csv'
import { checkPuzzleCsvHeader, puzzleFromCsvRow, type SkippedPuzzleRow } from './puzzle-row'

/**
 * Parsing a band, as an interface.
 *
 * Why a port: in the app this runs in a worker, because turning 3.6 MB of CSV
 * into 10,000 validated objects is a second of solid CPU that must not land on
 * the main thread. In tests and in the CLI there is no worker, and the same
 * parsing code runs inline. Both satisfy this one interface, so the importer
 * never knows which it has.
 */

/** How many puzzles are handed over at a time. Smaller = smoother, more overhead. */
export const DEFAULT_BATCH_SIZE = 500

export interface BandParseRequest {
  readonly band: PuzzleBand
  readonly url: string
  readonly batchSize?: number | undefined
  /**
   * Skip this many data rows before emitting any.
   *
   * Why: a resumed import already has the first N rows, and re-validating them to
   * throw them away is the difference between a resume and a restart.
   */
  readonly startRow?: number | undefined
}

export interface PuzzleBatch {
  readonly band: PuzzleBand
  readonly puzzles: readonly Puzzle[]
  /** Data rows consumed so far in this band, skipped ones included. */
  readonly rowsRead: number
  /** Rows in *this* batch that failed validation; never silently dropped. */
  readonly skipped: readonly SkippedPuzzleRow[]
}

export interface BandParseSummary {
  readonly band: PuzzleBand
  readonly rowsRead: number
  readonly puzzlesParsed: number
  readonly skipped: readonly SkippedPuzzleRow[]
}

export type PuzzleBatchHandler = (batch: PuzzleBatch) => void | Promise<void>

export interface PuzzleParser {
  parseBand(
    request: BandParseRequest,
    onBatch: PuzzleBatchHandler,
    signal?: AbortSignal,
  ): Promise<Result<BandParseSummary>>
  /** Release the worker, if there is one. Safe to call twice. */
  close(): void
}

/**
 * Where the CSV text comes from; injected so tests need neither network nor
 * `Response`. Sync iterables are allowed so a fixture can be a plain array.
 */
export type CsvChunks = AsyncIterable<string> | Iterable<string>
export type CsvChunkSource = (url: string, signal?: AbortSignal) => Promise<Result<CsvChunks>>

/** Why: one place decides what "cancelled" looks like, so every layer reports it alike. */
export const cancelledError = (where: string): DomainError =>
  domainError('cancelled', 'Puzzle import was cancelled', { where })

async function* decodeResponseBody(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  try {
    for (;;) {
      if (signal?.aborted === true) return
      const chunk = await reader.read()
      if (chunk.done) break
      yield decoder.decode(chunk.value, { stream: true })
    }
    const tail = decoder.decode()
    if (tail !== '') yield tail
  } finally {
    reader.releaseLock()
  }
}

/**
 * The production source: `fetch`, streamed.
 *
 * Why streamed rather than `await response.text()`: the whole point of chunking is
 * that the first band's progress bar moves before the last band has downloaded,
 * and a service-worker cache hit streams just as well as the network does.
 */
export function createFetchChunkSource(fetchImpl: typeof fetch = fetch): CsvChunkSource {
  return async (url, signal) => {
    try {
      const response = await fetchImpl(url, signal === undefined ? {} : { signal })
      if (!response.ok) {
        return err(
          domainError('io', `Could not download ${url} (HTTP ${String(response.status)})`, {
            where: url,
          }),
        )
      }
      const body = response.body
      if (body === null) {
        const text = await response.text()
        return ok([text])
      }
      return ok(decodeResponseBody(body, signal))
    } catch (cause) {
      return err(domainError('network', `Could not download ${url}`, { where: url, cause }))
    }
  }
}

/** Why: tests and the CLI hold the whole file already; make that a one-liner. */
export function textChunkSource(
  texts: Readonly<Record<string, string>>,
  chunkSize = 64 * 1024,
): CsvChunkSource {
  return (url) => {
    const text = texts[url]
    if (text === undefined) {
      return Promise.resolve(err(domainError('not-found', `No content for ${url}`, { where: url })))
    }
    const chunks: string[] = []
    for (let index = 0; index < text.length; index += chunkSize) {
      chunks.push(text.slice(index, index + chunkSize))
    }
    return Promise.resolve(ok(chunks.length === 0 ? [''] : chunks))
  }
}

/**
 * Parse one band from a chunk source, validating every row.
 *
 * This is the only place CSV text becomes `Puzzle` values, and it is the boundary
 * the quality bar names: each row goes through `parseValid`, a row that fails is
 * reported and skipped, and the band carries on.
 */
export async function parseBandFromSource(
  source: CsvChunkSource,
  request: BandParseRequest,
  onBatch: PuzzleBatchHandler,
  signal?: AbortSignal,
): Promise<Result<BandParseSummary>> {
  const { band, url } = request
  const batchSize = request.batchSize ?? DEFAULT_BATCH_SIZE
  const startRow = request.startRow ?? 0

  const opened = await source(url, signal)
  if (!opened.ok) return opened

  const parser = new CsvStreamParser()
  // A holder, not a `let`: the flag is set inside the row loop, and the compiler
  // narrows a captured `let` to its last seen value across the `await` below.
  const header = { checked: false }
  let rowsRead = 0
  let puzzlesParsed = 0
  const allSkipped: SkippedPuzzleRow[] = []
  let pending: Puzzle[] = []
  let pendingSkipped: SkippedPuzzleRow[] = []

  const flush = async (): Promise<void> => {
    if (pending.length === 0 && pendingSkipped.length === 0) return
    const batch: PuzzleBatch = { band, puzzles: pending, rowsRead, skipped: pendingSkipped }
    pending = []
    pendingSkipped = []
    await onBatch(batch)
  }

  const consume = async (rows: readonly { values: readonly string[]; line: number }[]) => {
    for (const row of rows) {
      if (!header.checked) {
        const checked = checkPuzzleCsvHeader(row.values, `band_${band}.csv`)
        if (!checked.ok) return checked
        header.checked = true
        continue
      }
      rowsRead += 1
      if (rowsRead <= startRow) continue

      const parsed = puzzleFromCsvRow(row.values, band, row.line)
      if (parsed.ok) {
        pending.push(parsed.value)
        puzzlesParsed += 1
      } else {
        pendingSkipped.push(parsed.error)
        allSkipped.push(parsed.error)
      }
      if (pending.length >= batchSize) await flush()
    }
    return ok(undefined)
  }

  for await (const chunk of opened.value) {
    if (signal?.aborted === true) return err(cancelledError(url))
    const outcome = await consume(parser.push(chunk))
    if (!outcome.ok) return outcome
  }
  if (signal?.aborted === true) return err(cancelledError(url))

  const tail = await consume(parser.end())
  if (!tail.ok) return tail
  await flush()

  if (!header.checked) {
    return err(domainError('validation', `band_${band}.csv is empty`, { where: url }))
  }

  return ok({ band, rowsRead, puzzlesParsed, skipped: allSkipped })
}

/**
 * The inline parser: same code, this thread.
 *
 * Why it is exported rather than test-only: the CLI validator has no `Worker`, and
 * a caller that has already moved itself off the main thread (a job handler inside
 * a worker, S11) should not spawn a second one.
 */
export function createInlinePuzzleParser(source: CsvChunkSource): PuzzleParser {
  return {
    parseBand: (request, onBatch, signal) => parseBandFromSource(source, request, onBatch, signal),
    close: () => undefined,
  }
}
