import { cn } from '@/design/lib/utils'

import type * as React from 'react'

const TONE = {
  primary: 'stroke-primary',
  cta: 'stroke-cta',
  reward: 'stroke-reward',
  success: 'stroke-success',
} as const

export interface RingProgressProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  value: number
  max?: number
  /** Outer diameter in px. The stroke scales with it. */
  size?: number
  thickness?: number
  tone?: keyof typeof TONE
  /** Spoken name, e.g. "Today's path". The percentage is announced with it. */
  label: string
  /** What sits in the hole — usually the percentage or a count. */
  children?: React.ReactNode
}

/** Circular progress for streaks, daily paths and lesson completion. It is a
 *  `progressbar` rather than decoration, so screen readers get the number too. */
export function RingProgress({
  value,
  max = 100,
  size = 96,
  thickness = 8,
  tone = 'primary',
  label,
  children,
  className,
  ...props
}: RingProgressProps) {
  const safeMax = max > 0 ? max : 100
  const clamped = Math.min(Math.max(value, 0), safeMax)
  const fraction = clamped / safeMax
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const percent = Math.round(fraction * 100)

  return (
    <div
      data-slot="ring-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      aria-valuetext={`${String(percent)}%`}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${String(size)} ${String(size)}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${String(size / 2)} ${String(size / 2)})`}
          className={cn('transition-[stroke-dashoffset] duration-500', TONE[tone])}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        {children ?? (
          <span className="font-display text-lg font-bold tabular-nums">{percent}%</span>
        )}
      </div>
    </div>
  )
}
