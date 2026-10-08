import { Check, Play, Trophy, X, Zap } from 'lucide-react'

import { Button } from '@/design'
import type { Color } from '@/domain'

import { formatClock } from './use-countdown'

import type { AttemptBadge } from './attempt-badges'
import type { VisionRecord } from './drill-records'
import type { Round } from './use-round'
import type { ReactNode } from 'react'

/** What every vision round receives from the screen. */
export interface VisionRoundProps {
  readonly orientation: Color
  /** The stored best, as it stood before this round. */
  readonly record: VisionRecord
  /** Called once with the final score when the clock runs out. */
  readonly onComplete: (score: number) => void
}

export function AttemptStrip({ badges }: { readonly badges: readonly AttemptBadge[] }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <div className="label">Last three</div>
      {badges.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Your answers appear here.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5 font-mono text-xs">
          {badges.map((item) => (
            <li
              key={item.id}
              className={`badge ${
                item.correct ? 'badge-soft' : 'border-transparent bg-cta-soft font-medium text-cta'
              }`}
            >
              {item.correct ? (
                <Check className="mr-1 size-3" aria-hidden="true" />
              ) : (
                <X className="mr-1 size-3" aria-hidden="true" />
              )}
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface BestFooterProps {
  readonly record: VisionRecord
  readonly score: number
  readonly unit: string
}

function BestFooter({ record, score, unit }: BestFooterProps) {
  if (record.plays === 0) {
    return <>No score yet. Play a round to set your best.</>
  }
  const gap = record.best - score
  return (
    <>
      Your best: <b className="font-semibold text-foreground">{String(record.best)}</b> {unit}
      {gap > 0 ? ` · ${String(gap)} to go` : ' · you are past it'}
    </>
  )
}

interface VisionPanelProps {
  readonly round: Round
  readonly record: VisionRecord
  /** Plural noun for the score: "in a minute", "checks", "routes". */
  readonly unit: string
  readonly startLabel: string
  readonly intro: string
  readonly children: ReactNode
}

/**
 * The right-hand panel shared by all four drills: the clock, the score, then either
 * the "start" gate, the drill itself, or the end-of-round summary.
 */
export function VisionPanel({
  round,
  record,
  unit,
  startLabel,
  intro,
  children,
}: VisionPanelProps) {
  return (
    <aside
      className="card flex min-h-0 flex-col overflow-hidden lg:max-h-[calc(100dvh-56px-48px)]"
      aria-label="Drill panel"
    >
      {/* Top Score Bar */}
      <div className="grid grid-cols-3 border-b text-center">
        <div className="p-2.5 sm:p-3">
          <div className="label text-[11px] sm:text-xs">Time</div>
          <div
            className={`clock mx-auto mt-0.5 w-fit font-mono text-base font-bold sm:mt-1 sm:text-lg ${
              round.status === 'running' ? 'is-running' : ''
            }`}
            role="timer"
            aria-label="Time left"
          >
            {formatClock(round.remaining)}
          </div>
        </div>
        <div className="border-x p-2.5 sm:p-3">
          <div className="label text-[11px] sm:text-xs">Score</div>
          <div className="mt-0.5 font-display text-2xl leading-8 font-bold tabular-nums sm:mt-1 sm:text-3xl sm:leading-9">
            {String(round.score)}
          </div>
        </div>
        <div className="p-2.5 sm:p-3">
          <div className="label text-[11px] sm:text-xs">Streak</div>
          <div className="mt-0.5 inline-flex items-center gap-1 font-display text-2xl leading-8 font-bold text-emerald-600 tabular-nums sm:mt-1 sm:text-3xl sm:leading-9 dark:text-emerald-400">
            <Zap className="size-4 sm:size-5" aria-hidden="true" />
            <span>{String(round.streak)}</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 sm:space-y-5 sm:p-5">
        {round.status === 'idle' ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">{intro}</p>
            <Button type="button" className="h-10 px-5" onClick={round.start}>
              <Play className="mr-1.5 size-4" aria-hidden="true" />
              {startLabel}
            </Button>
          </div>
        ) : null}

        {round.status === 'expired' ? (
          <div className="space-y-2 py-6 text-center" role="status">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-reward-soft text-reward-ink">
              <Trophy className="size-5" aria-hidden="true" />
            </span>
            <h2 className="font-display text-xl font-bold">Time&apos;s up</h2>
            <p className="text-sm text-muted-foreground">
              You scored <b className="text-foreground">{String(round.score)}</b>{' '}
              {round.score > round.bestBefore
                ? 'a new best.'
                : `Your best is ${String(round.bestBefore)}.`}
            </p>
            <Button type="button" variant="outline" className="h-10 px-5" onClick={round.start}>
              Play again
            </Button>
          </div>
        ) : null}

        {round.status === 'running' ? children : null}
      </div>

      <div className="border-t p-3 text-center text-xs text-muted-foreground">
        <BestFooter record={record} score={round.score} unit={unit} />
      </div>
    </aside>
  )
}

interface BoardColumnProps {
  readonly width: string
  readonly children: ReactNode
  readonly caption?: ReactNode
}

/** The left-hand column: the board in its frame, with a caption underneath. */
export function BoardColumn({ width, children, caption }: BoardColumnProps) {
  return (
    <section className="flex justify-center" aria-label="Vision board">
      <div className={`w-full space-y-2 sm:space-y-2.5 ${width}`}>
        <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
          {children}
        </div>
        {caption === undefined ? null : (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            {caption}
          </p>
        )}
      </div>
    </section>
  )
}

export const BOARD_WIDTH = 'max-w-[min(100%,calc(100dvh-180px),560px)]'
