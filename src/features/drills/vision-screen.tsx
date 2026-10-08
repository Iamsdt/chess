import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Crosshair,
  EyeOff,
  RotateCcw,
  Route,
  ScanEye,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'

import { VisualizationDialog } from '@/coach/visualization'
import { Button, EmptyState, SimpleTooltip, Skeleton, toast } from '@/design'
import type { Color } from '@/domain'

import { BlindfoldRound } from './blindfold-round'
import { ChecksRound } from './checks-round'
import { modeBestText } from './drill-copy'
import { VISION_MODES, type VisionMode } from './drill-records'
import { KnightRound } from './knight-round'
import { useDrillPorts } from './ports'
import { SquareRound } from './square-round'
import { useDrillRecords } from './use-drill-records'
import { MODE_BLURBS, MODE_TITLES, roundLabel } from './vision-modes'

interface ModeCard {
  readonly icon: LucideIcon
  /** Token classes for the icon tile, so the cards keep the prototype's colours. */
  readonly tile: string
  readonly shape: string
}

const MODE_CARDS: Readonly<Record<VisionMode, ModeCard>> = {
  square: { icon: ScanEye, tile: 'bg-reward-soft text-reward-ink', shape: 'rounded-xl' },
  checks: { icon: Crosshair, tile: 'bg-cta-soft text-cta', shape: 'rounded-xl' },
  knight: { icon: Route, tile: 'bg-sky text-sky-ink', shape: 'rounded-lg' },
  blindfold: { icon: EyeOff, tile: 'bg-lilac text-lilac-ink', shape: 'rounded-xl' },
}

function LoadingBody() {
  return (
    <div
      className="grid gap-4 p-3 sm:gap-5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_360px]"
      role="status"
      aria-label="Loading your scores"
    >
      <Skeleton className="aspect-square w-full max-w-[560px] justify-self-center rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

/**
 * S18 · Board Vision Drills (`/drills/vision`) — ported from `prototype/vision.html`.
 *
 * Four timed drills on one screen, each a round with a clock, a score and a stored best:
 * - Name the square: coordinates hidden, one square circled
 * - Find all checks: every checking move in a position
 * - Knight route: the fewest jumps, validated by breadth-first search
 * - Blindfold move: a move list, a hidden board, one piece to follow
 */
export function VisionScreen() {
  const ports = useDrillPorts()
  const records = useDrillRecords(ports.records.readVision)
  const [mode, setMode] = useState<VisionMode>('square')
  const [orientation, setOrientation] = useState<Color>('white')
  const [rounds, setRounds] = useState(0)
  const [trainOpen, setTrainOpen] = useState(false)

  const handleComplete = (finished: VisionMode, score: number) => {
    void ports.records.recordVision(finished, score).then((result) => {
      if (result.ok) records.adopt(result.value)
      else toast('Your score could not be saved')
    })
  }

  const handleRestart = () => {
    setRounds((value) => value + 1)
    toast('Restarted. Fresh round.')
  }

  const ready = records.state.status === 'ready' ? records.state.records : null
  const roundKey = `${mode}:${String(rounds)}`

  return (
    <main className="min-h-full">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-1.5 border-b bg-background/85 px-3 backdrop-blur sm:gap-2 sm:px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="h-9 px-2 text-xs sm:px-3 sm:text-sm">
          <Link to="/puzzles">
            <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
            <span className="max-sm:hidden">Puzzles</span>
          </Link>
        </Button>
        <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />
        <h1
          aria-label="Board vision"
          className="flex min-w-0 items-center gap-1.5 text-sm font-bold sm:gap-2 sm:text-base"
        >
          <ScanEye className="size-4 shrink-0 text-cta" aria-hidden="true" />
          <span className="truncate">{MODE_TITLES[mode]}</span>
        </h1>
        <span className="badge max-sm:hidden">{roundLabel(mode)}</span>
        <div className="ml-auto flex items-center gap-1">
          <div className="seg text-xs max-sm:hidden" aria-label="Board orientation" role="group">
            <button
              type="button"
              className={orientation === 'white' ? 'is-active' : ''}
              onClick={() => {
                setOrientation('white')
              }}
            >
              As White
            </button>
            <button
              type="button"
              className={orientation === 'black' ? 'is-active' : ''}
              onClick={() => {
                setOrientation('black')
              }}
            >
              As Black
            </button>
          </div>
          <SimpleTooltip content="Restart drill">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Restart drill"
              className="h-9 px-2 text-xs text-muted-foreground sm:px-3 sm:text-sm"
              onClick={handleRestart}
            >
              <RotateCcw className="mr-1 size-4" aria-hidden="true" />
              <span className="max-sm:hidden">Restart</span>
            </Button>
          </SimpleTooltip>
        </div>
      </header>

      {/* Sage's ladder sits above the four drills: the next rungs once they feel easy. */}
      <section
        aria-labelledby="train-h"
        data-slot="train-with-sage"
        className="card mx-3 mt-3 flex items-center gap-3 p-4 sm:mx-4 sm:mt-4 lg:mx-6 lg:mt-6"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lilac text-lilac-ink">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="train-h" className="font-display text-base font-bold sm:text-lg">
            Train with Sage
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Five short exercises that take the board away step by step, and adapt to you.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setTrainOpen(true)
          }}
        >
          Open the ladder
        </Button>
      </section>
      <VisualizationDialog mode="ladder" open={trainOpen} onOpenChange={setTrainOpen} />

      {records.state.status === 'loading' ? <LoadingBody /> : null}

      {records.state.status === 'error' ? (
        <div className="p-3 sm:p-4 lg:p-6">
          <EmptyState
            icon={TriangleAlert}
            title="Your scores could not be opened"
            description={records.state.message}
            action={
              <Button type="button" variant="outline" onClick={records.reload}>
                Try again
              </Button>
            }
          />
        </div>
      ) : null}

      {ready !== null ? (
        <>
          {/* Main Grid: Board & Drill Controls */}
          <div className="grid gap-4 p-3 sm:gap-5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            {mode === 'square' ? (
              <SquareRound
                key={roundKey}
                orientation={orientation}
                record={ready.square}
                onComplete={(score) => {
                  handleComplete('square', score)
                }}
              />
            ) : null}
            {mode === 'checks' ? (
              <ChecksRound
                key={roundKey}
                orientation={orientation}
                record={ready.checks}
                onComplete={(score) => {
                  handleComplete('checks', score)
                }}
              />
            ) : null}
            {mode === 'knight' ? (
              <KnightRound
                key={roundKey}
                orientation={orientation}
                record={ready.knight}
                onComplete={(score) => {
                  handleComplete('knight', score)
                }}
              />
            ) : null}
            {mode === 'blindfold' ? (
              <BlindfoldRound
                key={roundKey}
                orientation={orientation}
                record={ready.blindfold}
                onComplete={(score) => {
                  handleComplete('blindfold', score)
                }}
              />
            ) : null}
          </div>

          {/* More Vision Drills Section */}
          <section className="px-3 pb-8 sm:px-4 lg:px-6" aria-labelledby="drills-h">
            <h2 id="drills-h" className="font-display text-lg font-bold sm:text-xl">
              More vision drills
            </h2>
            <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
              {VISION_MODES.filter((other) => other !== mode).map((other) => {
                const card = MODE_CARDS[other]
                const Icon = card.icon
                return (
                  <button
                    key={other}
                    type="button"
                    className="card card-hover flex cursor-pointer items-start gap-3 p-4 text-left transition hover:border-ring/60 sm:p-5"
                    onClick={() => {
                      setMode(other)
                    }}
                  >
                    <span
                      className={`grid size-10 shrink-0 place-items-center ${card.shape} ${card.tile}`}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block font-display text-base font-bold sm:text-lg">
                        {MODE_TITLES[other]}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">
                        {MODE_BLURBS[other]}
                      </span>
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {modeBestText(other, ready)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </>
      ) : null}
    </main>
  )
}
