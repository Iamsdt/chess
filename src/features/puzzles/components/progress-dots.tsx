import { cn } from '@/design'

import type { ProgressDot } from '../session'

const TONE: Record<ProgressDot, string> = {
  solved: 'bg-primary',
  missed: 'bg-q-mistake',
  current: 'bg-cta ring-2 ring-cta/25',
  todo: 'bg-muted',
}

export interface ProgressDotsProps {
  readonly dots: readonly ProgressDot[]
  /** `bar` is the hub's wide strip; `dots` is the solver header's row of circles. */
  readonly shape?: 'bar' | 'dots'
  readonly className?: string
}

/**
 * The set's progress, as one shape for the whole feature.
 *
 * It is a single image to a screen reader rather than a list of ten unlabelled dots: the
 * useful sentence is "three solved, one missed, six to go", not ten separate ones.
 */
export function ProgressDots({ dots, shape = 'dots', className }: ProgressDotsProps) {
  const solved = dots.filter((dot) => dot === 'solved').length
  const missed = dots.filter((dot) => dot === 'missed').length
  const todo = dots.filter((dot) => dot === 'todo').length
  const parts = [
    `${String(solved)} solved`,
    `${String(missed)} missed`,
    dots.includes('current') ? 'one in front of you' : null,
    `${String(todo)} to go`,
  ].filter((part): part is string => part !== null)

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="img"
      aria-label={`Set progress: ${parts.join(', ')}`}
    >
      {dots.map((dot, index) => (
        <span
          // The dots have no identity beyond their position in the set.
          key={`${dot}-${String(index)}`}
          className={cn(
            'rounded-full',
            shape === 'bar' ? 'h-1.5 w-7' : 'size-2.5',
            dot === 'current' && shape === 'dots' && 'size-3',
            TONE[dot],
          )}
        />
      ))}
    </div>
  )
}
