import { Library, Swords, TriangleAlert } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { gamesRepo } from '@/data'
import type { GameRow } from '@/data'
import { CtaButton, EmptyState, PageHeader, toast } from '@/design'

import { ExportCard } from './export-card'
import { downloadFile, exportGame } from './export-service'
import { FilterBar } from './filter-bar'
import { GamesTable } from './games-table'
import { ImportCard } from './import-card'
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  matchesFilters,
  openingOptions,
  outcomeOf,
  sortRows,
  toGameFilter,
  type LibraryFilters,
  type SortColumn,
  type SortState,
} from './library-filters'
import { useGameRows, usePgnPort } from './use-library'

/**
 * S20 · My games — everything you have played or imported.
 *
 * The screen is a thin arrangement of four pieces that each hold their own state: the
 * filter bar, the virtualized table, the import panel and the export panel. Nothing here
 * parses, fetches or stores; it decides what is on screen and hands the rest to the
 * services in this folder, which is what keeps the heavy work (PGN parsing) in a worker
 * and the review work in S11's queue.
 */

const NO_ROWS: readonly GameRow[] = []

export function GamesLibraryScreen() {
  const [filters, setFilters] = useState<LibraryFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  /** Frozen at mount so a re-render cannot slide the date window under the user. */
  const [openedAt] = useState(() => Date.now())

  const gameFilter = useMemo(() => toGameFilter(filters.range, openedAt), [filters.range, openedAt])
  const { state, reload } = useGameRows(gameFilter)
  const getPort = usePgnPort()

  const rows = state.status === 'ready' ? state.rows : NO_ROWS
  const visible = useMemo(
    () =>
      sortRows(
        rows.filter((row) => matchesFilters(row, filters)),
        sort,
      ),
    [filters, rows, sort],
  )
  const openings = useMemo(() => openingOptions(rows), [rows])
  const won = useMemo(() => rows.filter((row) => outcomeOf(row) === 'won').length, [rows])
  const unreviewed = useMemo(
    () => rows.filter((row) => row.reviewState === 'not-reviewed').length,
    [rows],
  )

  const onSortChange = useCallback((column: SortColumn) => {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: column === 'opponent' || column === 'opening' ? 'asc' : 'desc' },
    )
  }, [])

  const onExportRow = useCallback(
    (row: GameRow) => {
      void exportGame(row.id, { pgn: getPort(), games: gamesRepo }).then((result) => {
        if (!result.ok) {
          toast.error('That game could not be exported', { description: result.error.message })
          return
        }
        downloadFile(`${row.id}.pgn`, result.value)
      })
    },
    [getPort],
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Library · stored in this browser"
        title="My games"
        description={
          state.status === 'loading'
            ? 'Loading your games…'
            : `${String(rows.length)} games · ${String(won)} won · ${String(unreviewed)} still to review`
        }
        actions={
          <CtaButton asChild>
            <a href="/play">
              <Swords aria-hidden className="size-[18px]" />
              New game
            </a>
          </CtaButton>
        }
      />

      <FilterBar filters={filters} onChange={setFilters} openings={openings} />

      <div className="mt-4">
        {state.status === 'error' ? (
          <p
            role="alert"
            className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive"
          >
            <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
            Your games could not be read from this browser&apos;s storage. {state.error.message}
          </p>
        ) : state.status === 'loading' ? (
          <div className="card p-6" aria-busy="true">
            <span className="sr-only">Loading games</span>
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2, 3, 4].map((line) => (
                <div key={line} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Library}
            eyebrow={rows.length === 0 ? undefined : 'When a filter finds nothing'}
            title={rows.length === 0 ? 'No games yet' : 'No games match these filters'}
            description={
              rows.length === 0
                ? 'Play one against Stockfish, or import your Lichess and Chess.com games below.'
                : 'Widen the date range or clear a chip to see more.'
            }
          />
        ) : (
          <>
            <GamesTable
              rows={visible}
              sort={sort}
              onSortChange={onSortChange}
              onExport={onExportRow}
            />
            <p className="mt-2 px-1 text-xs text-muted-foreground" aria-live="polite">
              Showing {visible.length} of {rows.length}
            </p>
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ImportCard getPort={getPort} onImported={reload} />
        <ExportCard getPort={getPort} filter={gameFilter} rows={visible} onAnalysed={reload} />
      </div>
    </div>
  )
}
