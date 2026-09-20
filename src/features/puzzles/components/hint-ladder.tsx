import { Lightbulb, Lock, LockOpen } from 'lucide-react'

import { cn } from '@/design'
import type { HintLevel } from '@/domain'

import { HINT_RUNGS, type RevealedHint } from '../hints'

export interface HintLadderProps {
  readonly used: HintLevel | null
  readonly hint: RevealedHint | null
  readonly onTake: (level: HintLevel) => void
  /** True once the puzzle is over; the ladder stays visible but stops being a choice. */
  readonly disabled?: boolean
}

/**
 * Three rungs, opened one at a time.
 *
 * Only the next rung is operable. That is not a restriction for its own sake: a user who
 * jumps to "show me the move" without meeting the nudge loses the rating *and* the
 * lesson, so the ladder makes the cheaper help the easier thing to reach. Every rung says
 * what it will do before it is opened, and the last one says what it will cost.
 */
export function HintLadder({ used, hint, onTake, disabled = false }: HintLadderProps) {
  const usedIndex = used === null ? -1 : HINT_RUNGS.findIndex((rung) => rung.level === used)

  return (
    <section aria-labelledby="hint-ladder-heading">
      <div className="flex items-center justify-between">
        <h3 id="hint-ladder-heading" className="text-sm font-semibold">
          Hint ladder
        </h3>
        <span className="text-xs text-muted-foreground">
          {usedIndex + 1} of {HINT_RUNGS.length} used
        </span>
      </div>
      <ol className="mt-2.5 space-y-2">
        {HINT_RUNGS.map((rung, index) => {
          const isUsed = index <= usedIndex
          const isNext = index === usedIndex + 1
          const showing = isUsed && hint?.level === rung.level

          return (
            <li key={rung.level}>
              <button
                type="button"
                disabled={disabled || !isNext}
                onClick={() => {
                  onTake(rung.level)
                }}
                aria-describedby={showing ? `hint-text-${rung.level}` : undefined}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
                  isUsed
                    ? 'border-reward/50 bg-reward-soft'
                    : isNext
                      ? 'cursor-pointer bg-card hover:border-ring/60'
                      : 'border-dashed bg-card opacity-70',
                )}
              >
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                    isUsed ? 'bg-reward text-[#5a3f00]' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{rung.title}</span>
                  <span className="block text-xs text-muted-foreground">{rung.description}</span>
                </span>
                {isUsed ? (
                  <Lightbulb aria-hidden className="mt-0.5 size-4 text-reward-ink" />
                ) : isNext ? (
                  <LockOpen aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
                ) : (
                  <Lock aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
                )}
              </button>
              {showing ? (
                <p
                  id={`hint-text-${rung.level}`}
                  className="mt-1.5 rounded-lg bg-reward-soft px-3 py-2 text-sm text-reward-ink"
                >
                  {hint.text}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
