import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { cn } from '@/design/lib/utils'

import type * as React from 'react'

const TREND = {
  up: { icon: ArrowUpRight, className: 'text-success' },
  down: { icon: ArrowDownRight, className: 'text-destructive' },
  flat: { icon: Minus, className: 'text-muted-foreground' },
} as const

export type StatTrend = keyof typeof TREND

export interface StatCardProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  label: React.ReactNode
  value: React.ReactNode
  /** Small print under the number: a comparison, a denominator, a date range. */
  hint?: React.ReactNode
  /** Direction colours and icons the hint. Omit it for a neutral figure. */
  trend?: StatTrend
  /** Top-right slot — a badge, a sparkline legend, a menu. */
  action?: React.ReactNode
  size?: 'sm' | 'default' | 'lg'
}

const VALUE_SIZE = {
  sm: 'text-2xl',
  default: 'text-[28px]',
  lg: 'text-4xl',
} as const

/** A single number with its name and its story. Used across Today, Puzzles and Progress,
 *  which is why the trend colour lives here instead of being re-decided per screen. */
export function StatCard({
  label,
  value,
  hint,
  trend,
  action,
  size = 'default',
  className,
  ...props
}: StatCardProps) {
  const trendStyle = trend ? TREND[trend] : null
  const TrendIcon = trendStyle?.icon

  return (
    <div data-slot="stat-card" className={cn('card p-5', className)} {...props}>
      <div className="flex items-start justify-between gap-2">
        <span className="label">{label}</span>
        {action}
      </div>
      <div
        className={cn('mt-1 font-display leading-tight font-bold tabular-nums', VALUE_SIZE[size])}
      >
        {value}
      </div>
      {hint !== undefined ? (
        <div
          className={cn(
            'mt-0.5 flex items-center gap-1 text-xs',
            trendStyle ? cn('font-medium', trendStyle.className) : 'text-muted-foreground',
          )}
        >
          {TrendIcon ? <TrendIcon aria-hidden="true" className="size-3.5" /> : null}
          {hint}
        </div>
      ) : null}
    </div>
  )
}
