import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowUpDown, ChevronDown, Flag, Palette, Star, TriangleAlert } from 'lucide-react'
import { useContext, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Button, cn, EmptyState, SimpleTooltip, Skeleton, toast } from '@/design'

import { drillStatsText } from './drill-copy'
import { EMPTY_ENDGAME_RECORD, masteredCount, type EndgameRecords } from './drill-records'
import {
  ENDGAME_CATEGORIES,
  ENDGAME_CATEGORY_LABELS,
  ENDGAME_DRILLS,
  type EndgameCategory,
  type EndgameDrill,
} from './endgame-drills'
import { EndgameWorkspace } from './endgame-workspace'
import { useDrillPorts } from './ports'
import { useDrillRecords } from './use-drill-records'

import type { DrillOutcome } from './endgame-session'

const FIRST_DRILL: EndgameDrill | undefined = ENDGAME_DRILLS.find((d) => d.id === 'kr-vs-k')

interface DrillListSectionProps {
  readonly category: EndgameCategory
  readonly records: EndgameRecords
  readonly activeId: string
  readonly onSelect: (drill: EndgameDrill) => void
}

function DrillListSection({ category, records, activeId, onSelect }: DrillListSectionProps) {
  return (
    <>
      <p className="eyebrow px-2 pt-3 pb-1 first:pt-2">{ENDGAME_CATEGORY_LABELS[category]}</p>
      {ENDGAME_DRILLS.filter((drill) => drill.category === category).map((drill) => {
        const record = records[drill.id] ?? EMPTY_ENDGAME_RECORD
        const isActive = drill.id === activeId
        return (
          <button
            key={drill.id}
            type="button"
            aria-pressed={isActive}
            className={`flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors sm:px-2 sm:text-sm ${
              isActive ? 'bg-cta-soft font-semibold ring-1 ring-cta/30' : 'hover:bg-muted/60'
            }`}
            onClick={() => {
              onSelect(drill)
            }}
          >
            <span className="min-w-0 flex-1">
              <span className="block">{drill.title}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {drillStatsText(drill, record)}
              </span>
            </span>
            {record.stars > 0 ? (
              <span
                className="flex text-reward"
                role="img"
                aria-label={`${String(record.stars)} of 3 stars`}
              >
                {[1, 2, 3].map((starIndex) => (
                  <Star
                    key={starIndex}
                    className={`size-3.5 ${
                      starIndex <= record.stars
                        ? 'fill-reward text-reward'
                        : 'text-muted-foreground/30'
                    }`}
                    aria-hidden="true"
                  />
                ))}
              </span>
            ) : null}
            {record.attempts === 0 ? (
              <span className="badge px-1.5 text-[10px] text-muted-foreground">New</span>
            ) : null}
          </button>
        )
      })}
    </>
  )
}

function LoadingBody() {
  return (
    <div
      className="grid gap-4 p-3 sm:gap-5 sm:p-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:p-6 2xl:grid-cols-[240px_minmax(0,1fr)]"
      role="status"
      aria-label="Loading your drills"
    >
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="aspect-square w-full max-w-[620px] justify-self-center rounded-xl" />
    </div>
  )
}

/**
 * S18 · Endgame Drills (`/drills/endgames`) — ported from `prototype/endgames.html`.
 *
 * Technique practice against Stockfish at full strength:
 * - a real board: the rules decide what is legal, the engine answers each move
 * - par, attempts, best and stars come from the stored records, never from constants
 * - the verdict (mate, promotion, draw, failure) is judged by `endgame-session.ts`
 */
export function EndgamesScreen() {
  const ports = useDrillPorts()
  const records = useDrillRecords(ports.records.readEndgames)
  const [activeId, setActiveId] = useState<string>(FIRST_DRILL?.id ?? ENDGAME_DRILLS[0]?.id ?? '')
  const [flipped, setFlipped] = useState(false)
  const [restarts, setRestarts] = useState(0)
  const chatPanel = useContext(ChatPanelContext)
  const isChatOpen = chatPanel?.isOpen ?? false

  const activeDrill = ENDGAME_DRILLS.find((drill) => drill.id === activeId) ?? ENDGAME_DRILLS[0]

  const handleSelect = (drill: EndgameDrill) => {
    setActiveId(drill.id)
    setFlipped(false)
  }

  const handleFinished = (drill: EndgameDrill, outcome: DrillOutcome) => {
    void ports.records.recordEndgame(drill.id, outcome).then((result) => {
      if (result.ok) records.adopt(result.value)
      else toast('Your result could not be saved')
    })
  }

  const readyRecords = records.state.status === 'ready' ? records.state.records : null

  return (
    <main className="min-h-full">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-1.5 border-b bg-background/85 px-3 backdrop-blur sm:gap-2 sm:px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="h-9 px-2 text-xs sm:px-3 sm:text-sm">
          <Link to="/learn">
            <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
            <span className="max-sm:hidden">Learn</span>
          </Link>
        </Button>
        <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />
        <h1
          aria-label="Endgame drills"
          className="flex min-w-0 items-center gap-1.5 text-sm font-bold sm:gap-2 sm:text-base"
        >
          <Flag className="size-4 shrink-0 text-cta" aria-hidden="true" />
          <span className="truncate">Endgame drills</span>
        </h1>
        {readyRecords !== null && activeDrill !== undefined ? (
          <div className="relative ml-1 sm:ml-2">
            <select
              value={activeDrill.id}
              onChange={(e) => {
                const found = ENDGAME_DRILLS.find((d) => d.id === e.target.value)
                if (found) handleSelect(found)
              }}
              aria-label="Choose endgame drill"
              className="cursor-pointer appearance-none rounded-lg border bg-card py-1 pl-2.5 pr-7 text-xs font-semibold shadow-xs hover:bg-muted/60 focus:outline-hidden focus:ring-1 focus:ring-ring sm:text-sm"
            >
              {ENDGAME_CATEGORIES.map((category) => (
                <optgroup key={category} label={ENDGAME_CATEGORY_LABELS[category]}>
                  {ENDGAME_DRILLS.filter((d) => d.category === category).map((drill) => (
                    <option key={drill.id} value={drill.id}>
                      {drill.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        ) : null}
        {readyRecords !== null ? (
          <span className="badge max-sm:hidden">
            {String(masteredCount(readyRecords))} of {String(ENDGAME_DRILLS.length)} mastered
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <SimpleTooltip content="Flip board orientation">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs sm:px-3 sm:text-sm"
              onClick={() => {
                setFlipped((value) => !value)
              }}
              aria-label="Flip board"
            >
              <ArrowUpDown className="mr-1 size-4" aria-hidden="true" />
              <span className="max-sm:hidden">Flip</span>
            </Button>
          </SimpleTooltip>
          <SimpleTooltip content="Board and piece settings">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="size-8 shrink-0 px-0 sm:size-9"
              aria-label="Board and piece settings"
            >
              <Link to="/settings">
                <Palette className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </SimpleTooltip>
        </div>
      </header>

      {records.state.status === 'loading' ? <LoadingBody /> : null}

      {records.state.status === 'error' ? (
        <div className="p-3 sm:p-4 lg:p-6">
          <EmptyState
            icon={TriangleAlert}
            title="Your drills could not be opened"
            description={records.state.message}
            action={
              <Button type="button" variant="outline" onClick={records.reload}>
                Try again
              </Button>
            }
          />
        </div>
      ) : null}

      {/* Main Container: Left Nav, Board, Drill Details (Side-by-side, no vertical scroll) */}
      {readyRecords !== null && activeDrill !== undefined ? (
        <div className="flex h-[calc(100dvh-56px)] flex-col gap-4 overflow-hidden p-3 sm:p-4 lg:flex-row lg:gap-5 lg:p-6">
          {/* Column 1: Drill Navigation */}
          <nav
            className={cn(
              'card h-full max-h-[calc(100dvh-56px-32px)] w-full overflow-y-auto shrink-0 max-lg:order-3 lg:w-52 xl:w-56',
              isChatOpen && 'hidden 2xl:flex',
            )}
            aria-label="Endgame drills list"
          >
            <div className="sticky top-0 z-1 border-b bg-card px-3.5 py-2.5 sm:px-4 sm:py-3">
              <h2 className="text-sm font-bold">All drills</h2>
              <p className="text-xs text-muted-foreground">Stars for beating par</p>
            </div>
            <div className="space-y-1 p-2">
              {ENDGAME_CATEGORIES.map((category) => (
                <DrillListSection
                  key={category}
                  category={category}
                  records={readyRecords}
                  activeId={activeDrill.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </nav>

          <EndgameWorkspace
            key={`${activeDrill.id}:${String(restarts)}`}
            drill={activeDrill}
            record={readyRecords[activeDrill.id] ?? EMPTY_ENDGAME_RECORD}
            flipped={flipped}
            onFinished={handleFinished}
            onRestart={() => {
              setRestarts((value) => value + 1)
              toast('Drill restarted from the first move')
            }}
          />
        </div>
      ) : null}
    </main>
  )
}
