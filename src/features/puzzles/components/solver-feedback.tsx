import { Check, Hand, Lightbulb, RotateCcw, X } from 'lucide-react'

import { Button, cn } from '@/design'
import { type Puzzle } from '@/domain'

import { PuzzleAttribution } from './puzzle-attribution'

import type { RevealedHint } from '../hints'
import type { RatingChange } from '../rating'
import type { SolveVerdict } from '../use-puzzle-session'
import type { ReactNode } from 'react'

export interface SolverFeedbackProps {
  readonly puzzle: Puzzle
  readonly verdict: SolveVerdict
  readonly solved: boolean
  readonly ratingChange: RatingChange | null
  /** True once the attempt has been written; the next puzzle is then one press away. */
  readonly settled: boolean
  /** The wrong move still on the board, in SAN. */
  readonly wrongMove: string | null
  /** The hint rung last opened, shown while the user is still solving. */
  readonly hint: RevealedHint | null
  readonly onNext: () => void
  readonly onRetry: () => void
  readonly lastInSet: boolean
}

function ratingLine(change: RatingChange | null): string | null {
  if (change === null) return null
  if (!change.rated) return 'Unrated, you had the move shown to you'
  return `${change.delta >= 0 ? '+' : '−'}${String(Math.abs(change.delta))} rating`
}

/**
 * The strip under the board: what the last move was worth and what to do next.
 *
 * A wrong move is called wrong, plainly, and stays on the board until "Look again" takes
 * it back. Solved and missed puzzles get the "why it works" line and the attribution,
 * and the next puzzle is the one button in reach.
 */
export function SolverFeedback({
  puzzle,
  verdict,
  solved,
  ratingChange,
  settled,
  wrongMove,
  hint,
  onNext,
  onRetry,
  lastInSet,
}: SolverFeedbackProps) {
  const nextLabel = lastInSet ? 'See how the set went' : 'Next puzzle'

  if (verdict === 'solved' || (solved && settled)) {
    const rating = ratingLine(ratingChange)
    return (
      <Strip
        tone="success"
        icon={<Check aria-hidden className="size-4" />}
        title="Solved"
        aside={
          rating === null ? null : (
            <span className="text-xs font-semibold text-success">{rating}</span>
          )
        }
        action={
          <Button className="btn btn-cta" onClick={onNext} disabled={!settled}>
            {nextLabel}
          </Button>
        }
      >
        <p>{puzzle.explanation}</p>
        <PuzzleAttribution className="mt-2" puzzle={puzzle} revealed />
      </Strip>
    )
  }

  if (verdict === 'missed') {
    const title = wrongMove === null ? 'Wrong move' : `${wrongMove} is wrong`
    if (settled) {
      return (
        <Strip
          tone="error"
          icon={<X aria-hidden className="size-4" />}
          title={title}
          action={
            <Button className="btn btn-cta" onClick={onNext}>
              {nextLabel}
            </Button>
          }
        >
          <p>
            <span className="font-medium">The idea: </span>
            {puzzle.explanation}
          </p>
          <PuzzleAttribution className="mt-2" puzzle={puzzle} revealed />
        </Strip>
      )
    }
    return (
      <Strip
        tone="error"
        icon={<X aria-hidden className="size-4" />}
        title={title}
        action={
          <Button variant="default" onClick={onRetry}>
            <RotateCcw aria-hidden className="size-4" />
            Look again
          </Button>
        }
      >
        <p>That is not the answer. Take it back and try another move.</p>
      </Strip>
    )
  }

  if (verdict === 'correct') {
    return (
      <Strip tone="success" icon={<Check aria-hidden className="size-4" />} title="Right move">
        <p>Your opponent is answering. Keep going.</p>
      </Strip>
    )
  }

  if (hint !== null) {
    return (
      <Strip tone="hint" icon={<Lightbulb aria-hidden className="size-4" />} title="Hint">
        <p>{hint.text}</p>
      </Strip>
    )
  }

  return (
    <Strip tone="idle" icon={<Hand aria-hidden className="size-4" />} title="Your move">
      <p>Checks, captures, threats: in that order.</p>
    </Strip>
  )
}

type StripTone = 'success' | 'error' | 'hint' | 'idle'

const TONES: Record<StripTone, { box: string; icon: string }> = {
  success: {
    box: 'border-success/40 bg-accent/60',
    icon: 'bg-primary text-primary-foreground',
  },
  error: {
    box: 'border-destructive/40 bg-destructive-soft',
    icon: 'bg-destructive text-white',
  },
  hint: {
    box: 'border-reward/50 bg-reward-soft text-reward-ink',
    icon: 'bg-reward text-reward-foreground',
  },
  idle: {
    box: 'border-dashed',
    icon: 'bg-muted text-primary',
  },
}

function Strip({
  tone,
  icon,
  title,
  aside,
  action,
  children,
}: {
  readonly tone: StripTone
  readonly icon: ReactNode
  readonly title: string
  readonly aside?: ReactNode
  readonly action?: ReactNode
  readonly children: ReactNode
}) {
  const styles = TONES[tone]
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5',
        tone !== 'idle' && 'rise',
        styles.box,
      )}
      role="status"
    >
      <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', styles.icon)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="font-display font-bold">{title}</p>
          {aside}
        </div>
        <div className={cn('leading-snug', tone === 'idle' && 'text-muted-foreground')}>
          {children}
        </div>
      </div>
      {action === undefined ? null : <div className="shrink-0">{action}</div>}
    </div>
  )
}
