import {
  Crosshair,
  Download,
  HeartPulse,
  Puzzle as PuzzleIcon,
  RefreshCw,
  SlidersHorizontal,
  Timer,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useState } from 'react'

import { Badge, Button, EmptyState, PageHeader, StatCard } from '@/design'

import { ProgressDots } from '../components/progress-dots'
import { PuzzleAttribution } from '../components/puzzle-attribution'
import { ThemeMasteryGrid } from '../components/theme-mastery-grid'
import { createContentImportPort, type PuzzleImportPort } from '../ports'
import { startNewSession } from '../queue'
import { configFor, progressDots, sessionSummary } from '../session'
import { usePuzzleHub, usePuzzleImport, type HubData } from '../use-puzzle-hub'

import { formatDelta, formatPercent } from './format'

import type { NavigateTo } from './navigation'

/**
 * The Puzzles hub: where the user is, and the four ways in.
 *
 * Ported from `prototype/puzzles.html`. The numbers are real — rating, solve rate, theme
 * mastery, personal bests — and every one of them comes from the user's own attempts.
 * There are no leaderboards here and no comparisons with anybody else, which is why the
 * bests section says so out loud.
 */
export interface PuzzlesHubProps {
  readonly navigate: NavigateTo
  /** Injected so a test can stand in for a 3.6 MB download. */
  readonly importPort?: PuzzleImportPort
}

export function PuzzlesHub({ navigate, importPort }: PuzzlesHubProps) {
  const hub = usePuzzleHub()
  const [port] = useState<PuzzleImportPort>(() => importPort ?? createContentImportPort())
  const { reload } = hub
  const importing = usePuzzleImport(port, reload)
  const [starting, setStarting] = useState<string | null>(null)

  const practiseTheme = useCallback(
    (theme: string) => {
      setStarting(theme)
      // The hand-off to the solver is the open session, not a route parameter, so it
      // survives the reload the user might do on the way.
      void startNewSession(configFor('theme-puzzles', { theme })).then(() => {
        navigate('/puzzles/solve')
      })
    },
    [navigate],
  )

  const header = (
    <PageHeader
      eyebrow="Puzzles"
      title="Sharpen your eye"
      description="Short sets, tuned to you. Play the move, don't just read it."
    />
  )

  if (hub.status === 'loading') {
    return (
      <div className="page @container">
        {header}
        <p className="mt-8 text-sm text-muted-foreground" role="status">
          Reading your puzzle history…
        </p>
      </div>
    )
  }

  if (hub.status === 'error' || hub.data === undefined) {
    return (
      <div className="page @container">
        {header}
        <EmptyState
          className="mt-6"
          icon={TriangleAlert}
          title="Your puzzle data would not open"
          description={hub.error ?? 'Something went wrong reading this device’s storage.'}
          action={
            <Button onClick={hub.reload}>
              <RefreshCw aria-hidden className="size-4" />
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  const data = hub.data

  if (data.stats.total === 0) {
    return (
      <div className="page @container">
        {header}
        <EmptyState
          className="mt-6"
          icon={Download}
          title="The puzzles are not on this device yet"
          description="Ten thousand puzzles from the Lichess open database, about 3.6 MB. They stay on this device and work offline once they are in."
          action={
            <div className="flex flex-col items-center gap-2">
              <Button
                className="btn btn-cta"
                onClick={importing.start}
                disabled={importing.status === 'running'}
              >
                {importing.status === 'running' ? 'Bringing them in…' : 'Bring in the puzzles'}
              </Button>
              {importing.progress === null ? null : (
                <p className="text-xs text-muted-foreground" role="status">
                  {importing.progress.band ?? 'Reading the index'} ·{' '}
                  {importing.progress.puzzlesImported} imported
                </p>
              )}
              {importing.message === null ? null : (
                <p className="text-xs text-destructive">{importing.message}</p>
              )}
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="page @container">
      {header}
      <HubHero data={data} navigate={navigate} />
      <ModeCards data={data} navigate={navigate} />
      <section className="@container mt-8" aria-labelledby="themes-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="themes-heading" className="font-display text-xl font-bold">
            Themes
          </h2>
          <span className="text-xs text-muted-foreground">
            From your own attempts · choose one to practise it
          </span>
        </div>
        {data.mastery.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Solve a few puzzles and your themes will show up here, weakest first.
          </p>
        ) : (
          <ThemeMasteryGrid mastery={data.mastery} onPractise={practiseTheme} />
        )}
        {starting === null ? null : (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            Putting a {starting} set together…
          </p>
        )}
      </section>
      <PersonalBests data={data} />
    </div>
  )
}

function HubHero({ data, navigate }: { readonly data: HubData; readonly navigate: NavigateTo }) {
  const resume = data.resume
  const dots = resume === null ? [] : progressDots(resume.state)
  const done = resume === null ? 0 : resume.state.results.length
  const goal = resume?.state.config.goal ?? 10

  return (
    <section
      className="card @container mt-6 overflow-hidden border-cta/30"
      aria-labelledby="hero-heading"
    >
      <div className="grid gap-6 p-6 lg:p-7 @[640px]:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          {data.focusTheme === null ? null : (
            <Badge variant="cta">
              <Crosshair aria-hidden className="size-3.5" />
              Today's focus: {data.focusTheme}
            </Badge>
          )}
          <h2
            id="hero-heading"
            className="mt-3 font-display text-[30px] leading-[1.05] font-bold tracking-tight"
          >
            {resume === null ? 'Start an adaptive set' : 'Carry on where you left off'}
          </h2>
          <p className="mt-2 max-w-[46ch] text-sm text-muted-foreground">
            Difficulty is tuned so you solve about 75%: hard enough to grow, easy enough to enjoy.
            Your set is drawn from the {data.rung.band} band, rung {data.rung.subLevel}.
          </p>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="label">Puzzle rating</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">
                {Math.round(data.rating.rating)}
              </dd>
            </div>
            <div>
              <dt className="label">Solve rate, last 50</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">
                {formatPercent(data.solveRate)}
              </dd>
            </div>
            <div>
              <dt className="label">This set</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">
                {done}
                <span className="text-base font-semibold text-muted-foreground"> of {goal}</span>
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              className="btn btn-cta"
              onClick={() => {
                navigate('/puzzles/solve')
              }}
            >
              <PuzzleIcon aria-hidden className="size-[18px]" />
              {resume === null ? 'Start adaptive puzzles' : 'Continue adaptive puzzles'}
            </Button>
          </div>
          {dots.length === 0 ? null : <ProgressDots className="mt-5" dots={dots} shape="bar" />}
        </div>
        <DailyCard data={data} navigate={navigate} />
      </div>
    </section>
  )
}

function DailyCard({ data, navigate }: { readonly data: HubData; readonly navigate: NavigateTo }) {
  if (data.daily === null) return null
  const { puzzle, attempt } = data.daily
  const solved = attempt?.solved === true

  return (
    <aside className="rounded-xl bg-accent/50 p-4" aria-labelledby="daily-heading">
      <p className="label">Daily puzzle</p>
      <h3 id="daily-heading" className="mt-1 text-base font-bold">
        {solved ? 'Solved today' : 'Waiting for you'}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {solved
          ? 'A new one arrives tomorrow morning.'
          : 'The same puzzle for everyone today, whatever your rating.'}
      </p>
      {solved ? (
        <PuzzleAttribution className="mt-3" puzzle={puzzle} revealed />
      ) : (
        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          onClick={() => {
            navigate('/puzzles/solve')
          }}
        >
          Open the solver
        </Button>
      )}
    </aside>
  )
}

function ModeCards({ data, navigate }: { readonly data: HubData; readonly navigate: NavigateTo }) {
  const modes = [
    {
      key: 'adaptive',
      icon: SlidersHorizontal,
      title: 'Adaptive',
      description: 'Sets of 10, tuned to a 75% solve rate. No clock.',
      note:
        data.resume === null
          ? 'Fresh set'
          : `${String(data.resume.state.results.length)} of 10 · resume`,
      path: '/puzzles/solve' as const,
    },
    {
      key: 'rush',
      icon: Timer,
      title: 'Puzzle Rush',
      description: '3 or 5 minutes. Solve as many as you can. Three strikes.',
      note: `Your best: ${String(Math.max(data.bests.rush3, data.bests.rush5))}`,
      path: '/puzzles/rush' as const,
    },
    {
      key: 'survival',
      icon: HeartPulse,
      title: 'Survival',
      description: 'No clock. Puzzles keep coming until three misses.',
      note: `Your best: ${String(data.bests.survival)}`,
      path: '/puzzles/rush' as const,
    },
  ]

  return (
    <section className="@container mt-8" aria-labelledby="modes-heading">
      <h2 id="modes-heading" className="font-display text-xl font-bold">
        Ways to train
      </h2>
      <div className="mt-4 grid gap-4 @[480px]:grid-cols-2 @[640px]:grid-cols-3">
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            className="card card-hover flex cursor-pointer flex-col p-5 text-left"
            onClick={() => {
              navigate(mode.path)
            }}
          >
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary">
              <mode.icon aria-hidden className="size-5" />
            </span>
            <span className="mt-3 text-lg font-bold">{mode.title}</span>
            <span className="mt-1 text-sm text-muted-foreground">{mode.description}</span>
            <span className="mt-auto pt-4 text-xs text-muted-foreground">{mode.note}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function PersonalBests({ data }: { readonly data: HubData }) {
  const lastSession = data.resume === null ? null : sessionSummary(data.resume.state)

  return (
    <section className="card mt-8 p-5" aria-labelledby="bests-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="bests-heading" className="font-display text-lg font-bold">
            Your personal bests
          </h2>
          <p className="text-sm text-muted-foreground">Only you vs. you. No leaderboards here.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Highest rating"
          value={data.bests.highestRating}
          hint={`now ${String(Math.round(data.rating.rating))}`}
        />
        <StatCard
          label="Rush"
          value={Math.max(data.bests.rush3, data.bests.rush5)}
          hint="solved in one run"
        />
        <StatCard label="Survival" value={data.bests.survival} hint="in a row" />
        <StatCard
          label="Solve streak"
          value={data.bests.solveStreak}
          hint={
            lastSession === null
              ? 'first-try solves in a row'
              : `this set: ${formatDelta(lastSession.ratingDelta)} rating`
          }
        />
      </div>
    </section>
  )
}
