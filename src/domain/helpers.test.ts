import { describe, expect, it } from 'vitest'

import quizManifest from '../../public/quiz/index.json'

import { scoreToWhiteCentipawns, MATE_SCORE_CP } from './engine'
import { MOVE_QUALITIES, PUZZLE_BANDS } from './enums'
import { makeJob, makePuzzle } from './fixtures'
import { emptyMoveQualityCounts } from './game'
import { isJobActive } from './jobs'
import { positionKeyFromFen } from './openings'
import { PUZZLE_CSV_COLUMNS, PuzzleSchema, lichessPuzzleUrl, puzzleUserMoves } from './puzzle'

/**
 * The real band files, loaded as text. Why against the shipped data rather than a
 * copy: `Puzzle` exists to be a rename of a CSV row, and the only way that claim
 * stays true is to check it against the file the importer will actually read.
 */
const bandCsvLoaders = import.meta.glob('../../public/quiz/band_*.csv', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

describe('Puzzle ↔ the Lichess band CSVs', () => {
  it('lists the real header of every shipped band, in file order', async () => {
    const loaded = Object.entries(bandCsvLoaders)
    expect(loaded).toHaveLength(PUZZLE_BANDS.length)
    for (const [file, load] of loaded) {
      const csv = await load()
      const header = csv.slice(0, csv.indexOf('\n')).trim().split(',')
      expect(header, file).toEqual([...PUZZLE_CSV_COLUMNS])
    }
  })

  it('names a band file for every band in the manifest, and no others', () => {
    expect(Object.keys(quizManifest.bands).sort()).toEqual([...PUZZLE_BANDS].sort())
    for (const band of PUZZLE_BANDS) {
      expect(Object.keys(bandCsvLoaders).some((file) => file.endsWith(`band_${band}.csv`))).toBe(
        true,
      )
    }
  })

  it('accepts a puzzle built straight from a CSV row', () => {
    expect(PuzzleSchema.safeParse(makePuzzle()).success).toBe(true)
  })

  it('splits the solution into the user moves and the forced replies', () => {
    const puzzle = makePuzzle()
    expect(puzzle.solution).toHaveLength(3)
    expect(puzzleUserMoves(puzzle)).toEqual(['f6f3', 'f3e2'])
  })

  it('gives the attribution link the licence requires', () => {
    expect(lichessPuzzleUrl(makePuzzle())).toBe('https://lichess.org/training/pTK5y')
  })

  it('returns no link for a puzzle that did not come from Lichess', () => {
    expect(lichessPuzzleUrl(makePuzzle({ source: 'pack', lichessId: undefined }))).toBeNull()
  })
})

describe('scoreToWhiteCentipawns', () => {
  it('keeps a centipawn score when White is to move and flips it when Black is', () => {
    expect(scoreToWhiteCentipawns({ kind: 'cp', value: 34 }, 'white')).toBe(34)
    expect(scoreToWhiteCentipawns({ kind: 'cp', value: 34 }, 'black')).toBe(-34)
  })

  it('puts a mate above every centipawn score', () => {
    const mateInTwo = scoreToWhiteCentipawns({ kind: 'mate', moves: 2 }, 'white')
    expect(mateInTwo).toBeGreaterThan(scoreToWhiteCentipawns({ kind: 'cp', value: 5_000 }, 'white'))
    expect(mateInTwo).toBe(MATE_SCORE_CP - 2)
  })

  it('orders a faster mate ahead of a slower one', () => {
    expect(scoreToWhiteCentipawns({ kind: 'mate', moves: 1 }, 'white')).toBeGreaterThan(
      scoreToWhiteCentipawns({ kind: 'mate', moves: 6 }, 'white'),
    )
  })

  it('reads a negative mate as getting mated', () => {
    expect(scoreToWhiteCentipawns({ kind: 'mate', moves: -3 }, 'white')).toBe(-MATE_SCORE_CP + 3)
    expect(scoreToWhiteCentipawns({ kind: 'mate', moves: -3 }, 'black')).toBe(MATE_SCORE_CP - 3)
  })
})

describe('emptyMoveQualityCounts', () => {
  it('has a zero for every quality, so a missing key never reads as a zero', () => {
    const counts = emptyMoveQualityCounts()
    expect(Object.keys(counts).sort()).toEqual([...MOVE_QUALITIES].sort())
    expect(Object.values(counts).every((count) => count === 0)).toBe(true)
  })
})

describe('positionKeyFromFen', () => {
  it('drops the move counters so two move orders collide', () => {
    const viaOne = positionKeyFromFen(
      'rnbqkbnr/pp2pppp/2p5/3pP3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3',
    )
    const viaAnother = positionKeyFromFen(
      'rnbqkbnr/pp2pppp/2p5/3pP3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 4 7',
    )
    expect(viaOne).toBe(viaAnother)
  })

  it('keeps positions apart when the side to move differs', () => {
    expect(positionKeyFromFen('8/8/8/8/8/8/8/K6k w - - 0 1')).not.toBe(
      positionKeyFromFen('8/8/8/8/8/8/8/K6k b - - 0 1'),
    )
  })
})

describe('isJobActive', () => {
  it.each([
    ['queued', true],
    ['running', true],
    ['succeeded', false],
    ['failed', false],
    ['cancelled', false],
    ['quarantined', false],
  ] as const)('reports %s as %s', (state, expected) => {
    expect(isJobActive(makeJob({ state }))).toBe(expected)
  })
})
