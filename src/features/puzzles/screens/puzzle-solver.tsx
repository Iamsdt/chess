import { ArrowLeft, Eye, SkipForward, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { Button, cn, EmptyState, PageHeader } from '@/design'

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

  const heading = (
    <div className="min-w-0 flex-1 leading-tight">
      <h1 className="truncate font-display text-lg font-bold sm:text-xl">
        {puzzle?.title ?? 'Find the move'}
      </h1>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'inline-block size-2.5 rounded-full ring-1 ring-border',
              solve?.userColor === 'black' ? 'bg-foreground' : 'bg-background',
            )}
          />
          {solve === null
            ? 'Loading'
            : `${solve.userColor === 'white' ? 'White' : 'Black'} to play`}
        </span>
        {puzzle === null ? null : showMeta ? (
          <PuzzleAttribution puzzle={puzzle} revealed />
        ) : (
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            title="Theme and rating are hidden until you have played your move."
            onClick={() => {
              setRevealed(true)
            }}
          >
            Reveal theme
          </button>
        )}
      </div>
    </div>
  )

  return (
    <Frame navigate={navigate} dots={runner.dots} heading={heading}>
      <section
        className="mx-auto w-full max-w-[min(100%,calc(100dvh-210px))] min-w-[min(100%,340px)] space-y-2"
        aria-label="Puzzle"
      >
        <SolverBoard
          solve={solve}
          focus={runner.hint?.focus ?? []}
          onMove={runner.play}
          label="Puzzle board"
          announcement={announcementFor(runner.verdict, settled)}
        />

        {puzzle === null ? null : (
          <SolverFeedback
            puzzle={puzzle}
            verdict={runner.verdict}
            solved={solve?.status === 'solved'}
            ratingChange={runner.ratingChange}
            settled={settled}
            wrongMove={solve?.mistake?.san ?? null}
            hint={runner.hint}
            onNext={() => {
              setRevealed(false)
              runner.next()
            }}
            onRetry={runner.retry}
            lastInSet={lastInSet}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <HintLadder used={runner.hintUsed} onTake={runner.takeHint} disabled={settled} />
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={runner.skip}
            disabled={settled}
            title="A skipped puzzle counts as a miss and comes back another day."
          >
            <SkipForward aria-hidden className="size-4" />
            Skip
          </Button>
        </div>
      </section>
    </Frame>
  )
}

function announcementFor(verdict: string, settled: boolean): string | undefined {
  if (verdict === 'solved') return "That's the idea. The puzzle is solved."
  if (verdict === 'missed') {
    return settled
      ? 'That was the wrong move. Move on when you are ready.'
      : 'That is the wrong move. Press Look again to take it back.'
  }
  if (verdict === 'correct') return 'Right so far. Your opponent is about to answer.'
  return undefined
}

function Frame({
  navigate,
  dots,
  heading,
  children,
}: {
  readonly navigate: NavigateTo
  readonly dots?: readonly ('solved' | 'missed' | 'current' | 'todo')[]
  /** Replaces the page title while a puzzle is on the board. */
  readonly heading?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-[1200px] p-2 sm:px-4 sm:py-3 lg:px-6">
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
        {heading ?? <PageHeader className="flex-1" title="Puzzle" />}
        {dots === undefined ? null : <ProgressDots dots={dots} />}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}
