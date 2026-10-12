import { Crosshair, Eye, Lightbulb } from 'lucide-react'

import { cn } from '@/design'
import type { HintLevel } from '@/domain'

import { HINT_RUNGS } from '../hints'

import type { LucideIcon } from 'lucide-react'

export interface HintLadderProps {
  readonly used: HintLevel | null
  readonly onTake: (level: HintLevel) => void
  /** True once the puzzle is over; the ladder stays visible but stops being a choice. */
  readonly disabled?: boolean
  readonly className?: string
}

const RUNG_CHIPS: Record<HintLevel, { readonly icon: LucideIcon; readonly label: string }> = {
  nudge: { icon: Lightbulb, label: 'Nudge' },
  square: { icon: Crosshair, label: 'Square' },
  move: { icon: Eye, label: 'Show move' },
}

/**
 * Three rungs in a row under the board, opened one at a time.
 *
 * Only the next rung is operable. That is not a restriction for its own sake: a user who
 * jumps to "show me the move" without meeting the nudge loses the rating *and* the
 * lesson, so the ladder makes the cheaper help the easier thing to reach. Each button
 * carries what it will do as its tooltip, and the last one says what it will cost.
 * The hint text itself is shown by the verdict strip, next to the board.
 */
export function HintLadder({ used, onTake, disabled = false, className }: HintLadderProps) {
  const usedIndex = used === null ? -1 : HINT_RUNGS.findIndex((rung) => rung.level === used)

  return (
    <div
      role="group"
      aria-label="Hints"
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {HINT_RUNGS.map((rung, index) => {
        const isUsed = index <= usedIndex
        const isNext = index === usedIndex + 1
        const { icon: Icon, label } = RUNG_CHIPS[rung.level]

        return (
          <button
            key={rung.level}
            type="button"
            disabled={disabled || !isNext}
            onClick={() => {
              onTake(rung.level)
            }}
            title={rung.description}
            aria-label={`${rung.title}: ${rung.description}`}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
              isUsed
                ? 'border-reward/50 bg-reward-soft text-reward-ink'
                : isNext && !disabled
                  ? 'cursor-pointer bg-card hover:border-ring/60'
                  : 'border-dashed bg-card text-muted-foreground opacity-60',
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
