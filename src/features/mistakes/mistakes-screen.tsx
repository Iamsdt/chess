import {
  BadgeCheck,
  CalendarCheck,
  ChevronRight,
  Clock,
  EyeOff,
  Inbox,
  Play,
  Repeat,
  Sparkle,
  Sprout,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Board } from '@/board'
import { useMistakes, useSrsCards } from '@/data'
import { Button, CtaButton, EmptyState, QualityGlyph, toast } from '@/design'
import type { MistakeId } from '@/domain'
import {
  DAILY_NEW_CAP,
  DAILY_REVIEW_CAP,
  loadItemFor,
  loadReviewQueue,
  postponeDue,
  type ReviewItem,
} from '@/features/srs'
import { ReviewSession } from '@/features/srs/review-session'

import { arrangeRows, buildBank, estimateMinutes, type SortOrder } from './bank'

/** Cards shown before "Show more"; three columns of two keeps the first screen calm. */
const PAGE_SIZE = 6

const SORTS: readonly { id: SortOrder; label: string }[] = [
  { id: 'due', label: 'Due first' },
  { id: 'newest', label: 'Newest' },
  { id: 'game', label: 'By game' },
]

/**
 * MistakesScreen (`/mistakes`) — ported from `prototype/mistakes.html`.
 *
 * The Mistake Bank on real data: positions the player erred in, scheduled by FSRS.
 * - Due hero with a 4-step schedule strip
 * - Mastery pipeline: New -> Learning -> Reviewing -> Mastered
 * - Theme filtering, sorting, board previews and explanation reveals
 * - "Start review" runs the session in place, so no route is needed
 */
export function MistakesScreen() {
  const mistakes = useMistakes()
  const cards = useSrsCards('mistake')

  const [session, setSession] = useState<readonly ReviewItem[] | null>(null)
  const [starting, setStarting] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('due')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(new Set())

  const bank = useMemo(
    () =>
      mistakes === undefined || cards === undefined ? null : buildBank(mistakes, cards, new Date()),
    [mistakes, cards],
  )
  const rows = useMemo(
    () => (bank === null ? [] : arrangeRows(bank.rows, selectedTheme, sortOrder)),
    [bank, selectedTheme, sortOrder],
  )

  if (session !== null) {
    return (
      <ReviewSession
        items={session}
        onExit={() => {
          setSession(null)
        }}
      />
    )
  }

  const startReview = async () => {
    setStarting(true)
    try {
      const items = await loadReviewQueue(new Date())
      if (items.length === 0) {
        toast('Nothing is due right now. Small and steady wins.')
        return
      }
      setSession(items)
    } finally {
      setStarting(false)
    }
  }

  const tryOne = async (id: MistakeId) => {
    const loaded = await loadItemFor(id, new Date())
    if (loaded.ok && loaded.value !== undefined) setSession([loaded.value])
    else toast('That position could not be opened.')
  }

  const postpone = async () => {
    const moved = await postponeDue(new Date())
    toast(
      moved.ok ? 'Moved to tomorrow. Your streak is safe.' : 'That could not be saved just now.',
    )
  }

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const dueCount = bank?.dueCount ?? 0
  const sessionSize = Math.min(dueCount, DAILY_NEW_CAP + DAILY_REVIEW_CAP)

  return (
    <div className="page">
      <header>
        <p className="label">Mistake Bank</p>
        <h1 aria-label="Mistake Bank" className="page-title mt-1">
          Ideas you missed, coming back
        </h1>
        <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
          Every position here is from your own games and puzzles. Recall one and it returns later: 1
          day, 3, 7, 21. Until it's yours.
        </p>
      </header>

      {bank === null ? (
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          Opening your bank…
        </p>
      ) : bank.total === 0 ? (
        <EmptyState
          className="mt-6"
          icon={Inbox}
          title="Nothing in the bank yet"
          description="Review a game or miss a puzzle and the idea lands here, ready to come back at the right time."
        />
      ) : (
        <>
          {/* Due Today Hero */}
          <section
            className="card @container mt-4 overflow-hidden border-cta/30 sm:mt-6"
            aria-labelledby="due-h"
          >
            <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:p-7 @[720px]:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
              <div>
                <span className="badge border-transparent bg-cta-soft text-cta">
                  <CalendarCheck className="mr-1 size-3.5" aria-hidden="true" />
                  Due today
                </span>
                <h2
                  id="due-h"
                  className="mt-2.5 font-display text-3xl leading-none font-bold tracking-tight sm:mt-3 sm:text-[40px]"
                >
                  {dueCount} <span className="text-2xl sm:text-[30px]">due today</span>
                </h2>
                <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                  {dueCount === 0
                    ? "You're all caught up. The next one returns on its own."
                    : `${String(bank.newDue)} new, ${String(bank.seenDue)} you've seen before. You play the move; the answer never shows first.`}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:mt-5 sm:gap-3">
                  <CtaButton
                    className="h-10 sm:h-11"
                    disabled={dueCount === 0 || starting}
                    onClick={() => {
                      void startReview()
                    }}
                  >
                    <Play className="size-[18px]" aria-hidden="true" />
                    Start review
                    {dueCount === 0 ? '' : ` · ~${String(estimateMinutes(sessionSize))} min`}
                  </CtaButton>
                  <Button
                    variant="ghost"
                    className="h-10 text-muted-foreground sm:h-11"
                    disabled={dueCount === 0}
                    onClick={() => {
                      void postpone()
                    }}
                  >
                    Not today
                  </Button>
                </div>
              </div>

              {/* Schedule Strip */}
              <div>
                <p className="label">Coming up</p>
                <ol className="mt-2 grid grid-cols-2 gap-2 text-center min-[440px]:grid-cols-4">
                  <li className="rounded-xl border-2 border-cta/40 bg-cta-soft p-2 sm:p-2.5">
                    <div className="font-display text-xl font-bold text-cta sm:text-2xl">
                      {bank.strip.today}
                    </div>
                    <div className="text-[11px] font-medium text-cta">Today</div>
                  </li>
                  {[
                    { label: 'Tomorrow', value: bank.strip.tomorrow },
                    { label: 'In 3 days', value: bank.strip.inThreeDays },
                    { label: 'This week', value: bank.strip.thisWeek },
                  ].map((slot) => (
                    <li key={slot.label} className="rounded-xl bg-muted/70 p-2 sm:p-2.5">
                      <div className="font-display text-xl font-bold sm:text-2xl">{slot.value}</div>
                      <div className="text-[11px] text-muted-foreground">{slot.label}</div>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-muted-foreground">
                  Small and steady beats cramming. We never schedule more than{' '}
                  {DAILY_NEW_CAP + DAILY_REVIEW_CAP} a day.
                </p>
              </div>
            </div>
          </section>

          {/* Mastery Pipeline */}
          <section className="card mt-3.5 p-4 sm:mt-4 sm:p-5" aria-labelledby="pipe-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="pipe-h" className="font-display text-base font-bold sm:text-lg">
                From missed to mastered
              </h2>
              <span className="text-xs text-muted-foreground">
                {bank.total} positions · {bank.masteredThisWeek} mastered this week
              </span>
            </div>
            <ol className="mt-3.5 grid grid-cols-2 gap-2 sm:mt-4 md:grid-cols-4">
              <PipelineStep
                tone="bg-lilac/70"
                inkClass="text-lilac-ink"
                icon={<Sparkle className="size-3.5" aria-hidden="true" />}
                title="New"
                count={bank.pipeline.new}
                note="Not tried yet"
                arrow
              />
              <PipelineStep
                tone="bg-cta-soft"
                inkClass="text-cta"
                icon={<Sprout className="size-3.5" aria-hidden="true" />}
                title="Learning"
                count={bank.pipeline.learning}
                note="Back in 1 to 3 days"
                arrow
              />
              <PipelineStep
                tone="bg-sky/70"
                inkClass="text-sky-ink"
                icon={<Repeat className="size-3.5" aria-hidden="true" />}
                title="Reviewing"
                count={bank.pipeline.reviewing}
                note="Back in 7 to 21 days"
                arrow
              />
              <PipelineStep
                tone="bg-accent"
                inkClass="text-primary"
                icon={<BadgeCheck className="size-3.5" aria-hidden="true" />}
                title="Mastered"
                count={bank.pipeline.mastered}
                note="Recalled 3 times in a row"
              />
            </ol>
          </section>

          {/* Positions List */}
          <section className="mt-6 sm:mt-8" aria-labelledby="list-h">
            <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
              <h2 id="list-h" className="font-display text-lg font-bold sm:text-xl">
                Your positions
              </h2>
              <div className="seg text-xs" role="tablist" aria-label="Sort order">
                {SORTS.map((sort) => (
                  <button
                    key={sort.id}
                    type="button"
                    role="tab"
                    aria-selected={sortOrder === sort.id}
                    className={sortOrder === sort.id ? 'is-active' : ''}
                    onClick={() => {
                      setSortOrder(sort.id)
                    }}
                  >
                    {sort.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="mt-3 flex flex-wrap gap-1.5 sm:gap-2"
              role="group"
              aria-label="Filter by theme"
            >
              {bank.chips.map((chip) => {
                const isActive = selectedTheme === chip.id
                return (
                  <button
                    key={chip.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setSelectedTheme(chip.id)
                      setVisible(PAGE_SIZE)
                    }}
                    className={`badge cursor-pointer px-2.5 py-0.5 text-xs transition-colors sm:px-3 sm:py-1 ${
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    {chip.label} · {chip.count}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 grid gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {rows.slice(0, visible).map((row) => {
                const isRevealed = revealedIds.has(row.id)
                return (
                  <article key={row.id} className="card flex flex-col overflow-hidden">
                    <button
                      type="button"
                      className="block cursor-pointer bg-muted/40 p-2.5 sm:p-3"
                      aria-label={`Try this position: ${row.origin}`}
                      onClick={() => {
                        void tryOne(row.id)
                      }}
                    >
                      <div className="overflow-hidden rounded-lg ring-1 ring-border">
                        <Board
                          fen={row.mistake.fen}
                          orientation={row.mistake.yourColor}
                          coordinates={false}
                          movable="none"
                          label={`Board: ${row.mistake.yourColor === 'white' ? 'White' : 'Black'} to move`}
                        />
                      </div>
                    </button>

                    <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`badge border-transparent ${row.themeTone}`}>
                          {row.themeLabel}
                        </span>
                        <span
                          className={`badge border-transparent ${
                            row.isDue ? 'bg-cta-soft text-cta' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {row.isDue ? <Clock className="mr-1 size-3" aria-hidden="true" /> : null}
                          {row.dueText}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">{row.origin}</p>
                      <p className="mt-2 flex items-center gap-2 text-sm whitespace-nowrap">
                        {row.skipped ? (
                          <span className="text-muted-foreground">You skipped this one</span>
                        ) : (
                          <>
                            <span className="text-muted-foreground">What you played</span>
                            <span className="san">{row.mistake.playedSan}</span>
                            <QualityGlyph quality={row.quality} />
                          </>
                        )}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          toggleReveal(row.id)
                        }}
                        className="group mt-2 w-full cursor-pointer rounded-lg border border-dashed p-2.5 text-left text-sm"
                        aria-label="Reveal the better idea"
                        aria-expanded={isRevealed}
                      >
                        {isRevealed ? (
                          <span className="block text-xs leading-relaxed text-foreground">
                            {row.mistake.explanation}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                            <EyeOff className="size-3.5" aria-hidden="true" />
                            Reveal after you try
                          </span>
                        )}
                      </button>

                      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
                        <span
                          className="flex items-center gap-1"
                          role="group"
                          aria-label={`Recall streak ${String(row.recallStreak)} of 3`}
                        >
                          {[1, 2, 3].map((step) => (
                            <span
                              key={step}
                              className={`size-2 rounded-full ${
                                row.recallStreak >= step ? 'bg-primary' : 'bg-muted-foreground/25'
                              }`}
                            />
                          ))}
                          <span className="ml-1">{row.stateLabel}</span>
                        </span>
                        <button
                          type="button"
                          className="cursor-pointer font-medium text-primary hover:underline"
                          onClick={() => {
                            void tryOne(row.id)
                          }}
                        >
                          Try it
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {rows.length === 0 ? (
              <EmptyState
                className="mt-4"
                icon={Inbox}
                title="No positions with that theme"
                description="Pick another chip, or choose All."
              />
            ) : null}

            {rows.length > visible ? (
              <div className="mt-5 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setVisible((count) => count + PAGE_SIZE)
                  }}
                >
                  Show more ({rows.length - visible} left)
                </Button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}

interface PipelineStepProps {
  readonly tone: string
  readonly inkClass: string
  readonly icon: React.ReactNode
  readonly title: string
  readonly count: number
  readonly note: string
  readonly arrow?: boolean
}

function PipelineStep({
  tone,
  inkClass,
  icon,
  title,
  count,
  note,
  arrow = false,
}: PipelineStepProps) {
  return (
    <li className={`relative rounded-xl p-3 sm:p-4 ${tone}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold sm:gap-2 ${inkClass}`}>
        {icon}
        {title}
      </div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl">{count}</div>
      <div className="text-xs text-muted-foreground">{note}</div>
      {arrow ? (
        <ChevronRight
          className="absolute top-1/2 -right-2.5 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-card p-0.5 text-muted-foreground ring-1 ring-border md:block"
          aria-hidden="true"
        />
      ) : null}
    </li>
  )
}
