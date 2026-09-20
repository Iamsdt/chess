import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ChevronsUpDown, Cpu, Download, User } from 'lucide-react'
import { useRef } from 'react'

import type { GameRow } from '@/data'
import { Badge, Button, cn } from '@/design'
import type { GameSource, TimeControl } from '@/domain'

import {
  opponentOf,
  outcomeOf,
  yourAccuracy,
  type SortColumn,
  type SortState,
} from './library-filters'

/**
 * The games table: sortable, virtualized, and a grid rather than a `<table>`.
 *
 * Why not a real `<table>`: virtualizing means positioning rows absolutely, which a table
 * layout cannot do without collapsing. The ARIA table roles give a screen reader exactly
 * the structure the markup gave up, and the header cells still carry `aria-sort`, so the
 * semantics survive the layout change. The row count is announced with `aria-rowcount`
 * because only a window of rows is in the DOM at any moment.
 *
 * The grid keeps a minimum width and scrolls horizontally on a phone rather than hiding
 * columns: a column that disappears takes its sort control with it, and an accuracy you
 * cannot sort by is worse than one you have to scroll to.
 */

/** Row height in pixels. The virtualizer measures nothing, so this has to be honest. */
const ROW_HEIGHT = 56

const GRID =
  'grid min-w-[880px] grid-cols-[92px_minmax(0,1.6fr)_minmax(0,1.4fr)_72px_92px_116px_124px_112px] items-center gap-3 px-4'

interface ColumnSpec {
  readonly id: SortColumn
  readonly label: string
  readonly align?: 'right'
}

const COLUMNS: readonly ColumnSpec[] = [
  { id: 'result', label: 'Result' },
  { id: 'opponent', label: 'Opponent' },
  { id: 'opening', label: 'Opening' },
  { id: 'moves', label: 'Moves', align: 'right' },
  { id: 'accuracy', label: 'Accuracy', align: 'right' },
  { id: 'date', label: 'Date' },
]

const OUTCOME_BADGE = {
  won: { variant: 'soft', label: 'Won' },
  lost: { variant: 'destructive', label: 'Lost' },
  drawn: { variant: 'muted', label: 'Draw' },
  unfinished: { variant: 'outline', label: 'Unfinished' },
} as const

const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/** `null` where the source is the app itself and saying so would be noise. */
const SOURCE_LABELS: Readonly<Record<GameSource, string | null>> = {
  sparring: null,
  'friend-link': 'Friend',
  lichess: 'Lichess',
  chesscom: 'Chess.com',
  'pgn-import': 'Imported',
  analysis: 'From analysis',
}

/** The prototype's `10 + 5`, which is how players say a time control out loud. */
function formatClock(control: TimeControl): string {
  if (control.kind === 'untimed') return 'untimed'
  if (control.kind === 'correspondence') {
    return `${String(control.daysPerMove)} day${control.daysPerMove === 1 ? '' : 's'}/move`
  }
  return `${String(Math.round(control.initialMs / 60_000))} + ${String(Math.round(control.incrementMs / 1000))}`
}

/** Why relative for one day only: "2 days ago" is harder to scan than a weekday. */
function formatDate(at: number, today: number): string {
  const sameDay = new Date(at).toDateString() === new Date(today).toDateString()
  return sameDay ? 'Today' : DAY.format(at)
}

function initials(name: string): string {
  return (
    name
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || '??'
  )
}

function SortIcon({ state }: { readonly state: 'asc' | 'desc' | null }) {
  if (state === 'asc') return <ArrowUp aria-hidden className="size-3" />
  if (state === 'desc') return <ArrowDown aria-hidden className="size-3" />
  return <ChevronsUpDown aria-hidden className="size-3 opacity-40" />
}

export interface GamesTableProps {
  readonly rows: readonly GameRow[]
  readonly sort: SortState
  readonly onSortChange: (column: SortColumn) => void
  readonly onExport: (row: GameRow) => void
  /** Injected so the "Today" label is testable. */
  readonly now?: number
}

export function GamesTable({ rows, sort, onSortChange, onExport, now }: GamesTableProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const today = now ?? Date.now()

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  const items = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div
      role="table"
      aria-label="Games"
      aria-rowcount={rows.length}
      className="card overflow-hidden"
    >
      <div role="rowgroup" className="border-b bg-muted/40">
        <div role="row" className={cn(GRID, 'py-2.5 text-xs text-muted-foreground')}>
          {COLUMNS.map((column) => {
            const active = sort.column === column.id
            return (
              <div
                key={column.id}
                role="columnheader"
                aria-sort={
                  active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                }
                className={column.align === 'right' ? 'text-right' : undefined}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSortChange(column.id)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-sm font-medium transition hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                    active && 'text-foreground',
                  )}
                >
                  {column.label}
                  <SortIcon state={active ? sort.direction : null} />
                </button>
              </div>
            )
          })}
          <div role="columnheader" aria-sort="none">
            Mistakes
          </div>
          <div role="columnheader" aria-sort="none" className="text-right">
            <span className="sr-only">Actions</span>
          </div>
        </div>
      </div>

      <div ref={scrollRef} role="rowgroup" className="max-h-[560px] overflow-auto">
        <div style={{ height: `${String(totalSize)}px` }} className="relative">
          {items.map((item) => {
            const row = rows[item.index]
            if (row === undefined) return null
            const outcome = outcomeOf(row)
            const badge = OUTCOME_BADGE[outcome]
            const opponent = opponentOf(row)
            const accuracy = yourAccuracy(row)
            return (
              <div
                key={row.id}
                role="row"
                aria-rowindex={item.index + 1}
                className={cn(
                  GRID,
                  'absolute top-0 left-0 w-full border-b text-sm hover:bg-muted/40',
                )}
                style={{
                  height: `${String(ROW_HEIGHT)}px`,
                  transform: `translateY(${String(item.start)}px)`,
                }}
              >
                <div role="cell">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                <div role="cell" className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="avatar size-7 rounded-lg bg-muted text-[10px] text-muted-foreground"
                  >
                    {opponent.kind === 'engine' ? (
                      <Cpu className="size-3.5" />
                    ) : opponent.kind === 'human' ? (
                      initials(opponent.name)
                    ) : (
                      <User className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-medium">{opponent.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[
                        row.youPlay === 'white' ? 'White' : 'Black',
                        SOURCE_LABELS[row.source],
                        formatClock(row.timeControl),
                      ]
                        .filter((part): part is string => part !== null)
                        .join(' · ')}
                    </span>
                  </span>
                </div>
                <div role="cell" className="truncate text-muted-foreground">
                  {row.opening === undefined
                    ? 'Unknown opening'
                    : row.opening.variation === undefined
                      ? row.opening.name
                      : `${row.opening.name} · ${row.opening.variation}`}
                </div>
                <div role="cell" className="text-right tabular-nums">
                  {Math.ceil(row.plyCount / 2)}
                </div>
                <div role="cell" className="text-right font-medium tabular-nums">
                  {accuracy === undefined ? '—' : `${String(Math.round(accuracy))}%`}
                </div>
                <div role="cell">
                  {row.mistakeCount > 0 ? (
                    <Badge variant="cta">{row.mistakeCount} to review</Badge>
                  ) : row.reviewState === 'reviewed' ? (
                    <Badge variant="soft">Clean</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not reviewed</span>
                  )}
                </div>
                <div role="cell" className="truncate whitespace-nowrap text-muted-foreground">
                  {formatDate(row.startedAt, today)}
                </div>
                <div role="cell" className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      onExport(row)
                    }}
                    aria-label={`Download ${opponent.name} game as PGN`}
                  >
                    <Download aria-hidden />
                  </Button>
                  <a
                    href={`/games/review?id=${encodeURIComponent(row.id)}`}
                    className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-sm font-medium shadow-xs transition hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Review
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
