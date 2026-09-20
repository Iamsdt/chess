import type { GameFilter, GameRow } from '@/data'
import type { Color, EcoCode, PlayerRef, Timestamp } from '@/domain'

/**
 * What the filter bar means, as pure functions.
 *
 * Why so little of this reaches the repository: three of the five filters are about the
 * *user's* side of a game — did you win, was it an engine, what did you score — and the
 * stored row keys results by colour, not by person. Asking the database for a date range
 * (which is indexed) and deciding the rest here keeps one honest definition of "won"
 * instead of one in SQL-shaped filter objects and another in the table.
 *
 * The cost is bounded: the screen loads at most `LIBRARY_ROW_LIMIT` header rows, each a
 * few hundred bytes with no moves attached, and filtering plus sorting them is a fraction
 * of a millisecond.
 */

/** How many header rows the screen holds at once. Beyond this, narrow the date range. */
export const LIBRARY_ROW_LIMIT = 5_000

export const RESULT_FILTERS = ['all', 'won', 'lost', 'drawn'] as const
export type ResultFilter = (typeof RESULT_FILTERS)[number]

export const OPPONENT_FILTERS = ['all', 'engine', 'human', 'imported'] as const
export type OpponentFilter = (typeof OPPONENT_FILTERS)[number]

export const DATE_RANGES = ['30d', '7d', 'year', 'all'] as const
export type DateRange = (typeof DATE_RANGES)[number]

export const DATE_RANGE_LABELS: Readonly<Record<DateRange, string>> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  year: 'This year',
  all: 'All time',
}

export interface LibraryFilters {
  /** Matches either player's name or the opening, case-insensitively. */
  readonly search: string
  readonly result: ResultFilter
  readonly opponent: OpponentFilter
  /** An ECO code, or `any`. */
  readonly eco: string
  readonly range: DateRange
  /** Minimum accuracy for the side you played, or `null` for no floor. */
  readonly minAccuracy: number | null
}

export const DEFAULT_FILTERS: LibraryFilters = {
  search: '',
  result: 'all',
  opponent: 'all',
  eco: 'any',
  range: 'all',
  minAccuracy: null,
}

const DAY_MS = 86_400_000

/** Why the clock is an argument: a filter that reads `Date.now()` cannot be tested. */
export function rangeStart(range: DateRange, at: number): number | null {
  if (range === '7d') return at - 7 * DAY_MS
  if (range === '30d') return at - 30 * DAY_MS
  if (range === 'year') return Date.UTC(new Date(at).getUTCFullYear(), 0, 1)
  return null
}

/**
 * The part of the filter the index can answer: a date window, and nothing else.
 *
 * It takes the range alone rather than the whole filter object so a keystroke in the
 * search box cannot change its identity and re-run the query.
 */
export function toGameFilter(range: DateRange, at: number): GameFilter {
  const from = rangeStart(range, at)
  return from === null ? {} : { from: from as Timestamp }
}

export type Outcome = 'won' | 'lost' | 'drawn' | 'unfinished'

/** Why: "Won" on this screen always means *you* won, whichever colour you had. */
export function outcomeOf(row: Pick<GameRow, 'result' | 'youPlay'>): Outcome {
  if (row.result === '1/2-1/2') return 'drawn'
  if (row.result === '*') return 'unfinished'
  const winner: Color = row.result === '1-0' ? 'white' : 'black'
  return winner === row.youPlay ? 'won' : 'lost'
}

/** The side you were not. Every row in the table is labelled by this player. */
export function opponentOf(row: Pick<GameRow, 'white' | 'black' | 'youPlay'>): PlayerRef {
  return row.youPlay === 'white' ? row.black : row.white
}

/** Why derived: accuracy is stored per colour, and only one of them is yours. */
export function yourAccuracy(row: Pick<GameRow, 'accuracy' | 'youPlay'>): number | undefined {
  return row.accuracy === undefined ? undefined : row.accuracy[row.youPlay]
}

const IMPORTED_SOURCES = new Set<GameRow['source']>(['lichess', 'chesscom', 'pgn-import'])

export function matchesFilters(row: GameRow, filters: LibraryFilters): boolean {
  if (filters.result !== 'all' && outcomeOf(row) !== filters.result) return false

  if (filters.opponent !== 'all') {
    const opponent = opponentOf(row)
    if (filters.opponent === 'imported' && !IMPORTED_SOURCES.has(row.source)) return false
    if (filters.opponent === 'engine' && opponent.kind !== 'engine') return false
    if (filters.opponent === 'human' && opponent.kind !== 'human') return false
  }

  if (filters.eco !== 'any' && row.opening?.eco !== filters.eco) return false

  if (filters.minAccuracy !== null) {
    const accuracy = yourAccuracy(row)
    if (accuracy === undefined || accuracy < filters.minAccuracy) return false
  }

  const needle = filters.search.trim().toLowerCase()
  if (needle !== '') {
    const haystack =
      `${row.white.name} ${row.black.name} ${row.opening?.name ?? ''} ${row.opening?.variation ?? ''}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }
  return true
}

export const SORT_COLUMNS = ['date', 'result', 'opponent', 'opening', 'moves', 'accuracy'] as const
export type SortColumn = (typeof SORT_COLUMNS)[number]
export type SortDirection = 'asc' | 'desc'

export interface SortState {
  readonly column: SortColumn
  readonly direction: SortDirection
}

export const DEFAULT_SORT: SortState = { column: 'date', direction: 'desc' }

const OUTCOME_ORDER: Readonly<Record<Outcome, number>> = {
  won: 3,
  drawn: 2,
  lost: 1,
  unfinished: 0,
}

/** Why `-1` and not `undefined`: a game with no accuracy sorts last, not unpredictably. */
function sortKey(row: GameRow, column: SortColumn): number | string {
  if (column === 'date') return row.startedAt
  if (column === 'result') return OUTCOME_ORDER[outcomeOf(row)]
  if (column === 'opponent') return opponentOf(row).name.toLowerCase()
  if (column === 'opening') return (row.opening?.name ?? '').toLowerCase()
  if (column === 'moves') return row.plyCount
  return yourAccuracy(row) ?? -1
}

/** A stable sort: `Array.prototype.sort` is stable, and ties keep the newest game first. */
export function sortRows(rows: readonly GameRow[], sort: SortState): GameRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => {
    const a = sortKey(left, sort.column)
    const b = sortKey(right, sort.column)
    if (a === b) return right.startedAt - left.startedAt
    return (
      (typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : a < b ? -1 : 1) * sign
    )
  })
}

export interface OpeningOption {
  readonly eco: EcoCode
  readonly name: string
  readonly count: number
}

/** The opening chips are built from the library itself, so they never offer an empty set. */
export function openingOptions(rows: readonly GameRow[], limit = 5): OpeningOption[] {
  const counts = new Map<string, OpeningOption>()
  for (const row of rows) {
    const eco = row.opening?.eco
    if (eco === undefined) continue
    const existing = counts.get(eco)
    counts.set(eco, {
      eco,
      name: existing?.name ?? row.opening?.name ?? eco,
      count: (existing?.count ?? 0) + 1,
    })
  }
  return [...counts.values()].sort((left, right) => right.count - left.count).slice(0, limit)
}
