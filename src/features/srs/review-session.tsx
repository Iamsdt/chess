import { ArrowRight, Check, Lightbulb, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Badge, Button, CtaButton, EmptyState } from '@/design'
import { toSquare } from '@/domain'
import { ProgressDots } from '@/features/puzzles/components/progress-dots'
import { SolverBoard } from '@/features/puzzles/components/solver-board'
import { nextRung } from '@/features/puzzles/hints'
import type { AttemptedMove } from '@/features/puzzles/solution'

import { comesBackLabel } from './format'
import { buildRecap, type Recap } from './recap'
import {
  cardsDone,
  currentItem,
  progressDots,
  reduceSession,
  startSession,
  summarise,
  totalCards,
  type ReviewAction,
  type ReviewItem,
  type ReviewSessionState,
} from './session'
import { saveReviewedCard } from './store'

/** How long the board rests on the user's move before the scripted reply, as in the solver. */
const REPLY_DELAY_MS = 420

export interface ReviewSessionProps {
  readonly items: readonly ReviewItem[]
  /** Called when the user leaves, finished or not. */
  readonly onExit: () => void
}

/**
 * The review runner: the puzzle solver's board and hint control, pointed at your own
 * mistakes, followed by a calm recap of the idea that was missed.
 *
 * State lives in the pure reducer; this component only feeds it events and writes the
 * card the moment an attempt closes, so a closed tab never loses a finished review.
 */
export function ReviewSession({ items, onExit }: ReviewSessionProps) {
  const [initial] = useState(() => startSession(items, Date.now()))
  const [state, setState] = useState<ReviewSessionState>(initial)
  // The reducer's latest result, readable inside event handlers without a stale closure.
  const latest = useRef(initial)

  const apply = useCallback((action: ReviewAction) => {
    const before = latest.current
    const after = reduceSession(before, action)
    if (after === before) return
    latest.current = after
    setState(after)
    const item = currentItem(before)
    if (after.results.length > before.results.length && after.outcome !== null && item !== null) {
      void saveReviewedCard(item.card, after.outcome.card, new Date())
    }
  }, [])

  const replying = state.phase === 'solving' && state.solve?.status === 'replying'
  useEffect(() => {
    if (!replying) return
    const timer = setTimeout(() => {
      apply({ type: 'reply', at: Date.now() })
    }, REPLY_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [replying, apply])

  const onMove = useCallback(
    (move: AttemptedMove) => {
      apply({ type: 'play', move, at: Date.now() })
    },
    [apply],
  )

  if (state.phase === 'done') return <Finished state={state} onExit={onExit} />

  const item = currentItem(state)
  const solve = state.solve
  if (item === null || solve === null) {
    return (
      <EmptyState
        icon={RotateCcw}
        title="Nothing to review right now"
        description="These positions could not be opened. They will be here next time."
        action={<Button onClick={onExit}>Back to the bank</Button>}
      />
    )
  }

  const inRecap = state.phase === 'recap' && state.outcome !== null
  const recap = buildRecap(item.mistake)
  const best = item.mistake.solution[0]
  const bestSquares =
    inRecap && best !== undefined ? [toSquare(best.slice(0, 2)), toSquare(best.slice(2, 4))] : []
  const hintFocus = state.hint?.focus ?? []
  const rung = nextRung(solve.hintUsed)

  return (
    <div className="page" data-testid="review-session">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}>
          Leave review
        </Button>
        <div className="flex-1">
          <p className="label">Review</p>
          <h1 className="page-title">
            {String(Math.min(cardsDone(state) + (inRecap ? 0 : 1), totalCards(state)))} of{' '}
            {String(totalCards(state))}
          </h1>
        </div>
        <ProgressDots dots={progressDots(state)} />
      </header>

      <div className="mt-4 grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex justify-center" aria-label="Review board">
          <div className="board-size w-full max-w-[min(100%,calc(100dvh-220px))] space-y-2 lg:max-w-[min(100%,70vh)]">
            <p className="text-sm font-semibold">
              {solve.userColor === 'white' ? 'White' : 'Black'} to play
            </p>
            <SolverBoard
              solve={solve}
              focus={inRecap ? bestSquares : hintFocus}
              onMove={onMove}
              label="Review board"
              announcement={announce(state)}
            />
          </div>
        </section>

        <aside className="card flex flex-col gap-4 p-4 sm:p-5" aria-label="Review panel">
          <div>
            <p className="label">Where this came from</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {item.mistake.originLabel ?? `Move ${String(item.mistake.moveNumber ?? 1)}`}
            </p>
          </div>

          {inRecap ? (
            <RecapPanel
              recap={recap}
              solved={state.outcome.solved}
              due={state.outcome.card.due}
              last={isLast(state)}
              onNext={() => {
                apply({ type: 'next', at: Date.now() })
              }}
            />
          ) : (
            <>
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Find the better move</p>
                <p className="mt-1">
                  You have seen this position before. Play the move you would choose now.
                </p>
              </div>
              {state.hint === null ? null : (
                <p
                  className="rounded-lg bg-reward-soft px-3 py-2 text-sm text-reward-ink"
                  role="status"
                >
                  {state.hint.text}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {rung === null ? null : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      apply({ type: 'hint', level: rung.level })
                    }}
                  >
                    <Lightbulb aria-hidden className="size-4" />
                    {solve.hintUsed === null ? 'Need a hint?' : `Next hint: ${rung.title}`}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    apply({ type: 'give-up', at: Date.now() })
                  }}
                >
                  Show me
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A hint is fine. It just means this one comes back a little sooner.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function isLast(state: ReviewSessionState): boolean {
  return state.index + 1 >= state.items.length
}

function announce(state: ReviewSessionState): string | undefined {
  if (state.phase !== 'recap' || state.outcome === null) return undefined
  return state.outcome.solved
    ? "That's the idea. Recalled."
    : 'That was not the idea this position is about. The better move is marked on the board.'
}

interface RecapPanelProps {
  readonly recap: Recap
  readonly solved: boolean
  readonly due: number
  readonly last: boolean
  readonly onNext: () => void
}

function RecapPanel({ recap, solved, due, last, onNext }: RecapPanelProps) {
  return (
    <div
      className={`rise rounded-xl border p-4 ${solved ? 'border-success/30 bg-accent/60' : 'border-cta/30 bg-cta-soft'}`}
      role="status"
    >
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-card text-primary ring-1 ring-border">
          {solved ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <RotateCcw aria-hidden className="size-4" />
          )}
        </span>
        <p className="font-display text-lg font-bold">
          {solved ? "That's the idea" : 'The idea you missed'}
        </p>
      </div>

      <div className="mt-3 rounded-lg bg-card p-3 text-sm">
        {recap.skipped ? null : (
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">You played</span>
            <span className="san">{recap.playedSan}</span>
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Better</span>
          <span className="san">{recap.bestSan}</span>
        </p>
        {recap.line.length > 1 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            The line: <span className="san">{recap.line.join(' ')}</span>
          </p>
        ) : null}
        {recap.evalNote === null ? null : (
          <p className="mt-2 text-xs text-muted-foreground">{recap.evalNote}</p>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed">{recap.explanation}</p>
      <p className="mt-2 text-xs text-muted-foreground">{comesBackLabel(due, new Date())}</p>

      <CtaButton className="mt-3 h-10" onClick={onNext}>
        {last ? 'See how it went' : 'Next position'}
        <ArrowRight aria-hidden className="size-4" />
      </CtaButton>
    </div>
  )
}

function Finished({
  state,
  onExit,
}: {
  readonly state: ReviewSessionState
  readonly onExit: () => void
}) {
  const summary = summarise(state)
  return (
    <div className="page" data-testid="review-done">
      <EmptyState
        icon={Check}
        title={summary.attempted === 0 ? 'Nothing to review right now' : "That's today's review"}
        description={
          summary.attempted === 0
            ? 'These positions could not be opened. They will be here next time.'
            : `${String(summary.recalled)} of ${String(summary.attempted)} recalled. ${
                summary.toRevisit === 0
                  ? 'Every one of them is a little more yours.'
                  : `${String(summary.toRevisit)} will come back soon, and that is how they stick.`
              }`
        }
        action={<CtaButton onClick={onExit}>Back to the bank</CtaButton>}
      />
      {summary.newlyMastered > 0 ? (
        <p className="mt-3 flex justify-center">
          <Badge variant="muted">{String(summary.newlyMastered)} moved to mastered</Badge>
        </p>
      ) : null}
    </div>
  )
}
