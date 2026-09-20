import { Badge, cn } from '@/design'

import type { ThemeMastery } from '../mastery'

export interface ThemeMasteryGridProps {
  readonly mastery: readonly ThemeMastery[]
  readonly onPractise: (theme: string) => void
  readonly limit?: number
}

const TONE_LABEL = {
  'needs-love': 'Needs love',
  steady: 'Coming along',
  strong: 'Strong',
} as const

const percent = (value: number): string => `${String(Math.round(value * 100))}%`

/**
 * Theme mastery, weakest first, each one a way into a set on that theme.
 *
 * "Needs love" rather than "weak": these are the user's own numbers about their own
 * practice, and the screen's job is to make the next session obvious, not to grade them.
 */
export function ThemeMasteryGrid({ mastery, onPractise, limit = 8 }: ThemeMasteryGridProps) {
  const shown = mastery.slice(0, limit)

  return (
    <div className="mt-4 grid gap-3 @[480px]:grid-cols-2 @[640px]:grid-cols-4">
      {shown.map((entry) => (
        <button
          key={entry.theme}
          type="button"
          onClick={() => {
            onPractise(entry.theme)
          }}
          className={cn(
            'card card-hover cursor-pointer p-4 text-left',
            entry.tone === 'needs-love' && 'border-cta/30',
          )}
        >
          <span className="text-sm font-semibold">{entry.theme}</span>
          <span className="mt-3 flex items-center gap-3">
            <span className="progress">
              <span
                className={cn('block', entry.tone === 'needs-love' && '!bg-cta')}
                style={{ width: percent(entry.mastery) }}
              />
            </span>
            <span className="text-xs font-medium tabular-nums">{percent(entry.mastery)}</span>
          </span>
          <span className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{entry.solved} solved</span>
            {entry.tone === 'needs-love' ? (
              <Badge variant="cta">{TONE_LABEL[entry.tone]}</Badge>
            ) : (
              <span className={cn(entry.tone === 'strong' && 'text-success')}>
                {TONE_LABEL[entry.tone]}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
