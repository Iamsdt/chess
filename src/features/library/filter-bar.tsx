import { Download, Cpu, Search, Users } from 'lucide-react'
import { useId } from 'react'

import { cn } from '@/design'

import {
  DATE_RANGES,
  DATE_RANGE_LABELS,
  OPPONENT_FILTERS,
  RESULT_FILTERS,
  type LibraryFilters,
  type OpeningOption,
  type OpponentFilter,
} from './library-filters'

import type { LucideIcon } from 'lucide-react'

/**
 * The filter bar.
 *
 * Built from native controls on purpose: a segmented control is a radio group, a chip row
 * is a radio group, and a date range is a `<select>`. Doing it that way means the whole
 * bar is keyboard-reachable and announced correctly without a line of ARIA plumbing
 * beyond the roles themselves.
 */

const RESULT_LABELS: Readonly<Record<(typeof RESULT_FILTERS)[number], string>> = {
  all: 'All',
  won: 'Won',
  lost: 'Lost',
  drawn: 'Drawn',
}

const OPPONENT_LABELS: Readonly<
  Record<OpponentFilter, { readonly label: string; readonly icon?: LucideIcon }>
> = {
  all: { label: 'All' },
  engine: { label: 'Stockfish', icon: Cpu },
  human: { label: 'People', icon: Users },
  imported: { label: 'Imported', icon: Download },
}

export interface FilterBarProps {
  readonly filters: LibraryFilters
  readonly onChange: (filters: LibraryFilters) => void
  readonly openings: readonly OpeningOption[]
}

function Chip({
  active,
  label,
  icon: Icon,
  onSelect,
}: {
  readonly active: boolean
  readonly label: string
  readonly icon?: LucideIcon | undefined
  readonly onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        active ? 'border-primary bg-accent text-accent-foreground' : 'bg-card hover:bg-muted',
      )}
    >
      {Icon === undefined ? null : <Icon aria-hidden className="size-3" />}
      {label}
    </button>
  )
}

export function FilterBar({ filters, onChange, openings }: FilterBarProps) {
  const searchId = useId()
  const rangeId = useId()

  return (
    <section className="card mt-6 p-4" aria-label="Filter games">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <label htmlFor={searchId} className="sr-only">
            Search games
          </label>
          <input
            id={searchId}
            type="search"
            className="input pl-9"
            placeholder="Search opponent or opening…"
            value={filters.search}
            onChange={(event) => {
              onChange({ ...filters, search: event.target.value })
            }}
          />
        </div>

        <div className="seg" role="radiogroup" aria-label="Result">
          {RESULT_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filters.result === value}
              className={filters.result === value ? 'is-active' : undefined}
              onClick={() => {
                onChange({ ...filters, result: value })
              }}
            >
              {RESULT_LABELS[value]}
            </button>
          ))}
        </div>

        <label htmlFor={rangeId} className="sr-only">
          Date range
        </label>
        <select
          id={rangeId}
          className="input w-auto pr-8"
          value={filters.range}
          onChange={(event) => {
            const range = DATE_RANGES.find((value) => value === event.target.value)
            if (range !== undefined) onChange({ ...filters, range })
          }}
        >
          {DATE_RANGES.map((range) => (
            <option key={range} value={range}>
              {DATE_RANGE_LABELS[range]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="label mr-1" id="library-opponent-label">
          Opponent
        </span>
        <div
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-labelledby="library-opponent-label"
        >
          {OPPONENT_FILTERS.map((value) => (
            <Chip
              key={value}
              active={filters.opponent === value}
              label={OPPONENT_LABELS[value].label}
              icon={OPPONENT_LABELS[value].icon}
              onSelect={() => {
                onChange({ ...filters, opponent: value })
              }}
            />
          ))}
        </div>

        <span aria-hidden className="mx-1 h-5 w-px bg-border max-sm:hidden" />

        <span className="label mr-1" id="library-opening-label">
          Opening
        </span>
        <div
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-labelledby="library-opening-label"
        >
          <Chip
            active={filters.eco === 'any'}
            label="Any"
            onSelect={() => {
              onChange({ ...filters, eco: 'any' })
            }}
          />
          {openings.map((opening) => (
            <Chip
              key={opening.eco}
              active={filters.eco === opening.eco}
              label={`${opening.name} (${String(opening.count)})`}
              onSelect={() => {
                onChange({ ...filters, eco: opening.eco })
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
