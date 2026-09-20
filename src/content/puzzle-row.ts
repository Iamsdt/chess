import {
  PUZZLE_CSV_COLUMNS,
  PuzzleSchema,
  domainError,
  err,
  ok,
  parseValid,
  type Puzzle,
  type PuzzleBand,
  type PuzzleCsvColumn,
  type Result,
} from '@/domain'

import { parseBraceList } from './csv'

/**
 * One CSV row becomes one `Puzzle`, or it becomes a report.
 *
 * Why this file is deliberately dull: `Puzzle` was frozen in S03 as a rename of a
 * band-CSV row, so the only work here is turning text into the types the schema
 * already describes. Every converted value is handed to `parseValid` as
 * `unknown`; nothing is cast, and a value this file cannot convert is passed
 * through unchanged so the schema — not the converter — reports what is wrong
 * with it.
 */

/** A row that did not validate. Never dropped silently: it reaches the report. */
export interface SkippedPuzzleRow {
  readonly band: PuzzleBand
  /** 1-based line in the band file, counting the header. */
  readonly line: number
  /** The row's `id` column when it was readable, for grepping the source file. */
  readonly id: string | null
  readonly reason: string
  /** One readable line per offending field. */
  readonly details: readonly string[]
}

/** Why: `Number('')` is `0` and `Number('x')` is `NaN`; neither should reach a schema as a number. */
function toNumberish(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === '') return raw
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : raw
}

/** Why: only the two literal spellings are a boolean; anything else is the schema's problem. */
function toBooleanish(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  return raw
}

/**
 * Check the header before reading a single row.
 *
 * Why it fails the whole band rather than skipping rows: a shifted column turns
 * every row into a plausible-looking wrong puzzle, and there is no per-row
 * evidence of it.
 */
export function checkPuzzleCsvHeader(values: readonly string[], where: string): Result<void> {
  const expected = [...PUZZLE_CSV_COLUMNS]
  const actual = values.map((value) => value.trim())
  if (
    actual.length === expected.length &&
    expected.every((name, index) => actual[index] === name)
  ) {
    return ok(undefined)
  }
  return err(
    domainError('validation', `Unexpected CSV header in ${where}`, {
      where,
      details: [`expected ${expected.join(',')}`, `found ${actual.join(',')}`],
    }),
  )
}

/** Column order is pinned by `PUZZLE_CSV_COLUMNS`, so the lookup is built once. */
const COLUMN_INDEX = new Map<PuzzleCsvColumn, number>(
  PUZZLE_CSV_COLUMNS.map((name, index): [PuzzleCsvColumn, number] => [name, index]),
)

function cell(values: readonly string[], column: PuzzleCsvColumn): string {
  const index = COLUMN_INDEX.get(column)
  return index === undefined ? '' : (values[index] ?? '')
}

/**
 * Turn one validated-header row into a `Puzzle`.
 *
 * `where` reaches the user as "puzzle CSV row 42 (band_king.csv)", which is
 * enough to open the file at the line and see the bad value.
 */
export function puzzleFromCsvRow(
  values: readonly string[],
  band: PuzzleBand,
  line: number,
): Result<Puzzle, SkippedPuzzleRow> {
  const where = `band_${band}.csv row ${String(line)}`
  const id = cell(values, 'id')

  if (values.length !== PUZZLE_CSV_COLUMNS.length) {
    return err({
      band,
      line,
      id: id === '' ? null : id,
      reason: 'Wrong number of columns',
      details: [
        `expected ${String(PUZZLE_CSV_COLUMNS.length)} columns, found ${String(values.length)}`,
      ],
    })
  }

  const lichessId = cell(values, 'lichess_id').trim()
  const candidate: unknown = {
    id: cell(values, 'id'),
    fen: cell(values, 'fen'),
    solution: parseBraceList(cell(values, 'solution_ucis')),
    band: cell(values, 'category'),
    subLevel: toNumberish(cell(values, 'sub_level')),
    difficulty: cell(values, 'difficulty'),
    title: cell(values, 'title'),
    theme: cell(values, 'theme'),
    prompt: cell(values, 'prompt'),
    rating: toNumberish(cell(values, 'rating')),
    ratingLabel: cell(values, 'rating_label'),
    tags: parseBraceList(cell(values, 'tags')),
    explanation: cell(values, 'explanation'),
    active: toBooleanish(cell(values, 'active')),
    source: cell(values, 'source'),
    // `exactOptionalPropertyTypes`: an absent id is an absent key, not an empty string.
    ...(lichessId === '' ? {} : { lichessId }),
    plays: toNumberish(cell(values, 'nb_plays')),
    popularity: toNumberish(cell(values, 'popularity')),
    openingTags: parseBraceList(cell(values, 'opening_tags')),
  }

  const parsed = parseValid(PuzzleSchema, candidate, where)
  if (parsed.ok) return ok(parsed.value)

  return err({
    band,
    line,
    id: id === '' ? null : id,
    reason: parsed.error.message,
    details: parsed.error.details ?? [],
  })
}

/** Why: the import report and the CLI print the same line, so they share the formatter. */
export function formatSkippedRow(row: SkippedPuzzleRow): string {
  const id = row.id === null || row.id === '' ? '(no id)' : row.id
  const detail = row.details.length === 0 ? '' : ` — ${row.details.join('; ')}`
  return `band_${row.band}.csv:${String(row.line)} ${id}: ${row.reason}${detail}`
}
