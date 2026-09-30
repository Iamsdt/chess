import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Clock,
  Flame,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  Search,
  Snowflake,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useContext, useMemo } from 'react'

import { ChatPanelContext, CommandPaletteContext } from '@/app/shell/shell-contexts'
import { Board } from '@/board'
import { useProfile, useStreak } from '@/data'
import { Button, CtaButton, SimpleTooltip, ThemeToggle, toast } from '@/design'
import { emptyBoardShapes, toFen, toSquare, type BoardShapes } from '@/domain'

const MISTAKE_FEN = toFen('r4rk1/pp3ppp/2p5/6n1/3P4/2P5/PP3P1P/R3Q1K1 b - - 0 17')

/**
 * Returns a time-of-day greeting (morning, afternoon, evening) based on current hour.
 */
function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Formats a date into a human readable day and month string (e.g. "Saturday, 19 September").
 */
function formatDateLabel(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

/**
 * Today Screen (`/`) — ported directly from `prototype/index.html`.
 *
 * The central daily launchpad for the player:
 * - Today's curated practice path (daily puzzle, lesson, mistake recall)
 * - Weekly streak and habit tracker
 * - Puzzle rating with sparkline trend
 * - Ongoing active correspondence / friend games
 * - Next course lesson
 * - Sage's weekly diagnostic insights
 * - Personalized weekly training schedule
 *
 * Responsive breakpoints:
 * - **< 640px (mobile)**: Single column, smaller heading, icon-only search
 * - **640–1023px (tablet portrait)**: 2-col sidebar cards, 4-col week plan
 * - **1024–1499px (tablet landscape / small desktop)**: Full layout, single column main
 * - **≥ 1500px (wide desktop)**: 2-column main + 290px sidebar
 */
export function TodayScreen() {
  const profile = useProfile()
  const streak = useStreak()
  const chatPanel = useContext(ChatPanelContext)
  const commandPalette = useContext(CommandPaletteContext)

  const displayName = profile?.displayName ?? 'Shudipto'
  const greeting = useMemo(() => getGreeting(), [])
  const dateLabel = useMemo(() => formatDateLabel(), [])
  const puzzleRating = profile?.puzzleRating ?? 1482

  const mistakeBoardShapes: BoardShapes = useMemo(
    () => ({
      ...emptyBoardShapes(),
      highlight: [toSquare('g5')],
    }),
    [],
  )

  const handleSearchClick = () => {
    if (commandPalette) {
      commandPalette.open()
    } else {
      toast('Search opens here (⌘K)')
    }
  }

  const handleAskSage = (prompt?: string) => {
    if (chatPanel) {
      chatPanel.open()
      chatPanel.focusComposer()
    }
    if (prompt) {
      toast(prompt)
    }
  }

  return (
    <div className="mx-auto max-w-[1060px] p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="label">{dateLabel}</p>
          <h1
            aria-label="Today"
            className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-[28px] md:text-[34px]"
          >
            {greeting}, {displayName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Full search button on sm+, icon-only on mobile */}
          <SimpleTooltip content="Search (⌘K)">
            <button
              type="button"
              onClick={handleSearchClick}
              className="btn btn-outline btn-icon size-10 rounded-full font-normal text-muted-foreground sm:hidden"
              aria-label="Search"
            >
              <Search className="size-4" aria-hidden="true" />
            </button>
          </SimpleTooltip>
          <button
            type="button"
            onClick={handleSearchClick}
            className="btn btn-outline hidden h-10 rounded-full font-normal text-muted-foreground sm:inline-flex"
          >
            <Search className="size-4" aria-hidden="true" />
            <span>Search</span>
            <span className="ml-4 font-mono text-[10px]">⌘K</span>
          </button>
          <ThemeToggle className="size-10 rounded-full" />
        </div>
      </header>

      <div className="mt-5 grid gap-6 min-[1500px]:grid-cols-[minmax(0,1fr)_290px] sm:mt-7">
        {/* Today's path */}
        <section aria-labelledby="path-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="path-h" className="font-display text-lg font-bold sm:text-xl">
              Today's path
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <span className="font-medium text-foreground">2 of 3</span> done · about 4 min left
            </div>
          </div>

          <ol className="relative mt-4 space-y-3 before:absolute before:top-6 before:bottom-6 before:left-[19px] before:w-0.5 before:rounded before:bg-[repeating-linear-gradient(to_bottom,var(--border)_0_6px,transparent_6px_12px)]">
            {/* Step 1: Daily Puzzle (Completed) */}
            <li className="relative flex items-center gap-3 pl-0 sm:gap-4">
              <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-4" aria-hidden="true" />
              </span>
              <div className="card flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 opacity-80 sm:px-4 sm:py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">Daily puzzle</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Back-rank mate · solved in 8s
                  </div>
                </div>
                <span className="badge shrink-0 text-muted-foreground">+6</span>
              </div>
            </li>

            {/* Step 2: Lesson (Completed) */}
            <li className="relative flex items-center gap-3 sm:gap-4">
              <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-4" aria-hidden="true" />
              </span>
              <div className="card flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 opacity-80 sm:px-4 sm:py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">Lesson · Double attacks II</div>
                  <div className="truncate text-xs text-muted-foreground">6 min · 7 of 7 steps</div>
                </div>
                <span className="badge shrink-0 text-muted-foreground">Done</span>
              </div>
            </li>

            {/* Step 3: Mistakes (Current Active Step) */}
            <li className="relative flex items-start gap-3 sm:gap-4">
              <span className="z-10 mt-5 grid size-10 shrink-0 place-items-center rounded-full border-[2.5px] border-cta bg-card font-display font-bold text-cta shadow-[0_0_0_6px_rgba(224,103,60,.12)]">
                3
              </span>
              <div className="card @container min-w-0 flex-1 overflow-hidden border-cta/30">
                <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 @[540px]:grid-cols-[minmax(0,1fr)_200px]">
                  <div>
                    <span className="badge border-transparent bg-reward-soft text-[#8a6310]">
                      <Sparkles className="mr-1 size-3.5" aria-hidden="true" />
                      Last step today
                    </span>
                    <h3 className="mt-2 font-display text-xl leading-[1.05] font-bold tracking-tight sm:mt-3 sm:text-2xl md:text-[30px]">
                      Give five mistakes a second chance
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      From this week's games. Recall them now and they come back in 3 days, then 7,
                      until they're yours.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-5">
                      <CtaButton asChild className="h-11">
                        <Link to="/mistakes">
                          <Play className="size-[18px]" aria-hidden="true" />
                          Start · 4 min
                        </Link>
                      </CtaButton>
                      <Button
                        variant="ghost"
                        className="h-11 text-muted-foreground"
                        onClick={() => {
                          toast('Moved to tomorrow. Your streak is safe.')
                        }}
                      >
                        Skip for today
                      </Button>
                    </div>
                    <div
                      role="group"
                      className="mt-4 flex items-center gap-1.5 sm:mt-5"
                      aria-label="5 positions"
                    >
                      <span className="h-1.5 w-8 rounded-full bg-cta" />
                      <span className="h-1.5 w-8 rounded-full bg-muted" />
                      <span className="h-1.5 w-8 rounded-full bg-muted" />
                      <span className="h-1.5 w-8 rounded-full bg-muted" />
                      <span className="h-1.5 w-8 rounded-full bg-muted" />
                    </div>
                  </div>

                  <figure className="max-w-[260px]">
                    <div className="overflow-hidden rounded-xl ring-1 ring-border">
                      <Board
                        fen={MISTAKE_FEN}
                        orientation="white"
                        coordinates={false}
                        movable="none"
                        shapes={mistakeBoardShapes}
                        label="Mistake review: Black to play"
                      />
                    </div>
                    <figcaption className="mt-2 text-xs text-muted-foreground">
                      <b className="font-medium text-foreground">Black to play.</b> What did the
                      knight see?
                    </figcaption>
                  </figure>
                </div>
              </div>
            </li>

            {/* Extra Practice Recommendation */}
            <li className="relative flex items-center gap-3 sm:gap-4">
              <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground">
                <Plus className="size-4" aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground sm:px-4 sm:py-3">
                <span className="min-w-0">
                  Got more time? <span className="text-foreground">8 fork puzzles</span> or a{' '}
                  <span className="text-foreground">game vs Stockfish 1200</span>
                </span>
                <Button asChild variant="ghost" className="h-8 shrink-0 px-3 text-xs">
                  <Link to="/puzzles">Add</Link>
                </Button>
              </div>
            </li>
          </ol>
        </section>

        {/* Right Column Stack */}
        <div className="grid content-start gap-4 min-[1500px]:grid-cols-1 sm:grid-cols-2">
          {/* Week Streak Card */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="label">This week</span>
              <span className="text-xs text-muted-foreground">
                {streak?.longest ? `${String(streak.current)} day streak` : 'Goal 5 of 7 days'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground sm:gap-1.5">
              <div>
                <div className="mx-auto grid size-7 place-items-center rounded-full bg-reward text-[#5a3f00] sm:size-8">
                  <Flame className="size-3 sm:size-3.5" aria-hidden="true" />
                </div>
                M
              </div>
              <div>
                <div className="mx-auto grid size-7 place-items-center rounded-full bg-reward text-[#5a3f00] sm:size-8">
                  <Flame className="size-3 sm:size-3.5" aria-hidden="true" />
                </div>
                T
              </div>
              <div>
                <div className="mx-auto grid size-7 place-items-center rounded-full bg-sky text-[#2d5a78] sm:size-8">
                  <Snowflake className="size-3 sm:size-3.5" aria-hidden="true" />
                </div>
                W
              </div>
              <div>
                <div className="mx-auto grid size-7 place-items-center rounded-full bg-reward text-[#5a3f00] sm:size-8">
                  <Flame className="size-3 sm:size-3.5" aria-hidden="true" />
                </div>
                T
              </div>
              <div>
                <div className="mx-auto grid size-7 place-items-center rounded-full bg-reward text-[#5a3f00] sm:size-8">
                  <Flame className="size-3 sm:size-3.5" aria-hidden="true" />
                </div>
                F
              </div>
              <div>
                <div className="mx-auto grid size-7 place-items-center rounded-full border-2 border-dashed border-reward text-[10px] font-semibold text-[#8a6310] sm:size-8">
                  2/3
                </div>
                S
              </div>
              <div>
                <div className="mx-auto size-7 rounded-full bg-muted sm:size-8" />S
              </div>
            </div>
          </div>

          {/* Puzzle Rating Card */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="label">Puzzle rating</span>
              <span className="badge border-transparent bg-accent text-accent-foreground">+64</span>
            </div>
            <div className="mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl">
              {puzzleRating}
            </div>
            <svg
              className="mt-2 h-12 w-full sm:h-14"
              viewBox="0 0 240 56"
              preserveAspectRatio="none"
              aria-label="Rating trend up"
            >
              <path
                d="M0,46 C30,44 40,50 70,38 S110,40 130,30 S175,30 195,20 S225,12 240,8"
                fill="none"
                stroke="#5f8b6c"
                strokeWidth="2.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <p className="text-xs text-muted-foreground">
              Better than you were 30 days ago at <span className="text-foreground">forks</span> and{' '}
              <span className="text-foreground">pins</span>.
            </p>
          </div>

          {/* Friends Live Correspondence Card */}
          <Link
            to="/friends/live"
            className="card block bg-lilac/60 p-4 transition hover:-translate-y-0.5 sm:p-5"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e9a15a] text-xs font-bold text-[#3b1d00]">
                RA
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">Rafi played …Qb6</div>
                <div className="truncate text-xs text-muted-foreground">
                  Najdorf · your move · no clock
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
          </Link>

          {/* Up Next in Course Card */}
          <Link
            to="/learn/lesson"
            className="card block bg-accent/60 p-4 transition hover:-translate-y-0.5 sm:p-5"
          >
            <div className="label">Up next in your course</div>
            <div className="mt-1 font-display text-base font-bold sm:text-lg">The royal fork</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-card">
                <div className="h-full w-[38%] rounded-full bg-primary" />
              </div>
              <span className="text-xs font-medium">38%</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Sage's Insights */}
      <section className="mt-6 sm:mt-8" aria-labelledby="ins-h">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="ins-h"
            className="flex items-center gap-2 font-display text-lg font-bold sm:text-xl"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-reward">
              <Brain className="size-3.5" aria-hidden="true" />
            </span>
            Sage noticed this week
          </h2>
          <span className="text-xs text-muted-foreground">
            From your last 9 games · updated 2h ago
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-3">
          {/* Pattern Card */}
          <article className="card flex flex-col border-cta/25 bg-[#fdf0ea] p-4 sm:p-5 dark:bg-cta/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-cta">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Pattern
            </div>
            <h3 className="mt-1.5 font-display text-base leading-snug font-bold sm:text-lg">
              Knight forks started 4 of your 5 losses
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Usually 2–4 moves after castling, with your queen a knight-jump from your king.
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <Button asChild className="h-8 bg-cta px-3 text-xs text-white hover:bg-cta-strong">
                <Link to="/puzzles/solve">
                  <Target className="size-3.5" aria-hidden="true" />8 fork puzzles
                </Link>
              </Button>
              <Button
                variant="outline"
                className="h-8 px-3 text-xs"
                aria-label="Ask Sage about knight forks"
                onClick={() => {
                  handleAskSage('Why do knight forks keep happening after I castle?')
                }}
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                Ask Sage
              </Button>
            </div>
          </article>

          {/* Strength Card */}
          <article className="card flex flex-col bg-accent/50 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <TrendingUp className="size-3.5" aria-hidden="true" />
              Strength
            </div>
            <h3 className="mt-1.5 font-display text-base leading-snug font-bold sm:text-lg">
              Your Italian Game is working
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              84.6% accuracy vs 78.2% elsewhere. Next idea:{' '}
              <span className="rounded bg-card px-1 font-mono text-xs text-foreground">a4</span>{' '}
              against …a6.
            </p>
            <div className="mt-auto pt-4">
              <Button asChild variant="outline" className="h-8 px-3 text-xs">
                <Link to="/openings">
                  <BookOpen className="size-3.5" aria-hidden="true" />
                  Open repertoire
                </Link>
              </Button>
            </div>
          </article>

          {/* Habit Card */}
          <article className="card flex flex-col bg-sky/50 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2d5a78]">
              <Clock className="size-3.5" aria-hidden="true" />
              Habit
            </div>
            <h3 className="mt-1.5 font-display text-base leading-snug font-bold sm:text-lg">
              You learn best around 8pm
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Puzzle success is 11% higher in evening sessions.
            </p>
            <div className="mt-auto pt-4">
              <Button
                variant="outline"
                className="h-8 px-3 text-xs"
                onClick={() => {
                  toast('Reminder set for 8:00 PM')
                }}
              >
                <Bell className="size-3.5" aria-hidden="true" />
                Remind me at 8pm
              </Button>
            </div>
          </article>
        </div>
      </section>

      {/* This Week's Plan */}
      <section className="card mt-5 p-4 sm:mt-6 sm:p-5" aria-labelledby="plan-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="plan-h" className="font-display text-base font-bold sm:text-lg">
              This week's plan
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Built by Sage around your weak spots · 15 min a day
            </p>
          </div>
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => {
              handleAskSage("Can we adjust this week's plan? I want more endgames.")
            }}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Adjust
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 md:grid-cols-7">
          <div className="rounded-lg bg-muted/60 p-2 opacity-60 sm:p-2.5">
            <div className="font-semibold">Mon</div>
            <div className="mt-1 text-muted-foreground">Forks I</div>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 opacity-60 sm:p-2.5">
            <div className="font-semibold">Tue</div>
            <div className="mt-1 text-muted-foreground">Sparring 1200</div>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 opacity-60 sm:p-2.5">
            <div className="font-semibold">Wed</div>
            <div className="mt-1 text-muted-foreground">Rest (freeze)</div>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 opacity-60 sm:p-2.5">
            <div className="font-semibold">Thu</div>
            <div className="mt-1 text-muted-foreground">Caro-Kann drill</div>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 opacity-60 sm:p-2.5">
            <div className="font-semibold">Fri</div>
            <div className="mt-1 text-muted-foreground">Forks II</div>
          </div>
          <div className="rounded-lg border-2 border-cta/40 bg-card p-2 sm:p-2.5">
            <div className="font-semibold text-cta">Sat · today</div>
            <div className="mt-1">Mistake review</div>
          </div>
          <div className="rounded-lg border border-dashed p-2 sm:p-2.5">
            <div className="font-semibold">Sun</div>
            <div className="mt-1 text-muted-foreground">Endgame: K+R vs K</div>
          </div>
        </div>
      </section>
    </div>
  )
}
