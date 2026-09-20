import { cn } from '@/design'
import type { Color, EngineScore } from '@/domain'

import {
  describeScore,
  displayPawns,
  formatScore,
  MAX_DISPLAY_PAWNS,
  MIN_DISPLAY_PAWNS,
  whiteShare,
} from './score-format'

/**
 * The eval bar: one number, made readable without pretending to be precise.
 *
 * It follows the board rather than the convention, so whoever sits at the bottom
 * of the board owns the bottom of the bar — a flipped board with an unflipped bar
 * makes every evaluation read backwards.
 */

const BLACK_FILL = 'bg-[#3b4a44]'
const WHITE_FILL = 'bg-white dark:bg-[#e9eee8]'

export interface EvalBarProps {
  /** `null` while the engine is off or has not answered yet. */
  readonly score: EngineScore | null
  readonly sideToMove: Color
  readonly orientation: Color
}

export function EvalBar({ score, sideToMove, orientation }: EvalBarProps) {
  const share = score === null ? 0.5 : whiteShare(score, sideToMove)
  const label = score === null ? '—' : formatScore(score, sideToMove)
  const topIsBlack = orientation === 'white'
  const topShare = topIsBlack ? 1 - share : share

  return (
    <div
      className="relative flex w-3.5 shrink-0 flex-col overflow-hidden rounded-full ring-1 ring-border sm:w-5"
      role="meter"
      aria-label="Evaluation"
      aria-valuemin={MIN_DISPLAY_PAWNS}
      aria-valuemax={MAX_DISPLAY_PAWNS}
      aria-valuenow={score === null ? 0 : displayPawns(score, sideToMove)}
      aria-valuetext={
        score === null ? 'not evaluated' : `${label}, ${describeScore(score, sideToMove)}`
      }
    >
      <div
        className={cn(
          'transition-[height] duration-300 motion-reduce:transition-none',
          topIsBlack ? BLACK_FILL : WHITE_FILL,
        )}
        style={{ height: `${String(Math.round(topShare * 100))}%` }}
      />
      <div className={cn('flex-1', topIsBlack ? WHITE_FILL : BLACK_FILL)} />
      <div className="absolute inset-x-0 top-1/2 h-px bg-cta" />
      <span
        className={cn(
          'absolute inset-x-0 bottom-1 text-center font-mono text-[9px] font-semibold max-sm:hidden',
          topIsBlack ? 'text-[#1b2620]' : 'text-white',
        )}
      >
        {label}
      </span>
    </div>
  )
}
