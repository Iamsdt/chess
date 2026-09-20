import { CalendarClock, Check, Sparkles, TriangleAlert } from 'lucide-react'
import { useCallback } from 'react'

import { puzzlesRepo } from '@/data'
import { Badge, Button, EmptyState, PageHeader } from '@/design'
import type { Puzzle } from '@/domain'

import { PuzzleAttribution } from '../components/puzzle-attribution'
import { lastFinishedSession } from '../puzzle-store'
import { sessionSummary } from '../session'
import { useAsyncData } from '../use-async'

import { formatDelta, formatDuration, formatPercent } from './format'

import type { NavigateTo } from './navigation'
import type { PuzzleResult } from '../session'

/**
 * What the last session came to, ported from `prototype/session-summary.html`.
 *
 * The screen leads with the best moment rather than the misses. That is the sprint's tone
 * rule doing real work: the fastest unaided solve is the evidence that the practice is
 * working, and it is the thing worth remembering on the way out.
 */

interface SummaryData {
  readonly summary: ReturnType<typeof sessionSummary> | null
  readonly kind: string
  readonly bestPuzzle: Puzzle | null
  readonly missed: readonly PuzzleResult[]
}

async function loadSummary(): Promise<SummaryData> {
  const finished = await lastFinishedSession()
  if (finished === null) {
    return { summary: null, kind: '', bestPuzzle: null, missed: [] }
  }
  const summary = sessionSummary(finished.state)
  const best = summary.bestMoment
  const bestPuzzle = best === null ? null : await puzzlesRepo.get(best.puzzleId)
  return {
    summary,
    kind: finished.session.kind,
    bestPuzzle: bestPuzzle ?? null,
    missed: finished.state.results.filter((result) => !result.solved),
  }
}

export interface SessionSummaryProps {
  readonly navigate: NavigateTo
}

export function SessionSummary({ navigate }: SessionSummaryProps) {
  const state = useAsyncData(useCallback(() => loadSummary(), []))

  if (state.status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-[860px] p-6 lg:p-8">
        <PageHeader title="Session complete" />
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          Adding up what you just did…
        </p>
      </div>
    )
  }

  const summary = state.data?.summary ?? null

  if (state.status === 'error' || summary === null) {
    return (
      <div className="mx-auto w-full max-w-[860px] p-6 lg:p-8">
        <PageHeader title="Session complete" />
        <EmptyState
          className="mt-6"
          icon={state.status === 'error' ? TriangleAlert : CalendarClock}
          title={
            state.status === 'error' ? 'That summary would not open' : 'No finished session yet'
          }
          description={
            state.error ??
            'Solve a set and this page will show what it moved, what it cost you and what tomorrow should be.'
          }
          action={
            <Button
              className="btn btn-cta"
              onClick={() => {
                navigate('/puzzles/solve')
              }}
            >
              Start a set
            </Button>
          }
        />
      </div>
    )
  }

  const data = state.data
  const best = summary.bestMoment

  return (
    <div className="mx-auto w-full max-w-[860px] p-6 lg:p-8">
      <section className="card overflow-hidden" aria-labelledby="summary-heading">
        <div className="grid items-center gap-6 bg-accent/50 p-6 sm:grid-cols-[132px_minmax(0,1fr)] lg:p-8">
          <div className="mx-auto grid size-[132px] place-items-center rounded-full bg-card">
            <div className="text-center leading-tight">
              <Check aria-hidden className="mx-auto size-8 text-primary" />
              <p className="mt-0.5 text-[11px] font-semibold text-primary">Session done</p>
            </div>
          </div>
          <div className="text-center sm:text-left">
            <p className="label">
              {data?.kind === 'puzzle-rush' ? 'Puzzle Rush' : 'Puzzle session'} ·{' '}
              {formatDuration(summary.durationMs)}
            </p>
            <PageHeader
              className="mt-1 block"
              title="Nicely done"
              description="Everything from here is a bonus."
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 border-t md:grid-cols-4">
          <div className="border-b p-5 md:border-r md:border-b-0">
            <dt className="label">Puzzle rating</dt>
            <dd className="mt-1 font-display text-3xl font-bold tabular-nums">
              {formatDelta(summary.ratingDelta)}
            </dd>
            <dd className="text-xs text-muted-foreground">across this session</dd>
          </div>
          <div className="border-b border-l p-5 md:border-r md:border-b-0 md:border-l-0">
            <dt className="label">Solved</dt>
            <dd className="mt-1 font-display text-3xl font-bold tabular-nums">
              {summary.solved}
              <span className="text-lg text-muted-foreground"> of {summary.attempted}</span>
            </dd>
            <dd className="text-xs text-muted-foreground">{summary.firstTry} first try</dd>
          </div>
          <div className="p-5 md:border-r">
            <dt className="label">Accuracy</dt>
            <dd className="mt-1 font-display text-3xl font-bold tabular-nums">
              {formatPercent(summary.accuracy)}
            </dd>
            <dd className="text-xs text-muted-foreground">right in the zone at 75%</dd>
          </div>
          <div className="border-l p-5 md:border-l-0">
            <dt className="label">Best streak</dt>
            <dd className="mt-1 font-display text-3xl font-bold tabular-nums">
              {summary.bestStreak}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {summary.hintsUsed} hint{summary.hintsUsed === 1 ? '' : 's'} used
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-4 grid gap-4">
        <section className="card p-5" aria-labelledby="best-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="best-heading"
              className="flex items-center gap-2 font-display text-lg font-bold"
            >
              <Sparkles aria-hidden className="size-5 text-reward-ink" />
              Best moment
            </h2>
            {best === null ? null : (
              <Badge variant="soft">
                {best.theme} · {formatDuration(best.durationMs)}
              </Badge>
            )}
          </div>
          {best === null ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No first-try solve this time. The ones that took a second look are the ones that teach
              the most.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm leading-relaxed">
                You found the {best.theme} in {formatDuration(best.durationMs)}, with no hints.
              </p>
              {data?.bestPuzzle === null || data?.bestPuzzle === undefined ? null : (
                <PuzzleAttribution className="mt-3" puzzle={data.bestPuzzle} revealed />
              )}
            </>
          )}
        </section>

        <section className="card p-5" aria-labelledby="coming-back-heading">
          <h2 id="coming-back-heading" className="font-display text-lg font-bold">
            Coming back
          </h2>
          {data === undefined || data.missed.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing got away this time. The next set will lean a little harder.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2.5 text-sm">
              {data.missed.map((result) => (
                <li key={result.puzzleId} className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-sky text-sky-ink">
                    <CalendarClock aria-hidden className="size-4" />
                  </span>
                  <span className="flex-1">
                    The <b className="font-semibold">{result.theme}</b> idea, rated {result.rating}{' '}
                    — it will come back in a couple of days.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-4 flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold">Still in the flow?</h2>
          <p className="text-sm text-muted-foreground">A short set now makes tomorrow easier.</p>
        </div>
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <Button
            variant="ghost"
            onClick={() => {
              navigate('/puzzles')
            }}
          >
            Done for today
          </Button>
          <Button
            className="btn btn-cta"
            onClick={() => {
              navigate('/puzzles/solve')
            }}
          >
            One more set
          </Button>
        </div>
      </section>
    </div>
  )
}
