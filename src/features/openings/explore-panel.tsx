import { Info, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Board } from '@/board'
import { Button, cn, Input, toast } from '@/design'
import type { Color } from '@/domain'

import { buildCatalogue, matchesQuery, type CatalogueEntry } from './library'
import { addOpening, type OpeningsDeps } from './service'

export interface ExplorePanelProps {
  readonly deps: OpeningsDeps
  /** Openings already in the repertoire, by name. */
  readonly owned: ReadonlySet<string>
}

type ColorFilter = 'all' | Color
type StyleFilter = 'any' | 'solid' | 'sharp'

/** The catalogue, with its names and codes read from the ECO table. */
export function ExplorePanel({ deps, owned }: ExplorePanelProps) {
  const catalogue = useMemo(() => buildCatalogue(), [])
  const [query, setQuery] = useState('')
  const [color, setColor] = useState<ColorFilter>('all')
  const [style, setStyle] = useState<StyleFilter>('any')
  const [busy, setBusy] = useState<string | null>(null)

  const visible = useMemo(
    () =>
      catalogue.filter(
        (entry) =>
          (color === 'all' || entry.color === color) &&
          (style === 'any' || entry.style === style) &&
          matchesQuery(entry, query),
      ),
    [catalogue, color, style, query],
  )

  const add = async (entry: CatalogueEntry) => {
    setBusy(entry.id)
    const result = await addOpening(deps, entry)
    setBusy(null)
    toast(
      result.ok
        ? `${entry.name} added to your repertoire. Open its tree to extend it.`
        : `Could not add ${entry.name}: ${result.error.message}`,
    )
  }

  return (
    <div id="panel-explore" role="tabpanel" aria-labelledby="tab-explore" className="mt-6">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="relative min-w-[200px] flex-1 sm:min-w-[220px]">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            placeholder="Search by name, ECO or moves"
            aria-label="Search openings"
            className="h-10 pl-9 text-xs sm:text-sm"
          />
        </div>
        <div className="seg text-xs" role="group" aria-label="Filter by color">
          {(['all', 'white', 'black'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={color === value}
              className={cn('h-9 px-2.5 capitalize sm:px-3', color === value && 'is-active')}
              onClick={() => {
                setColor(value)
              }}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by style">
          {(['any', 'solid', 'sharp'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={style === value}
              className={cn(
                'reply h-9 px-2.5 text-xs sm:px-3',
                style === value && 'is-active border-primary bg-accent',
              )}
              onClick={() => {
                setStyle(value)
              }}
            >
              {value === 'any' ? 'Any style' : value === 'solid' ? 'Solid' : 'Sharp'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3 sm:mt-5 sm:gap-4">
        {visible.map((entry) => {
          const isOwned = owned.has(entry.name)
          return (
            <article key={entry.id} className="card flex flex-col p-3.5 sm:p-4">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="w-18 shrink-0 self-start overflow-hidden rounded-lg ring-1 ring-border sm:w-20">
                  <Board
                    fen={entry.fen}
                    orientation={entry.color}
                    coordinates={false}
                    movable="none"
                    label={`${entry.name} position`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm leading-tight font-bold sm:text-base">{entry.name}</h3>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {entry.codeAndMoves}
                  </p>
                  <span className="badge mt-1.5 text-[11px] capitalize sm:text-xs">
                    As {entry.color}
                  </span>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:mt-4">
                <div>
                  <dt className="text-muted-foreground">Popularity</dt>
                  <dd className="mt-1 flex items-center gap-1.5">
                    <span
                      role="progressbar"
                      aria-valuenow={entry.popularity}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${entry.name} popularity`}
                      className="progress h-1.5"
                    >
                      <span style={{ width: `${String(entry.popularity)}%` }} />
                    </span>
                    {String(entry.popularity)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Difficulty</dt>
                  <dd className="mt-1 font-medium">{entry.difficulty}</dd>
                </div>
              </dl>

              <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      'badge text-[11px]',
                      tag === entry.style
                        ? 'border-transparent bg-sky text-sky-ink'
                        : 'border-transparent bg-muted text-muted-foreground',
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <Button
                size="sm"
                variant="outline"
                className="mt-3.5 h-8 self-start text-xs sm:mt-4 sm:h-9 sm:text-sm"
                disabled={isOwned || busy === entry.id}
                onClick={() => {
                  void add(entry)
                }}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {isOwned ? 'In your repertoire' : 'Add to repertoire'}
              </Button>
            </article>
          )
        })}
        {visible.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No openings match your search criteria.
          </div>
        )}
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        Names and codes come from the bundled ECO table. Popularity is how often players rated 1200
        to 1600 choose it, as an editorial estimate.
      </p>
    </div>
  )
}
