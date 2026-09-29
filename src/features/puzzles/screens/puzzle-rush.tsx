import { ArrowLeft, HeartPulse, Hourglass, Timer, TriangleAlert, X, Zap } from 'lucide-react'
import { useState } from 'react'

import { Badge, Button, EmptyState, PageHeader, cn } from '@/design'

import { PuzzleAttribution } from '../components/puzzle-attribution'
import { SolverBoard } from '../components/solver-board'
import { RUSH_LIVES, type PuzzleSessionKind, type RushDuration } from '../session'
import { usePuzzleSession } from '../use-puzzle-session'

import { formatClock } from './format'

import type { NavigateTo } from './navigation'
import type { ReactNode } from 'react'

/**
 * Puzzle Rush and Survival, ported from `prototype/puzzle-rush.html`.
 *
 * The two modes share everything but their three numbers — a clock, three strikes, or
 * strikes alone — so they share a runner as well as a screen. The mode picker is the
 * screen's only local state: choosing one starts a session, and the session is what the
 * runner then owns.
 *
 * The timed modes differ from the solver in exactly one rule: the first wrong move ends
 * the puzzle. The panel still never calls it wrong.
 */

const RUSH_KINDS: readonly PuzzleSessionKind[] = ['puzzle-rush', 'puzzle-survival']

type Mode =
  | { readonly kind: 'puzzle-rush'; readonly duration: RushDuration }
  | { readonly kind: 'puzzle-survival' }

const MODES: readonly {
  readonly id: string
  readonly label: string
  readonly hint: string
  readonly icon: typeof Timer
  readonly mode: Mode
}[] = [
  {
    id: '3min',
    label: '3 minutes',
    hint: "Three strikes and you're out",
    icon: Timer,
    mode: { kind: 'puzzle-rush', duration: '3min' },
  },
  {
    id: '5min',
    label: '5 minutes',
    hint: 'More room for harder puzzles',
    icon: Hourglass,
    mode: { kind: 'puzzle-rush', duration: '5min' },
  },
  {
    id: 'survival',
    label: 'Survival',
    hint: 'No clock. Three misses end it',
    icon: HeartPulse,
    mode: { kind: 'puzzle-survival' },
  },
]

export interface PuzzleRushProps {
  readonly navigate: NavigateTo
}

export function PuzzleRushScreen({ navigate }: PuzzleRushProps) {
  const [mode, setMode] = useState<Mode | null>(null)

  if (mode === null) {
    return <ModePicker navigate={navigate} onPick={setMode} />
  }
  return (
    <RushRun
      navigate={navigate}
      mode={mode}
      onChangeMode={() => {
        setMode(null)
      }}
    />
  )
}

function Shell({
  navigate,
  actions,
  children,
}: {
  readonly navigate: NavigateTo
  readonly actions?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-[1200px] p-2 sm:p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            navigate('/puzzles')
          }}
        >
          <ArrowLeft aria-hidden className="size-4" />
          <span className="max-sm:hidden">Puzzles</span>
        </Button>
        <PageHeader className="flex-1" title="Puzzle Rush" />
        {actions}
      </div>
      <div className="mt-3 sm:mt-5">{children}</div>
    </div>
  )
}

function ModePicker({
  navigate,
  onPick,
}: {
  readonly navigate: NavigateTo
  readonly onPick: (mode: Mode) => void
}) {
  return (
    <Shell navigate={navigate}>
      <section className="card mx-auto max-w-[520px] p-4 sm:p-6" aria-labelledby="modes-heading">
        <h2 id="modes-heading" className="font-display text-lg font-bold sm:text-xl">
          Pick your rush
        </h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Easy first, then harder. Nothing here counts against your puzzle rating twice — each
          puzzle is rated once, as always.
        </p>
        <div className="mt-4 space-y-2 sm:mt-5">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="option w-full cursor-pointer p-3 sm:p-3.5"
              onClick={() => {
                onPick(entry.mode)
              }}
            >
              <span className="grid size-9 place-items-center rounded-xl bg-cta-soft text-cta sm:size-10">
                <entry.icon aria-hidden className="size-4 sm:size-5" />
              </span>
              <span className="flex-1 text-left">
                <span className="block text-sm font-semibold sm:text-base">{entry.label}</span>
                <span className="block text-xs text-muted-foreground">{entry.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </Shell>
  )
}

function RushRun({
  navigate,
  mode,
  onChangeMode,
}: {
  readonly navigate: NavigateTo
  readonly mode: Mode
  readonly onChangeMode: () => void
}) {
  const runner = usePuzzleSession(
    mode.kind === 'puzzle-rush'
      ? { kind: 'puzzle-rush', duration: mode.duration, resumeKinds: RUSH_KINDS }
      : { kind: 'puzzle-survival', resumeKinds: RUSH_KINDS },
  )

  if (runner.status === 'loading') {
    return (
      <Shell navigate={navigate}>
        <p className="text-sm text-muted-foreground" role="status">
          Lining up your first puzzles…
        </p>
      </Shell>
    )
  }

  if (runner.status === 'error' || runner.status === 'empty') {
    return (
      <Shell navigate={navigate}>
        <EmptyState
          icon={TriangleAlert}
          title={
            runner.status === 'empty' ? 'No puzzles on this device yet' : 'That run would not start'
          }
          description={
            runner.error ??
            'The Lichess puzzle set has not been imported here. The Puzzles hub can bring it in.'
          }
          action={
            <Button
              className="btn btn-cta"
              onClick={() => {
                navigate('/puzzles')
              }}
            >
              Go to Puzzles
            </Button>
          }
        />
      </Shell>
    )
  }

  const summary = runner.summary
  const lives = runner.livesLeft ?? RUSH_LIVES

  if (runner.status === 'finished') {
    return (
      <Shell navigate={navigate}>
        <section className="card mx-auto max-w-[520px] p-4 text-center sm:p-6" aria-live="polite">
          <h2 className="font-display text-xl font-bold sm:text-2xl">Time's up</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {summary === null
              ? 'That run is over.'
              : `${String(summary.solved)} solved, best streak ${String(summary.bestStreak)}.`}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button className="btn btn-cta" onClick={onChangeMode}>
              Another run
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigate('/puzzles/summary')
              }}
            >
              See how it went
            </Button>
          </div>
        </section>
      </Shell>
    )
  }

  return (
    <Shell
      navigate={navigate}
      actions={
        <Button variant="ghost" size="sm" onClick={runner.finish}>
          End run
        </Button>
      }
    >
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex justify-center" aria-label="Rush board">
          <div className="board-size w-full max-w-[min(100%,calc(100dvh-200px))] space-y-2 sm:space-y-3 lg:max-w-[min(100%,70vh)]">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 sm:gap-5">
              {runner.timeLeftMs === null ? (
                <Badge variant="lilac">
                  <HeartPulse aria-hidden className="size-3.5" />
                  Survival
                </Badge>
              ) : (
                <div
                  className={cn(
                    'clock is-running !rounded-xl !px-3 !py-1 text-2xl sm:!px-4 sm:!py-1.5 sm:text-3xl',
                    runner.timeLeftMs < 30_000 && 'is-low',
                  )}
                  role="timer"
                  aria-label={`Time left: ${formatClock(runner.timeLeftMs)}`}
                >
                  {formatClock(runner.timeLeftMs)}
                </div>
              )}
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="font-display text-3xl leading-none font-bold tabular-nums sm:text-4xl">
                  {summary?.solved ?? 0}
                </span>
                <span className="text-xs text-muted-foreground sm:text-sm">solved</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-1 rounded-lg bg-reward-soft px-2 py-0.5 font-display text-base font-bold text-reward-ink sm:px-2.5 sm:py-1 sm:text-lg">
                  <Zap aria-hidden className="size-3.5 sm:size-4" />x{runner.state?.streak ?? 0}
                </span>
                <div
                  className="flex items-center gap-1"
                  role="img"
                  aria-label={`Strikes: ${String(RUSH_LIVES - lives)} of ${String(RUSH_LIVES)} used`}
                >
                  {Array.from({ length: RUSH_LIVES }, (_unused, index) =>
                    index < RUSH_LIVES - lives ? (
                      <span
                        key={index}
                        className="grid size-5 place-items-center rounded-full bg-destructive-soft text-destructive sm:size-6"
                      >
                        <X aria-hidden className="size-3 sm:size-3.5" />
                      </span>
                    ) : (
                      <span
                        key={index}
                        className="size-5 rounded-full border-2 border-dashed sm:size-6"
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
            <SolverBoard
              solve={runner.solve}
              focus={[]}
              onMove={runner.play}
              label="Rush board"
              announcement={
                runner.verdict === 'missed'
                  ? 'Not that one. The next puzzle is on its way.'
                  : undefined
              }
            />
          </div>
        </section>

        <aside
          className="card flex min-h-0 flex-col overflow-auto p-4 sm:p-5 lg:max-h-[calc(100dvh-56px-48px)]"
          aria-label="Run panel"
        >
          <h2 className="text-sm font-semibold">This run</h2>
          <ol className="mt-3 flex flex-wrap gap-1 sm:gap-1.5" aria-label="Results so far">
            {(runner.state?.results ?? []).map((result, index) => (
              <li
                key={result.puzzleId}
                className={cn(
                  'grid size-7 place-items-center rounded-lg text-xs font-semibold sm:size-8',
                  result.solved ? 'bg-accent text-primary' : 'bg-destructive-soft text-destructive',
                )}
                title={result.solved ? 'Solved' : `The ${result.theme} idea got away`}
              >
                {index + 1}
              </li>
            ))}
          </ol>
          {runner.puzzle === null || !runner.awaitingNext ? (
            <p className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground sm:mt-5">
              Chat stays closed while the clock runs. Every puzzle you miss comes back another day.
            </p>
          ) : (
            <PuzzleAttribution className="mt-4 sm:mt-5" puzzle={runner.puzzle} revealed />
          )}
        </aside>
      </div>
    </Shell>
  )
}
