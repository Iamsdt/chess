import { describe, expect, it } from 'vitest'

import { PUZZLE_BANDS, ok, toTimestamp, type PuzzleBand, type Result } from '@/domain'

import { getPuzzleStats, importPuzzleBands, type ImportProgress } from './import-puzzles'
import { createInlinePuzzleParser, textChunkSource } from './puzzle-parser'
import { createInMemoryPuzzleSink } from './puzzle-sink'

/**
 * The importer, against fixtures small enough to reason about.
 *
 * The 10,000 real rows are exercised in `shipped-data.test.ts` and
 * `puzzle-sink-idb.test.ts`; what is checked here is the *behaviour* the sprint
 * promises — idempotent, incremental, resumable — which needs a manifest that can
 * be bumped and a band that can be interrupted.
 */

const HEADER =
  'id,fen,solution_ucis,category,sub_level,difficulty,title,theme,prompt,rating,rating_label,tags,explanation,active,source,lichess_id,nb_plays,popularity,opening_tags'

const FEN = 'rn2k2r/pQ2nppp/2p5/8/4p1bN/P5P1/P1qP1PBP/R1B1K2R b KQkq - 2 11'

function row(band: PuzzleBand, index: number, overrides: Partial<Record<string, string>> = {}) {
  const values = [
    `lc_${band}_${String(index)}`,
    FEN,
    '"{""c2d1""}"',
    band,
    '1',
    'beginner',
    `${band} ${String(index)}`,
    'mateIn1',
    'Black to move.',
    '789',
    'Novice',
    '"{""mate"",""mateIn1""}"',
    'Mate in one.',
    'true',
    'lichess',
    `id${String(index)}`,
    '10',
    '90',
    '{}',
  ]
  const overridden = overrides.rating === undefined ? values : [...values]
  if (overrides.rating !== undefined) overridden[9] = overrides.rating
  return overridden.join(',')
}

function bandCsv(band: PuzzleBand, count: number, badRows = 0): string {
  const rows = [HEADER]
  for (let index = 0; index < count; index += 1) rows.push(row(band, index))
  for (let index = 0; index < badRows; index += 1) {
    rows.push(row(band, 1000 + index, { rating: 'not-a-rating' }))
  }
  return `${rows.join('\n')}\n`
}

const PER_BAND = 4

function fixtureFiles(bandVersions: Readonly<Record<PuzzleBand, number>>, badRows = 0) {
  const files: Record<string, string> = {
    '/quiz/index.json': JSON.stringify({ version: 1, bands: bandVersions }),
  }
  for (const band of PUZZLE_BANDS)
    files[`/quiz/band_${band}.csv`] = bandCsv(band, PER_BAND, badRows)
  return files
}

const allAtVersion = (version: number): Record<PuzzleBand, number> => ({
  pawn: version,
  knight: version,
  bishop: version,
  rook: version,
  queen: version,
  king: version,
})

function harness(files: Record<string, string>) {
  const sink = createInMemoryPuzzleSink()
  const parser = createInlinePuzzleParser(textChunkSource(files, 1024))
  const fetchJson = (url: string): Promise<Result<unknown>> => {
    const text = files[url]
    if (text === undefined) throw new Error(`no fixture for ${url}`)
    const body: unknown = JSON.parse(text)
    return Promise.resolve(ok(body))
  }
  return { sink, parser, fetchJson, now: () => toTimestamp(1_700_000_000_000) }
}

describe('importing the bands', () => {
  it('imports every band and reports progress as it goes', async () => {
    const files = fixtureFiles(allAtVersion(1))
    const { sink, parser, fetchJson, now } = harness(files)
    const progress: ImportProgress[] = []

    const result = await importPuzzleBands({
      sink,
      parser,
      fetchJson,
      now,
      onProgress: (update) => progress.push(update),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.puzzlesImported).toBe(PER_BAND * PUZZLE_BANDS.length)
    expect(result.value.bands.map((band) => band.status)).toEqual(
      PUZZLE_BANDS.map(() => 'imported'),
    )
    expect(progress[0]?.phase).toBe('manifest')
    expect(progress.at(-1)?.phase).toBe('done')
    expect(progress.some((update) => update.band === 'king')).toBe(true)
  })

  it('changes nothing when it is run again', async () => {
    const files = fixtureFiles(allAtVersion(1))
    const { sink, parser, fetchJson, now } = harness(files)

    await importPuzzleBands({ sink, parser, fetchJson, now })
    const before = new Map(sink.puzzles)

    const second = await importPuzzleBands({ sink, parser, fetchJson, now })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    // Every band was already at its manifest version, so nothing was downloaded.
    expect(second.value.bands.every((band) => band.status === 'up-to-date')).toBe(true)
    expect(second.value.puzzlesImported).toBe(0)
    expect(sink.puzzles.size).toBe(before.size)
    expect([...sink.puzzles.entries()]).toEqual([...before.entries()])
  })

  it('writes the same rows again when forced, and still does not duplicate', async () => {
    const files = fixtureFiles(allAtVersion(1))
    const { sink, parser, fetchJson, now } = harness(files)

    await importPuzzleBands({ sink, parser, fetchJson, now })
    const forced = await importPuzzleBands({ sink, parser, fetchJson, now, force: true })

    expect(forced.ok).toBe(true)
    if (!forced.ok) return
    expect(forced.value.puzzlesImported).toBe(PER_BAND * PUZZLE_BANDS.length)
    expect(sink.puzzles.size).toBe(PER_BAND * PUZZLE_BANDS.length)
  })

  it('re-imports only the band whose manifest version changed', async () => {
    const files = fixtureFiles(allAtVersion(1))
    const { sink, parser, fetchJson, now } = harness(files)
    await importPuzzleBands({ sink, parser, fetchJson, now })

    files['/quiz/index.json'] = JSON.stringify({
      version: 2,
      bands: { ...allAtVersion(1), rook: 2 },
    })
    files['/quiz/band_rook.csv'] = bandCsv('rook', PER_BAND + 1)

    const second = await importPuzzleBands({ sink, parser, fetchJson, now })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    const rook = second.value.bands.find((band) => band.band === 'rook')
    expect(rook?.status).toBe('imported')
    expect(second.value.bands.filter((band) => band.status === 'up-to-date')).toHaveLength(5)
    expect(sink.puzzles.size).toBe(PER_BAND * PUZZLE_BANDS.length + 1)
  })

  it('reports a bad row instead of dropping it, and imports the rest', async () => {
    const files = fixtureFiles(allAtVersion(1), 1)
    const { sink, parser, fetchJson, now } = harness(files)

    const result = await importPuzzleBands({ sink, parser, fetchJson, now })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.skipped).toHaveLength(PUZZLE_BANDS.length)
    expect(result.value.skipped[0]?.details.join(' ')).toContain('rating')
    expect(sink.puzzles.size).toBe(PER_BAND * PUZZLE_BANDS.length)
  })

  it('resumes a band that was cancelled part-way instead of starting it over', async () => {
    const files = fixtureFiles(allAtVersion(1))
    files['/quiz/band_pawn.csv'] = bandCsv('pawn', 10)
    const { sink, parser, fetchJson, now } = harness(files)

    const controller = new AbortController()
    const first = await importPuzzleBands({
      sink,
      parser,
      fetchJson,
      now,
      batchSize: 2,
      signal: controller.signal,
      onProgress: (update) => {
        if (update.band === 'pawn' && update.bandRowsRead >= 4) controller.abort()
      },
    })
    expect(first.ok).toBe(false)
    if (first.ok) return
    expect(first.error.code).toBe('cancelled')

    const state = await sink.readImportState()
    expect(state.ok).toBe(true)
    if (!state.ok) return
    const pawn = state.value?.bands.find((band) => band.band === 'pawn')
    expect(pawn?.complete).toBe(false)
    expect(pawn?.rowsRead).toBeGreaterThan(0)
    const readSoFar = pawn?.rowsRead ?? 0

    const second = await importPuzzleBands({ sink, parser, fetchJson, now, batchSize: 2 })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    const resumed = second.value.bands.find((band) => band.band === 'pawn')
    expect(resumed?.status).toBe('resumed')
    // Only the rows the first run had not reached were parsed the second time.
    expect(second.value.rowsRead).toBe(10 - readSoFar + PER_BAND * (PUZZLE_BANDS.length - 1))
    expect(sink.puzzles.size).toBe(10 + PER_BAND * (PUZZLE_BANDS.length - 1))
  })

  it('fails with a readable error when the manifest is missing a band', async () => {
    const files = fixtureFiles(allAtVersion(1))
    files['/quiz/index.json'] = JSON.stringify({ version: 1, bands: { pawn: 1 } })
    const { sink, parser, fetchJson, now } = harness(files)

    const result = await importPuzzleBands({ sink, parser, fetchJson, now })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('validation')
    expect(result.error.message).toContain('bands.knight')
  })
})

describe('puzzle stats', () => {
  it('counts what is actually stored, band by band', async () => {
    const files = fixtureFiles(allAtVersion(1))
    const { sink, parser, fetchJson, now } = harness(files)
    await importPuzzleBands({ sink, parser, fetchJson, now })

    const stats = await getPuzzleStats(sink)
    expect(stats.ok).toBe(true)
    if (!stats.ok) return
    expect(stats.value.total).toBe(PER_BAND * PUZZLE_BANDS.length)
    expect(stats.value.byBand.king).toBe(PER_BAND)
    expect(stats.value.byDifficulty.beginner).toBe(PER_BAND * PUZZLE_BANDS.length)
    expect(stats.value.byTheme.mateIn1).toBe(PER_BAND * PUZZLE_BANDS.length)
    expect(stats.value.complete).toBe(true)
    expect(stats.value.manifestVersion).toBe(1)
  })

  it('says nothing is imported before the first run', async () => {
    const sink = createInMemoryPuzzleSink()
    const stats = await getPuzzleStats(sink)
    expect(stats.ok).toBe(true)
    if (!stats.ok) return
    expect(stats.value.total).toBe(0)
    expect(stats.value.complete).toBe(false)
    expect(stats.value.manifestVersion).toBeNull()
  })
})
