import { cn } from '@/design'
import { DECISION_FLAG_KEYS, DECISION_MODE_LABELS, DECISION_QUESTIONS } from '@/domain'

import { MODE_TITLES } from './mode-titles'

/**
 * Every question the model answered, as bars.
 *
 * Why `role="meter"`: a bar is a bounded measurement, and a screen reader should hear "Needs
 * engine, 91 percent" rather than nothing. The numbers are always printed too, so colour and
 * length are never the only carrier.
 */

function Bar({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <li className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2 text-xs">
      <span className={cn('truncate', strong === true && 'font-semibold')}>{label}</span>
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${String(percent)} percent`}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn(
            'block h-full rounded-full',
            strong === true ? 'bg-primary' : 'bg-primary/45',
          )}
          style={{ width: `${String(percent)}%` }}
        />
      </span>
      <span className="text-right text-muted-foreground tabular-nums">{percent}%</span>
    </li>
  )
}

export interface ProbabilityBarsProps {
  readonly mode?: Readonly<Record<string, number>> | undefined
  readonly flags: Readonly<Record<string, number | undefined>>
  readonly className?: string
}

export function ProbabilityBars({ mode, flags, className }: ProbabilityBarsProps) {
  const ranked =
    mode === undefined
      ? []
      : [...DECISION_MODE_LABELS].sort((a, b) => (mode[b] ?? 0) - (mode[a] ?? 0))
  return (
    <div className={cn('space-y-3', className)} data-slot="decision-bars">
      {mode === undefined ? null : (
        <section aria-label="Mode">
          <h3 className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Which mode
          </h3>
          <ul className="space-y-1">
            {ranked.map((label, index) => (
              <Bar
                key={label}
                label={MODE_TITLES[label] ?? label}
                value={mode[label] ?? 0}
                strong={index === 0}
              />
            ))}
          </ul>
        </section>
      )}
      <section aria-label="Questions about this message">
        <h3 className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Yes or no
        </h3>
        <ul className="space-y-1">
          {DECISION_FLAG_KEYS.map((key) => {
            const value = flags[key]
            if (value === undefined) return null
            const spec = DECISION_QUESTIONS.find((question) => question.key === key)
            return <Bar key={key} label={spec?.title ?? key} value={value} strong={value >= 0.5} />
          })}
        </ul>
      </section>
    </div>
  )
}
