import { describe, expect, it } from 'vitest'

import { PUZZLE_CSV_COLUMNS, lichessPuzzleUrl } from '@/domain'

import { checkPuzzleCsvHeader, formatSkippedRow, puzzleFromCsvRow } from './puzzle-row'

/** A real row of `band_pawn.csv`, split as the reader hands it over. */
const REAL_ROW = [
  'lc_DGEyG',
  'rn2k2r/pQ2nppp/2p5/8/4p1bN/P5P1/P1qP1PBP/R1B1K2R b KQkq - 2 11',
  '{"c2d1"}',
  'pawn',
  '1',
  'beginner',
  'Pawn 1 · Mate In1',
  'mateIn1',
  'Black to move.',
  '789',
  'Novice',
  '{"mate","mateIn1","oneMove","opening"}',
  'Checkmate in one — find the single move that ends the game immediately.',
  'true',
  'lichess',
  'DGEyG',
  '6400',
  '95',
  '{"Kings_Pawn_Game","Kings_Pawn_Game_Other_variations"}',
]

const rowWith = (column: (typeof PUZZLE_CSV_COLUMNS)[number], value: string): string[] => {
  const index = PUZZLE_CSV_COLUMNS.indexOf(column)
  const values = [...REAL_ROW]
  values[index] = value
  return values
}

describe('the CSV header', () => {
  it('accepts the shipped header', () => {
    expect(checkPuzzleCsvHeader([...PUZZLE_CSV_COLUMNS], 'band_pawn.csv').ok).toBe(true)
  })

  it('rejects a shifted column rather than importing 10,000 wrong puzzles', () => {
    const shifted = [...PUZZLE_CSV_COLUMNS].reverse()
    const result = checkPuzzleCsvHeader(shifted, 'band_pawn.csv')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('validation')
  })
})

describe('a CSV row becomes a puzzle', () => {
  it('converts every column', () => {
    const result = puzzleFromCsvRow(REAL_ROW, 'pawn', 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const puzzle = result.value
    expect(puzzle.id).toBe('lc_DGEyG')
    expect(puzzle.solution).toEqual(['c2d1'])
    expect(puzzle.band).toBe('pawn')
    expect(puzzle.subLevel).toBe(1)
    expect(puzzle.rating).toBe(789)
    expect(puzzle.tags).toEqual(['mate', 'mateIn1', 'oneMove', 'opening'])
    expect(puzzle.active).toBe(true)
    expect(puzzle.plays).toBe(6400)
    expect(puzzle.popularity).toBe(95)
    expect(puzzle.openingTags).toHaveLength(2)
  })

  it('keeps the attribution the licence asks for', () => {
    const result = puzzleFromCsvRow(REAL_ROW, 'pawn', 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.source).toBe('lichess')
    expect(lichessPuzzleUrl(result.value)).toBe('https://lichess.org/training/DGEyG')
  })

  it('leaves the id off when the column is empty rather than inventing one', () => {
    const result = puzzleFromCsvRow(rowWith('lichess_id', ''), 'pawn', 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.lichessId).toBeUndefined()
    expect(lichessPuzzleUrl(result.value)).toBeNull()
  })

  it.each([
    ['fen', 'not a fen'],
    ['sub_level', '11'],
    ['rating', 'high'],
    ['category', 'elephant'],
    ['difficulty', 'impossible'],
    ['active', 'yes'],
    ['solution_ucis', '{}'],
    ['popularity', '900'],
  ] as const)('reports a bad %s instead of dropping the row', (column, value) => {
    const result = puzzleFromCsvRow(rowWith(column, value), 'pawn', 42)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.line).toBe(42)
    expect(result.error.id).toBe('lc_DGEyG')
    expect(result.error.details.length).toBeGreaterThan(0)
    expect(formatSkippedRow(result.error)).toContain('band_pawn.csv:42')
  })

  it('reports a row with the wrong number of columns', () => {
    const result = puzzleFromCsvRow(['lc_1', 'x'], 'rook', 7)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.reason).toBe('Wrong number of columns')
  })
})
