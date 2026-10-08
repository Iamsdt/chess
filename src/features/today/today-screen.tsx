import { Link, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  Check,
  Clock,
  Flame,
  Play,
  Plus,
  Search,
  Snowflake,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { CommandPaletteContext } from '@/app/shell/shell-contexts'
import { Board } from '@/board'
import {
  useAllAttempts,
  useAllLessonProgress,
  useAllSessions,
  useDueCount,
  useGames,
  useLessons,
  useMistakes,
  useProfile,
  usePuzzlesByIds,
  useSettings,
  useStreak,
} from '@/data'
import { Button, CtaButton, SimpleTooltip, ThemeToggle, toast } from '@/design'
import { emptyBoardShapes, toSquare, toTimestamp, type BoardShapes, type PuzzleId } from '@/domain'
import { pathProgress, planPath, viewStreak, type PathStep } from '@/features/habit'
import { buildCourse } from '@/features/learn/course'
import { ensureBuiltinLessons } from '@/features/learn/lesson-store'
import { buildProgress, practiceMsByDay, themeLabel } from '@/features/progress/progress-stats'
import { startNewSession } from '@/features/puzzles/queue'
import { configFor } from '@/features/puzzles/session'

import { buildInsights, ratingTrend, todayIn, weekCells, type WeekCell } from './today-stats'

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

/** The one place a step becomes a link or a button, so every step opens the same way. */
function StepAction({
  step,
  busy,
  onStart,
  className,
  children,
}: {
  readonly step: PathStep
  readonly busy: boolean
  readonly onStart: (step: PathStep) => void
  readonly className?: string
  readonly children: ReactNode
}) {
  if (step.launch !== undefined) {
    return (
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={() => {
          onStart(step)
        }}
      >
        {children}
      </button>
    )
  }
  if (step.lessonId !== undefined) {
    return (
      <Link to="/learn/lesson" search={{ id: step.lessonId }} className={className}>
        {children}
      </Link>
    )
  }
  if (step.gameId !== undefined) {
    return (
      <Link to="/games/review" search={{ id: step.gameId }} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <Link to={step.href} className={className}>
      {children}
    </Link>
  )
}

/**
 * Today Screen (`/`) — the daily launchpad, ported from `prototype/index.html`.
 *
 * Everything on it is computed from what is stored:
 * - Today's path: the next two to four things worth doing, ticked off by the practice
 *   sessions that actually happened today (see `planPath`)
 * - This week's streak, with the freeze, and the daily goal
 * - Puzzle rating with its 30-day trend
 * - The Mistake Bank, and patterns from the last 30 days
 *
 * A new user sees a calm, honest empty day, not someone else's progress.
 */
export function TodayScreen() {
  const profile = useProfile()
  const streak = useStreak()
  const commandPalette = useContext(CommandPaletteContext)

  const settings = useSettings()
  const attempts = useAllAttempts()
  const sessions = useAllSessions()
  const games = useGames()
  const mistakes = useMistakes()
  const dueMistakes = useDueCount()
  const lessons = useLessons()
  const lessonProgress = useAllLessonProgress()
  const navigate = useNavigate()
  const [launching, setLaunching] = useState<string | null>(null)

  // The shipped lessons install on first use; Today is where the plan first needs one.
  useEffect(() => {
    void ensureBuiltinLessons()
  }, [])
  // Fixed per visit so every card agrees with the others while the page is open.
  const [nowMs] = useState(() => Date.now())

  const puzzleIds = useMemo(
    () => [...new Set((attempts ?? []).map((attempt) => attempt.puzzleId))] as PuzzleId[],
    [attempts],
  )
  const puzzles = usePuzzlesByIds(puzzleIds)

  const timeZone = profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = useMemo(() => todayIn(timeZone, nowMs), [timeZone, nowMs])
  const streakView = useMemo(() => viewStreak(streak, today), [streak, today])
  const week = useMemo<WeekCell[]>(
    () => weekCells(today, practiceMsByDay(sessions ?? [], attempts ?? [], timeZone), streak),
    [today, sessions, attempts, timeZone, streak],
  )
  const trend = useMemo(() => ratingTrend(attempts ?? [], nowMs), [attempts, nowMs])
  const goalMinutes = settings.dailyGoalMinutes
  const practisedMinutes = Math.round(streakView.todayMs / 60_000)

  const progress = useMemo(
    () =>
      buildProgress({
        now: toTimestamp(nowMs),
        range: '30d',
        timeZone,
        profile,
        streak,
        attempts: attempts ?? [],
        sessions: sessions ?? [],
        games: games ?? [],
        mistakes: mistakes ?? [],
        themeOf: new Map((puzzles ?? []).map((puzzle) => [puzzle.id, puzzle.theme])),
      }),
    [nowMs, timeZone, profile, streak, attempts, sessions, games, mistakes, puzzles],
  )

  const weakest = useMemo(
    () =>
      progress.skills.length >= 2
        ? [...progress.skills].sort((a, b) => a.score - b.score)[0]
        : undefined,
    [progress.skills],
  )

  const nextLesson = useMemo(() => {
    if (lessons === undefined || lessonProgress === undefined) return undefined
    const next = buildCourse(lessons, lessonProgress).next
    return next === undefined
      ? undefined
      : {
          id: next.lesson.id,
          title: next.lesson.title,
          minutes: next.lesson.estimatedMinutes,
        }
  }, [lessons, lessonProgress])

  /** The newest game still waiting for a review, and whether one was finished today. */
  const { reviewTarget, reviewedToday } = useMemo(() => {
    const newestFirst = [...(games ?? [])].sort((a, b) => b.startedAt - a.startedAt)
    const waiting = newestFirst.find(
      (game) => game.reviewState === 'not-reviewed' || game.reviewState === 'failed',
    )
    return {
      reviewTarget:
        waiting === undefined
          ? undefined
          : {
              id: waiting.id,
              opponent: (waiting.youPlay === 'white' ? waiting.black : waiting.white).name,
            },
      reviewedToday: newestFirst.some(
        (game) => game.reviewState === 'reviewed' && todayIn(timeZone, game.updatedAt) === today,
      ),
    }
  }, [games, timeZone, today])

  const steps = useMemo(
    () =>
      planPath({
        todayKinds: (sessions ?? [])
          .filter((session) => session.day === today && session.state !== 'abandoned')
          .map((session) => session.kind),
        dueMistakes: dueMistakes ?? 0,
        totalMistakes: mistakes?.length ?? 0,
        weakestTheme:
          weakest === undefined
            ? undefined
            : { id: weakest.theme, label: themeLabel(weakest.theme) },
        nextLesson,
        reviewTarget,
        reviewedToday,
        dailyMinutes: goalMinutes,
      }),
    [
      sessions,
      today,
      dueMistakes,
      mistakes,
      weakest,
      nextLesson,
      reviewTarget,
      reviewedToday,
      goalMinutes,
    ],
  )
  const pathState = pathProgress(steps)
  const insights = useMemo(
    () => buildInsights(progress.skills, progress.heatmap),
    [progress.skills, progress.heatmap],
  )

  const displayName = profile?.displayName
  const greeting = useMemo(() => getGreeting(), [])
  const dateLabel = useMemo(() => formatDateLabel(), [])
  const puzzleRating = profile?.puzzleRating

  /** The newest saved mistake, shown on the board when the Mistake Bank is the next step. */
  const featuredMistake = mistakes?.[0]
  const mistakeShapes: BoardShapes = useMemo(
    () => ({
      ...emptyBoardShapes(),
      highlight:
        featuredMistake === undefined ? [] : [toSquare(featuredMistake.playedUci.slice(2, 4))],
    }),
    [featuredMistake],
  )

  /** Puzzle steps open their set first, so "Start" lands on a puzzle and not on a menu. */
  function startPuzzles(step: PathStep): void {
    const launch = step.launch
    if (launch === undefined || launching !== null) return
    setLaunching(step.id)
    const config =
      launch.kind === 'theme-puzzles'
        ? configFor('theme-puzzles', { theme: launch.theme })
        : configFor(launch.kind)
    void startNewSession(config)
      .catch(() => undefined)
      .then(() => navigate({ to: '/puzzles/solve' }))
      .finally(() => {
        setLaunching(null)
      })
  }

  const handleSearchClick = () => {
    if (commandPalette) {
      commandPalette.open()
    } else {
      toast('Search opens here (⌘K)')
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
            {displayName === undefined ? greeting : `${greeting}, ${displayName}`}
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
              <span className="font-medium text-foreground">
                {pathState.done} of {pathState.total}
              </span>{' '}
              done · {practisedMinutes} of {goalMinutes} min today
              {pathState.minutesLeft > 0 && <> · about {pathState.minutesLeft} min left</>}
            </div>
          </div>

          <ol className="relative mt-4 space-y-3 before:absolute before:top-6 before:bottom-6 before:left-[19px] before:w-0.5 before:rounded before:bg-[repeating-linear-gradient(to_bottom,var(--border)_0_6px,transparent_6px_12px)]">
            {steps.map((step, index) => {
              if (step.done) {
                return (
                  <li key={step.id} className="relative flex items-center gap-3 sm:gap-4">
                    <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-4" aria-hidden="true" />
                    </span>
                    <div className="card flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 opacity-80 sm:px-4 sm:py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{step.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{step.detail}</div>
                      </div>
                      <span className="badge shrink-0 text-muted-foreground">Done</span>
                    </div>
                  </li>
                )
              }
              if (index !== pathState.activeIndex) {
                return (
                  <li key={step.id} className="relative flex items-center gap-3 sm:gap-4">
                    <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full border bg-card font-display font-bold text-muted-foreground">
                      {index + 1}
                    </span>
                    <StepAction
                      step={step}
                      busy={launching !== null}
                      onStart={startPuzzles}
                      className="card flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 transition hover:-translate-y-0.5 sm:px-4 sm:py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{step.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{step.detail}</div>
                      </div>
                      <span className="badge shrink-0 text-muted-foreground">
                        {step.minutes} min
                      </span>
                    </StepAction>
                  </li>
                )
              }
              const showBoard = step.id === 'mistakes' && featuredMistake !== undefined
              return (
                <li key={step.id} className="relative flex items-start gap-3 sm:gap-4">
                  <span className="z-10 mt-5 grid size-10 shrink-0 place-items-center rounded-full border-[2.5px] border-cta bg-card font-display font-bold text-cta shadow-[0_0_0_6px_rgba(224,103,60,.12)]">
                    {index + 1}
                  </span>
                  <div className="card @container min-w-0 flex-1 overflow-hidden border-cta/30">
                    <div
                      className={
                        showBoard
                          ? 'grid gap-4 p-4 sm:gap-6 sm:p-6 @[540px]:grid-cols-[minmax(0,1fr)_200px]'
                          : 'p-4 sm:p-6'
                      }
                    >
                      <div>
                        <span className="badge border-transparent bg-reward-soft text-reward-ink">
                          <Sparkles className="mr-1 size-3.5" aria-hidden="true" />
                          {index === steps.length - 1 ? 'Last step today' : 'Up next'}
                        </span>
                        <h3 className="mt-2 font-display text-xl leading-[1.05] font-bold tracking-tight sm:mt-3 sm:text-2xl md:text-[30px]">
                          {step.title}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">{step.detail}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-5">
                          <CtaButton asChild className="h-11">
                            <StepAction
                              step={step}
                              busy={launching !== null}
                              onStart={startPuzzles}
                            >
                              <Play className="size-[18px]" aria-hidden="true" />
                              Start · {step.minutes} min
                            </StepAction>
                          </CtaButton>
                        </div>
                      </div>

                      {showBoard && (
                        <figure className="max-w-[260px]">
                          <div className="overflow-hidden rounded-xl ring-1 ring-border">
                            <Board
                              fen={featuredMistake.fen}
                              orientation={featuredMistake.yourColor}
                              coordinates={false}
                              movable="none"
                              shapes={mistakeShapes}
                              label={`Mistake review: ${featuredMistake.yourColor === 'white' ? 'White' : 'Black'} to play`}
                            />
                          </div>
                          <figcaption className="mt-2 text-xs text-muted-foreground">
                            <b className="font-medium text-foreground">
                              {featuredMistake.yourColor === 'white' ? 'White' : 'Black'} to play.
                            </b>{' '}
                            {featuredMistake.originLabel ?? 'From one of your games.'}
                          </figcaption>
                        </figure>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}

            {pathState.activeIndex === -1 && (
              <li className="relative flex items-center gap-3 sm:gap-4">
                <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground">
                  <Plus className="size-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground sm:px-4 sm:py-3">
                  <span className="min-w-0">
                    That's today's path. Got more time? Play{' '}
                    <span className="text-foreground">a game against Stockfish</span>.
                  </span>
                  <Button asChild variant="ghost" className="h-8 shrink-0 px-3 text-xs">
                    <Link to="/play">Play</Link>
                  </Button>
                </div>
              </li>
            )}
          </ol>
        </section>

        {/* Right Column Stack */}
        <div className="grid content-start gap-4 sm:max-[1499px]:grid-cols-2">
          {/* Week Streak Card */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="label">This week</span>
              <span className="text-xs text-muted-foreground">
                {streakView.current > 0
                  ? `${String(streakView.current)} day streak`
                  : 'Start your streak today'}
              </span>
            </div>
            <ol
              className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground sm:gap-1.5"
              aria-label="This week"
            >
              {week.map((cell) => (
                <li key={cell.name}>
                  <span className="sr-only">
                    {cell.name}:{' '}
                    {cell.kind === 'done'
                      ? 'practised'
                      : cell.kind === 'freeze'
                        ? 'covered by a freeze'
                        : cell.kind === 'today'
                          ? 'today, not yet'
                          : cell.kind === 'missed'
                            ? 'rest day'
                            : 'still to come'}
                  </span>
                  {cell.kind === 'done' && (
                    <div className="mx-auto grid size-7 place-items-center rounded-full bg-reward text-reward-foreground sm:size-8">
                      <Flame className="size-3 sm:size-3.5" aria-hidden="true" />
                    </div>
                  )}
                  {cell.kind === 'freeze' && (
                    <div className="mx-auto grid size-7 place-items-center rounded-full bg-sky text-sky-ink sm:size-8">
                      <Snowflake className="size-3 sm:size-3.5" aria-hidden="true" />
                    </div>
                  )}
                  {cell.kind === 'today' && (
                    <div className="mx-auto grid size-7 place-items-center rounded-full border-2 border-dashed border-reward text-[10px] font-semibold text-reward-ink sm:size-8">
                      {cell.minutes}/{goalMinutes}
                    </div>
                  )}
                  {(cell.kind === 'missed' || cell.kind === 'upcoming') && (
                    <div className="mx-auto size-7 rounded-full bg-muted sm:size-8" />
                  )}
                  <span aria-hidden="true">{cell.letter}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Puzzle Rating Card */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="label">Puzzle rating</span>
              {trend.change !== undefined && (
                <span className="badge border-transparent bg-accent text-accent-foreground">
                  {trend.change > 0 ? '+' : ''}
                  {trend.change}
                </span>
              )}
            </div>
            <div className="mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl">
              {puzzleRating ?? '—'}
            </div>
            {trend.path !== undefined && (
              <svg
                className="mt-2 h-12 w-full sm:h-14"
                viewBox="0 0 240 56"
                preserveAspectRatio="none"
                role="img"
                aria-label={`Puzzle rating over the last 30 days, ${trend.change !== undefined && trend.change < 0 ? 'down' : 'up'} ${String(Math.abs(trend.change ?? 0))}`}
              >
                <path
                  d={trend.path}
                  fill="none"
                  stroke="var(--q-best)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {trend.change === undefined
                ? 'Solve a few rated puzzles and your 30-day trend appears here.'
                : trend.change >= 0
                  ? `Up ${String(trend.change)} points in the last 30 days.`
                  : `Down ${String(Math.abs(trend.change))} points in the last 30 days. Rough weeks happen.`}
            </p>
          </div>

          {/* Mistake Bank Card */}
          <Link
            to="/mistakes"
            className="card block bg-accent/60 p-4 transition hover:-translate-y-0.5 sm:p-5"
          >
            <div className="label">Mistake Bank</div>
            {(mistakes?.length ?? 0) === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Nothing saved yet. Review a game and the ideas you missed land here.
              </p>
            ) : (
              <>
                <div className="mt-1 font-display text-base font-bold sm:text-lg">
                  {dueMistakes ?? 0} due · {mistakes?.length ?? 0} saved
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each one comes back a little later, until it is yours.
                </p>
              </>
            )}
          </Link>
        </div>
      </div>

      {/* Patterns */}
      <section className="mt-6 sm:mt-8" aria-labelledby="ins-h">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="ins-h"
            className="flex items-center gap-2 font-display text-lg font-bold sm:text-xl"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-reward">
              <TrendingUp className="size-3.5" aria-hidden="true" />
            </span>
            Your patterns this month
          </h2>
          <span className="text-xs text-muted-foreground">
            From your last 30 days, worked out on this device
          </span>
        </div>

        {insights.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Practise a few puzzles in different themes, and play and review a game or two. What you
            are strong at, and what needs a little love, shows up here.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-3">
            {insights.map((insight) => (
              <article
                key={insight.id}
                className={
                  insight.id === 'weak'
                    ? 'card flex flex-col border-cta/25 bg-cta-soft p-4 sm:p-5'
                    : insight.id === 'strong'
                      ? 'card flex flex-col bg-accent/50 p-4 sm:p-5'
                      : 'card flex flex-col bg-sky/50 p-4 sm:p-5'
                }
              >
                <div
                  className={
                    insight.id === 'weak'
                      ? 'flex items-center gap-2 text-xs font-semibold text-cta'
                      : insight.id === 'strong'
                        ? 'flex items-center gap-2 text-xs font-semibold text-primary'
                        : 'flex items-center gap-2 text-xs font-semibold text-sky-ink'
                  }
                >
                  {insight.id === 'weak' && (
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                  )}
                  {insight.id === 'strong' && (
                    <TrendingUp className="size-3.5" aria-hidden="true" />
                  )}
                  {insight.id === 'habit' && <Clock className="size-3.5" aria-hidden="true" />}
                  {insight.label}
                </div>
                <h3 className="mt-1.5 font-display text-base leading-snug font-bold sm:text-lg">
                  {insight.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{insight.body}</p>
                {insight.action !== undefined && (
                  <div className="mt-auto pt-4">
                    <Button asChild variant="outline" className="h-8 px-3 text-xs">
                      <Link to={insight.action.to}>
                        {insight.id === 'weak' && (
                          <Target className="size-3.5" aria-hidden="true" />
                        )}
                        {insight.action.label}
                      </Link>
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
