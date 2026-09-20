import { Check, Hand, RotateCcw } from 'lucide-react'

import { Button } from '@/design'
import { type Puzzle } from '@/domain'

import { PuzzleAttribution } from './puzzle-attribution'

import type { RatingChange } from '../rating'
import type { SolveVerdict } from '../use-puzzle-session'

export interface SolverFeedbackProps {
  readonly puzzle: Puzzle
  readonly verdict: SolveVerdict
  readonly solved: boolean
  readonly ratingChange: RatingChange | null
  /** True once the attempt has been written; the next puzzle is then one press away. */
  readonly settled: boolean
  readonly onNext: () => void
  readonly onRetry: () => void
  readonly lastInSet: boolean
}

function ratingLine(change: RatingChange | null): string | null {
  if (change === null) return null
  if (!change.rated) return 'Unrated — you had the move shown to you.'
  return `${change.delta >= 0 ? '+' : '−'}${String(Math.abs(change.delta))} rating`
}

/**
 * What the panel says after a move.
 *
 * The copy carries the sprint's tone rule: a miss is "the idea you missed", never "wrong".
 * The user keeps the board they were thinking about and is told plainly that their rating
 * has not moved yet, because the thing that makes people stop practising is not
 * difficulty, it is being told off.
 */
export function SolverFeedback({
  puzzle,
  verdict,
  solved,
  ratingChange,
  settled,
  onNext,
  onRetry,
  lastInSet,
}: SolverFeedbackProps) {
  if (verdict === 'solved' || (solved && settled)) {
    return (
      <div className="rise rounded-xl border border-success/30 bg-accent/60 p-4" role="status">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check aria-hidden className="size-4" />
          </span>
          <p className="flex-1 font-display text-lg font-bold">That's the idea</p>
          {ratingLine(ratingChange) === null ? null : (
            <span className="badge border-transparent bg-card font-semibold text-success">
              {ratingLine(ratingChange)}
            </span>
          )}
        </div>
        <div className="mt-3 rounded-lg bg-card p-3">
          <p className="label">Why it works</p>
          <p className="mt-1 text-sm leading-relaxed">{puzzle.explanation}</p>
        </div>
        <PuzzleAttribution className="mt-3" puzzle={puzzle} revealed />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button className="btn btn-cta" onClick={onNext} disabled={!settled}>
            {lastInSet ? 'See how the set went' : 'Next puzzle'}
          </Button>
        </div>
      </div>
    )
  }

  if (verdict === 'missed') {
    return (
      <div className="rise rounded-xl border border-cta/30 bg-cta-soft p-4" role="status">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-card text-cta ring-1 ring-cta/30">
            <RotateCcw aria-hidden className="size-4" />
          </span>
          <p className="flex-1 font-display text-lg font-bold">Not the idea this one is about</p>
        </div>
        <p className="mt-2 text-sm">
          That move is playable — there is something stronger here.{' '}
          {settled
            ? 'This one is recorded; take the next when you are ready.'
            : 'Your rating has not moved yet.'}
        </p>
        {settled ? (
          <>
            <div className="mt-3 rounded-lg bg-card p-3">
              <p className="label">The idea you missed</p>
              <p className="mt-1 text-sm leading-relaxed">{puzzle.explanation}</p>
            </div>
            <PuzzleAttribution className="mt-3" puzzle={puzzle} revealed />
          </>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {settled ? (
            <Button className="btn btn-cta" onClick={onNext}>
              {lastInSet ? 'See how the set went' : 'Next puzzle'}
            </Button>
          ) : (
            <Button variant="default" onClick={onRetry}>
              <RotateCcw aria-hidden className="size-4" />
              Look again
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <Hand aria-hidden className="size-4 text-primary" />
        Your move
      </p>
      <p className="mt-1">Drag or tap a piece. Checks, captures, threats: in that order.</p>
    </div>
  )
}
