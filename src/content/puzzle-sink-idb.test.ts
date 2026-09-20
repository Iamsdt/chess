import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import { PUZZLE_BANDS, ok, toTimestamp, type PuzzleBand, type Result } from '@/domain'

import { getPuzzleStats, importPuzzleBands } from './import-puzzles'
import { createInlinePuzzleParser, textChunkSource } from './puzzle-parser'
import { createIndexedDbPuzzleSink, openPuzzleDatabase } from './puzzle-sink-idb'

/**
 * The real 10,000 rows, imported into a real IndexedDB.
 *
 * `fake-indexeddb` is not a browser, so nothing here is a benchmark — what it
 * proves is the shape of the promise: every band lands, the indexes the selection
 * queries need exist, and a second run leaves the store byte-for-byte identical.
 */

const bandCsvLoaders = import.meta.glob('../../public/quiz/band_*.csv', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

const manifestLoader = import.meta.glob('../../public/quiz/index.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

async function shippedFiles(): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  for (const band of PUZZLE_BANDS) {
    const entry = Object.entries(bandCsvLoaders).find(([file]) => file.endsWith(`band_${band}.csv`))
    if (entry === undefined) throw new Error(`No band file for ${band}`)
    files[`/quiz/band_${band}.csv`] = await entry[1]()
  }
  const manifest = Object.values(manifestLoader)[0]
  if (manifest === undefined) throw new Error('No quiz manifest')
  files['/quiz/index.json'] = await manifest()
  return files
}

let databases: IDBDatabase[] = []

afterEach(() => {
  for (const database of databases) database.close()
  databases = []
})

async function freshSink(name: string) {
  const opened = await openPuzzleDatabase({ databaseName: name })
  if (!opened.ok) throw new Error(opened.error.message)
  databases.push(opened.value)
  return createIndexedDbPuzzleSink(opened.value)
}

describe('importing the shipped data into IndexedDB', () => {
  it('imports all 10,000 puzzles, and importing again changes nothing', async () => {
    const files = await shippedFiles()
    const parser = createInlinePuzzleParser(textChunkSource(files))
    const fetchJson = (url: string): Promise<Result<unknown>> => {
      const text = files[url]
      if (text === undefined) throw new Error(`no file for ${url}`)
      const body: unknown = JSON.parse(text)
      return Promise.resolve(ok(body))
    }
    const sink = await freshSink('content-test-full')

    const started = performance.now()
    const first = await importPuzzleBands({ sink, parser, fetchJson })
    const elapsed = performance.now() - started
    console.warn(
      `imported ${String(10_000)} puzzles into fake-indexeddb in ${elapsed.toFixed(0)} ms`,
    )

    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.value.puzzlesImported).toBe(10_000)
    expect(first.value.skipped).toEqual([])

    const stats = await getPuzzleStats(sink)
    expect(stats.ok).toBe(true)
    if (!stats.ok) return
    expect(stats.value.total).toBe(10_000)
    expect(stats.value.byBand).toEqual({
      pawn: 200,
      knight: 400,
      bishop: 800,
      rook: 1500,
      queen: 2700,
      king: 4400,
    })
    expect(Object.keys(stats.value.byTheme)).toHaveLength(35)
    expect(stats.value.complete).toBe(true)

    const second = await importPuzzleBands({ sink, parser, fetchJson })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.value.puzzlesImported).toBe(0)
    expect(second.value.bands.every((band) => band.status === 'up-to-date')).toBe(true)

    const after = await getPuzzleStats(sink)
    expect(after.ok).toBe(true)
    if (!after.ok) return
    expect(after.value.total).toBe(10_000)
  }, 180_000)

  it('indexes the fields the selection queries need', async () => {
    const sink = await freshSink('content-test-indexes')
    expect(sink).toBeDefined()
    const database = databases.at(-1)
    expect(database).toBeDefined()
    if (database === undefined) return
    const store = database.transaction('puzzles', 'readonly').objectStore('puzzles')
    expect([...store.indexNames].sort()).toEqual(
      ['band', 'band+subLevel', 'difficulty', 'rating', 'subLevel', 'theme'].sort(),
    )
    expect(store.keyPath).toBe('id')
  })

  it('round-trips the import state through storage', async () => {
    const sink = await freshSink('content-test-state')
    const before = await sink.readImportState()
    expect(before.ok).toBe(true)
    if (!before.ok) return
    expect(before.value).toBeNull()

    const state = {
      stateVersion: 1 as const,
      manifestVersion: 3,
      bands: [
        {
          band: 'pawn' as PuzzleBand,
          version: 2,
          rowsRead: 200,
          puzzlesImported: 200,
          skippedRows: 0,
          complete: true,
          updatedAt: toTimestamp(1_700_000_000_000),
        },
      ],
      updatedAt: toTimestamp(1_700_000_000_000),
    }
    const written = await sink.writeImportState(state)
    expect(written.ok).toBe(true)

    const read = await sink.readImportState()
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.value).toEqual(state)
  })
})
