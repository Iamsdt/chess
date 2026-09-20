import { ArrowLeft, Eye, SkipForward, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { Badge, Button, EmptyState, PageHeader } from '@/design'

import { HintLadder } from '../components/hint-ladder'
import { ProgressDots } from '../components/progress-dots'
import { PuzzleAttribution } from '../components/puzzle-attribution'
import { SolverBoard } from '../components/solver-board'
import { SolverFeedback } from '../components/solver-feedback'
import { usePuzzleSession } from '../use-puzzle-session'

import { formatDuration } from './format'

import type { NavigateTo } from './navigation'
import type { PuzzleSessionKind } from '../session'
import type { ReactNode } from 'react'

/**
 * The solver, ported from `prototype/puzzle.html`.
 *
 * One puzzle at a time, with the rating and the theme hidden until the move has been
 * played — showing them first would narrow the search before the user has looked. When
 * the puzzle is over they appear together with the Lichess link the puzzles are
 * attributed to.
 */

/** A set started on the hub is picked up here, whichever of these kinds it was. */
const SOLVER_KINDS: readonly PuzzleSessionKind[] = [
  'adaptive-puzzles',
  'theme-puzzles',
  'daily-puzzle',
]

export interface PuzzleSolverProps {
  readonly navigate: NavigateTo
}

export function PuzzleSolver({ navigate }: PuzzleSolverProps) {
  const runner = usePuzzleSession({ kind: 'adaptive-puzzles', resumeKinds: SOLVER_KINDS })
  const [revealed, setRevealed] = useState(false)

  if (runner.status === 'loading') {
    return (
      <Frame navigate={navigate}>
        <p className="text-sm text-muted-foreground" role="status">
          Choosing puzzles at your level…
        </p>
      </Frame>
    )
  }

  if (runner.status === 'error') {
    return (
      <Frame navigate={navigate}>
        <EmptyState
          icon={TriangleAlert}
          title="That set would not open"
          description={runner.error ?? 'Something went wrong reading this device’s storage.'}
          action={
            <Button
              onClick={() => {
                navigate('/puzzles')
              }}
            >
              Back to Puzzles
            </Button>
          }
        />
      </Frame>
    )
  }

  if (runner.status === 'empty') {
    return (
      <Frame navigate={navigate}>
        <EmptyState
          icon={TriangleAlert}
          title="No puzzles to draw from yet"
          description="The Lichess puzzle set has not been imported on this device. The Puzzles hub can bring it in."
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
      </Frame>
    )
  }

  if (runner.status === 'finished') {
    const summary = runner.summary
    return (
      <Frame navigate={navigate}>
        <EmptyState
          icon={Eye}
          title="That's the set"
          description={
            summary === null
              ? 'Nicely done.'
              : `${String(summary.solved)} of ${String(summary.attempted)} solved, ${formatDuration(summary.durationMs)} at the board.`
          }
          action={
            <Button
              className="btn btn-cta"
              onClick={() => {
                navigate('/puzzles/summary')
              }}
            >
              See how it went
            </Button>
          }
        />
      </Frame>
    )
  }

  const puzzle = runner.puzzle
  const solve = runner.solve
  const settled = runner.awaitingNext
  const showMeta = revealed || settled
  const lastInSet =
    runner.state !== null &&
    runner.state.config.goal !== null &&
    runner.state.results.length + 1 >= runner.state.config.goal

  return (
    <Frame navigate={navigate} dots={runner.dots}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex justify-center" aria-label="Puzzle board">
          <div className="board-size w-full max-w-[640px] space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="leading-tight">
                <p className="text-sm font-semibold">
                  {solve === null
                    ? 'Loading'
                    : `${solve.userColor === 'white' ? 'White' : 'Black'} to play`}
                </p>
                <p className="text-xs text-muted-foreground">{puzzle?.prompt ?? ''}</p>
              </div>
            </div>
            <SolverBoard
              solve={solve}
              focus={runner.hint?.focus ?? []}
              onMove={runner.play}
              label="Puzzle board"
              announcement={announcementFor(runner.verdict, settled)}
            />
          </div>
        </section>

        <aside className="card flex min-h-0 flex-col overflow-hidden" aria-label="Puzzle panel">
          <div className="border-b px-5 py-4">
            <p className="label">Your task</p>
            <h2 className="mt-0.5 font-display text-xl leading-snug font-bold">
              {puzzle?.title ?? 'Find the move'}
            </h2>
            <div className="mt-3 flex items-center gap-2 text-xs">
              {puzzle === null ? null : <PuzzleAttribution puzzle={puzzle} revealed={showMeta} />}
              {showMeta || puzzle === null ? null : (
                <button
                  type="button"
                  className="ml-auto font-medium text-primary hover:underline"
                  onClick={() => {
                    setRevealed(true)
                  }}
                >
                  Reveal
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-auto p-5">
            <HintLadder
              used={runner.hintUsed}
              hint={runner.hint}
              onTake={runner.takeHint}
              disabled={settled}
            />
            <section aria-labelledby="after-move-heading">
              <h3 id="after-move-heading" className="text-sm font-semibold">
                After your move
              </h3>
              <div className="mt-2.5">
                {puzzle === null ? null : (
                  <SolverFeedback
                    puzzle={puzzle}
                    verdict={runner.verdict}
                    solved={solve?.status === 'solved'}
                    ratingChange={runner.ratingChange}
                    settled={settled}
                    onNext={() => {
                      setRevealed(false)
                      runner.next()
                    }}
                    onRetry={runner.retry}
                    lastInSet={lastInSet}
                  />
                )}
              </div>
            </section>
          </div>

          <div className="space-y-2 border-t p-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={runner.skip}
              disabled={settled}
            >
              <SkipForward aria-hidden className="size-4" />
              Skip this one
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              A skipped puzzle counts as a miss and comes back another day.
            </p>
          </div>
        </aside>
      </div>
    </Frame>
  )
}

function announcementFor(verdict: string, settled: boolean): string | undefined {
  if (verdict === 'solved') return "That's the idea. The puzzle is solved."
  if (verdict === 'missed') {
    return settled
      ? 'That was not the idea this puzzle is about. Move on when you are ready.'
      : 'That is not the idea here. The position is unchanged; look again.'
  }
  if (verdict === 'correct') return 'Right so far. Your opponent is about to answer.'
  return undefined
}

function Frame({
  navigate,
  dots,
  children,
}: {
  readonly navigate: NavigateTo
  readonly dots?: readonly ('solved' | 'missed' | 'current' | 'todo')[]
  readonly children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            navigate('/puzzles')
          }}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Puzzles
        </Button>
        <PageHeader className="flex-1" title="Puzzle" />
        {dots === undefined ? null : <ProgressDots dots={dots} />}
        <Badge variant="muted">No spoilers · hints nudge, they do not tell</Badge>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  )
}
