import { Link } from '@tanstack/react-router'
import { BookOpen, GitBranch, Plus, Repeat, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Board } from '@/board'
import { Button, cn, EmptyState, Spinner, toast } from '@/design'
import type { Color, RepertoireNodeId } from '@/domain'

import { APP_DEPS } from './deps'
import { ExplorePanel } from './explore-panel'
import { RepertoireEditor } from './repertoire-editor'
import { seedStarter, type LineSummary, type OpeningsDeps } from './service'
import { estimateMinutes, isDue, summarizeOpenings, type OpeningSummary } from './summary'
import { treeOf, useLines, useTrees } from './use-openings'

import type { LinesPort } from './pgn-lines-port'
import type { ExplorerPort } from './popularity'

export interface OpeningsScreenProps {
  readonly deps?: OpeningsDeps
  readonly explorer?: ExplorerPort
  readonly linesPort?: LinesPort
}

interface Selection {
  readonly color: Color
  readonly headId: RepertoireNodeId | null
}

/**
 * Openings (`/openings`) — ported from `prototype/openings.html`, on real data.
 *
 * - My repertoire: one card per named opening, per colour, with due lines and mastery
 * - A tree editor for the chosen opening, with PGN import and a gaps report
 * - Explore: a catalogue sourced from the ECO table, searchable and filterable
 *
 * Nothing is seeded behind the user's back: an empty repertoire shows an invitation with
 * an explicit "add a starter repertoire" button.
 */
export function OpeningsScreen({ deps = APP_DEPS, explorer, linesPort }: OpeningsScreenProps) {
  const treeSectionRef = useRef<HTMLDivElement>(null)
  const trees = useTrees()
  const whiteLines = useLines(trees?.white ?? null, deps)
  const blackLines = useLines(trees?.black ?? null, deps)
  const [activeTab, setActiveTab] = useState<'mine' | 'explore'>('mine')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [seeding, setSeeding] = useState(false)

  const at = new Date()
  const summaries =
    trees === undefined
      ? undefined
      : {
          white: trees.white === null ? [] : summarizeOpenings(trees.white, whiteLines ?? [], at),
          black: trees.black === null ? [] : summarizeOpenings(trees.black, blackLines ?? [], at),
        }

  if (trees === undefined || summaries === undefined) {
    return (
      <div className="page pb-12" aria-busy="true">
        <p className="label">Library</p>
        <h1 className="page-title mt-1">Openings</h1>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner /> Loading your repertoire
        </p>
      </div>
    )
  }

  const everyLine: readonly LineSummary[] = [...(whiteLines ?? []), ...(blackLines ?? [])]
  const dueCount = everyLine.filter((line) => isDue(line, at)).length
  const isEmpty = summaries.white.length === 0 && summaries.black.length === 0
  const owned = new Set([...summaries.white, ...summaries.black].map((item) => item.name))
  const selectedTree = selection === null ? null : treeOf(trees, selection.color)
  const selectedLines = selection?.color === 'white' ? (whiteLines ?? []) : (blackLines ?? [])
  const selectedName =
    selection === null
      ? ''
      : ([...summaries.white, ...summaries.black].find((item) => item.id === selection.headId)
          ?.name ?? `${selection.color === 'white' ? 'White' : 'Black'} repertoire`)

  const openEditor = (color: Color, headId: RepertoireNodeId | null) => {
    setActiveTab('mine')
    setSelection({ color, headId })
    window.setTimeout(() => {
      treeSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 0)
  }

  const seed = async () => {
    setSeeding(true)
    const result = await seedStarter(deps)
    setSeeding(false)
    toast(
      result.ok
        ? 'Starter repertoire added: Italian Game, London System and Caro-Kann.'
        : `Could not add the starter repertoire: ${result.error.message}`,
    )
  }

  return (
    <div className="page pb-12">
      <header className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div>
          <p className="label">Library</p>
          <h1 className="page-title mt-1">Openings</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            A repertoire you build yourself, one move at a time. Drill it until it's automatic.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="text-right text-xs leading-tight max-sm:text-left sm:text-sm">
            <div className="font-medium">
              {String(dueCount)} {dueCount === 1 ? 'line' : 'lines'} due
            </div>
            <div className="text-xs text-muted-foreground">
              {dueCount === 0
                ? 'nothing waiting'
                : `about ${String(estimateMinutes(dueCount))} min`}
            </div>
          </div>
          <Button asChild className="btn-cta h-10 sm:h-11">
            <Link to="/openings/drill">
              <Repeat className="size-[18px]" aria-hidden="true" />
              Drill due lines
            </Link>
          </Button>
        </div>
      </header>

      <div className="tabs mt-6 sm:mt-7" role="tablist" aria-label="Openings navigation">
        <button
          type="button"
          role="tab"
          id="tab-mine"
          aria-selected={activeTab === 'mine'}
          aria-controls="panel-mine"
          className={cn('tab', activeTab === 'mine' && 'is-active')}
          onClick={() => {
            setActiveTab('mine')
          }}
        >
          My repertoire
        </button>
        <button
          type="button"
          role="tab"
          id="tab-explore"
          aria-selected={activeTab === 'explore'}
          aria-controls="panel-explore"
          className={cn('tab', activeTab === 'explore' && 'is-active')}
          onClick={() => {
            setActiveTab('explore')
          }}
        >
          Explore
        </button>
      </div>

      {activeTab === 'mine' && (
        <div
          id="panel-mine"
          role="tabpanel"
          aria-labelledby="tab-mine"
          className="mt-6 space-y-6 sm:space-y-8"
        >
          {isEmpty ? (
            <EmptyState
              icon={BookOpen}
              eyebrow="Your repertoire"
              title="No openings yet"
              description="Start with a small ready-made set, import lines from a PGN, or pick openings from Explore."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    className="btn-cta"
                    disabled={seeding}
                    onClick={() => {
                      void seed()
                    }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add a starter repertoire
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      openEditor('white', null)
                    }}
                  >
                    <Upload className="size-4" aria-hidden="true" />
                    Build or import my own
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setActiveTab('explore')
                    }}
                  >
                    Browse openings
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <ColorSection
                color="white"
                items={summaries.white}
                onEdit={(id) => {
                  openEditor('white', id)
                }}
              />
              <ColorSection
                color="black"
                items={summaries.black}
                onEdit={(id) => {
                  openEditor('black', id)
                }}
              />
              <button
                type="button"
                className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground transition hover:bg-card sm:text-sm"
                onClick={() => {
                  setActiveTab('explore')
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add an opening · or import lines from a PGN in the editor
              </button>
            </>
          )}

          <div ref={treeSectionRef}>
            {selection !== null && selectedTree !== null && (
              <RepertoireEditor
                key={`${selection.color}-${selection.headId ?? 'all'}`}
                deps={deps}
                tree={selectedTree}
                headId={selection.headId}
                title={selectedName}
                lines={selectedLines}
                {...(explorer === undefined ? {} : { explorer })}
                {...(linesPort === undefined ? {} : { linesPort })}
              />
            )}
            {selection !== null && selectedTree === null && (
              <EmptyState
                icon={GitBranch}
                title="Nothing to edit yet"
                description="Add an opening from Explore, or import a PGN, and its tree appears here."
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'explore' && <ExplorePanel deps={deps} owned={owned} />}
    </div>
  )
}

function ColorSection({
  color,
  items,
  onEdit,
}: {
  readonly color: Color
  readonly items: readonly OpeningSummary[]
  readonly onEdit: (id: RepertoireNodeId) => void
}) {
  const headingId = color === 'white' ? 'w-h' : 'b-h'
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="flex items-center gap-2 text-base font-bold sm:text-lg">
        <span
          className={cn(
            'size-3 rounded-full',
            color === 'white' ? 'bg-white ring-1 ring-border' : 'bg-foreground',
          )}
          aria-hidden="true"
        />
        {color === 'white' ? 'As White' : 'As Black'}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No {color} openings yet. Add one from Explore or import a PGN.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,350px),1fr))] gap-3 sm:gap-4">
          {items.map((item) => (
            <OpeningCard key={item.id} item={item} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  )
}

function OpeningCard({
  item,
  onEdit,
}: {
  readonly item: OpeningSummary
  readonly onEdit: (id: RepertoireNodeId) => void
}) {
  return (
    <article className="card card-hover flex gap-3 p-3.5 sm:gap-4 sm:p-4">
      <div className="w-20 shrink-0 self-start overflow-hidden rounded-lg ring-1 ring-border sm:w-24 md:w-28">
        <Board
          fen={item.fen}
          orientation={item.color}
          coordinates={false}
          movable="none"
          label={`${item.name} position`}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold sm:text-base">{item.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{item.details}</p>
          </div>
          {item.dueCount > 0 ? (
            <span className="badge shrink-0 border-transparent bg-cta-soft text-xs text-cta">
              {String(item.dueCount)} due
            </span>
          ) : (
            <span className="badge shrink-0 text-xs text-muted-foreground">Up to date</span>
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-2 sm:mt-3">
          <span
            role="progressbar"
            aria-valuenow={item.masteryPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${item.name} mastery`}
            className="progress h-1.5 flex-1"
          >
            <span style={{ width: `${String(item.masteryPercent)}%` }} />
          </span>
          <span className="text-xs font-medium">{String(item.masteryPercent)}%</span>
        </div>
        <p className="mt-1 text-xs leading-tight text-muted-foreground">{item.masteryCaption}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2.5 sm:pt-3">
          <Button
            asChild
            size="sm"
            className="h-8 text-xs sm:h-9 sm:text-sm"
            variant={item.dueCount > 0 ? 'default' : 'outline'}
          >
            <Link to="/openings/drill" search={{ opening: item.id }}>
              <Repeat className="size-3.5" aria-hidden="true" />
              Drill
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs sm:h-9 sm:text-sm"
            onClick={() => {
              onEdit(item.id)
            }}
          >
            <GitBranch className="size-3.5" aria-hidden="true" />
            Edit tree
          </Button>
        </div>
      </div>
    </article>
  )
}
