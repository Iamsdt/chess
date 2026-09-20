import { Cpu, User } from 'lucide-react'

import { cn } from '@/design'

import { formatClock, LOW_TIME_MS } from '../clock'

export interface PlayerStripProps {
  readonly name: string
  readonly subtitle: string
  readonly isEngine: boolean
  /** `null` for an untimed game, where no clock is drawn at all. */
  readonly remainingMs: number | null
  readonly running: boolean
  readonly toMove: boolean
}

/** The name/clock row above and below the board. One component so the two sides
 *  cannot drift apart, and so the low-time treatment is defined exactly once. */
export function PlayerStrip({
  name,
  subtitle,
  isEngine,
  remainingMs,
  running,
  toMove,
}: PlayerStripProps) {
  const Icon = isEngine ? Cpu : User
  const low = remainingMs !== null && remainingMs <= LOW_TIME_MS
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className={cn('text-xs', toMove ? 'text-success' : 'text-muted-foreground')}>
          {toMove ? 'To move' : subtitle}
        </div>
      </div>
      {remainingMs === null ? null : (
        <output
          aria-label={`${name} clock`}
          className={cn(
            'ml-auto rounded-lg px-3 py-1 font-mono text-lg tabular-nums',
            running ? 'bg-foreground text-background' : 'bg-muted text-foreground',
            low && 'bg-destructive text-white',
          )}
        >
          {formatClock(remainingMs)}
          {low ? <span className="sr-only"> — low on time</span> : null}
        </output>
      )}
    </div>
  )
}
