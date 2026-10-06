import type { GameRow, PracticeSession } from '@/data'
import {
  localDateOf,
  toTimestamp,
  type LocalDate,
  type Timestamp,
  type MistakeEntry,
  type Profile,
  type PuzzleAttempt,
  type StreakState,
} from '@/domain'

/**
 * S22 · Everything the Growth screen shows, computed from stored rows.
 *
 * Pure on purpose: the screen hands in rows and a clock and gets back plain values, so
 * every number on it can be tested against a handful of fixtures instead of through the
 * DOM. Nothing here reads storage, and nothing is invented — a figure that cannot be
 * computed from the rows is `undefined`, and the screen says so rather than guessing.
 */

export type TimeRange = '30d' | '90d' | 'all'

const DAY_MS = 86_400_000
const HEATMAP_WEEKS = 16

export interface ProgressInput {
  readonly now: Timestamp
  readonly range: TimeRange
  readonly timeZone: string
  readonly profile: Profile | undefined
  readonly streak: StreakState | undefined
  readonly attempts: readonly PuzzleAttempt[]
  readonly sessions: readonly PracticeSession[]
  readonly games: readonly GameRow[]
  readonly mistakes: readonly MistakeEntry[]
  /** Lichess theme of a puzzle id, once looked up; unknown ids are simply left out. */
  readonly themeOf: ReadonlyMap<string, string>
}

/* ------------------------------------------------------------------ windows */

interface Window {
  readonly from: number
  /** The equally long stretch before `from`, or `null` for "all time". */
  readonly previousFrom: number | null
}

export function windowFor(range: TimeRange, now: number): Window {
  if (range === 'all') return { from: 0, previousFrom: null }
  const length = (range === '30d' ? 30 : 90) * DAY_MS
  return { from: now - length, previousFrom: now - 2 * length }
}

function within(at: number, from: number, to: number): boolean {
  return at >= from && at < to
}

/* ------------------------------------------------------------------ metrics */

export type DeltaTone = 'success' | 'neutral'
export type DeltaIcon = 'up' | 'down' | 'rotate' | 'none'

export interface MetricCard {
  readonly label: string
  readonly value: string
  readonly delta: string
  readonly tone: DeltaTone
  readonly icon: DeltaIcon
}

function signed(value: number, digits = 0): string {
  const rounded = Number(value.toFixed(digits))
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`
}

/** Hours and minutes, the way a person says it: `6h 10m`, `45m`, `0m`. */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${String(rest)}m`
  return `${String(hours)}h ${String(rest)}m`
}

function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** The user's own accuracy in a reviewed game; their colour decides which side counts. */
export function yourAccuracy(game: GameRow): number | undefined {
  return game.accuracy?.[game.youPlay]
}

/** Blunders the user made in a game, when it has been reviewed. */
function yourBlunders(game: GameRow): number | undefined {
  return game.qualityCounts?.[game.youPlay].blunder
}

/**
 * Practice time per local day.
 *
 * Why sessions plus loose attempts: a session records its own duration, but an attempt
 * made outside any session would otherwise count for nothing. Attempts that belong to a
 * session are skipped so the same minutes are never added twice.
 */
export function practiceMsByDay(
  sessions: readonly PracticeSession[],
  attempts: readonly PuzzleAttempt[],
  timeZone: string,
): Map<LocalDate, number> {
  const byDay = new Map<LocalDate, number>()
  const add = (day: LocalDate, ms: number): void => {
    byDay.set(day, (byDay.get(day) ?? 0) + ms)
  }
  for (const session of sessions) add(session.day, session.durationMs)
  for (const attempt of attempts) {
    if (attempt.sessionId !== undefined) continue
    add(localDateOf(attempt.endedAt, timeZone), attempt.durationMs)
  }
  return byDay
}

/** Sum of practice time over whole local days, both ends included. */
function practicedMsBetween(
  byDay: ReadonlyMap<LocalDate, number>,
  firstDay: string,
  lastDay: string,
): number {
  let total = 0
  for (const [day, ms] of byDay) if (day >= firstDay && day <= lastDay) total += ms
  return total
}

function buildMetrics(input: ProgressInput, byDay: ReadonlyMap<LocalDate, number>): MetricCard[] {
  const { now, profile, attempts, games, mistakes, timeZone } = input
  const { from, previousFrom } = windowFor(input.range, now)
  const compare = previousFrom !== null

  const rated = attempts.filter((a) => a.rated && within(a.endedAt, from, now + 1))
  rated.sort((a, b) => a.endedAt - b.endedAt)
  const first = rated[0]
  const puzzleNow = profile?.puzzleRating ?? rated.at(-1)?.ratingAfter
  const puzzleCard: MetricCard =
    puzzleNow === undefined
      ? {
          label: 'Puzzle rating',
          value: '—',
          delta: 'No puzzles yet',
          tone: 'neutral',
          icon: 'none',
        }
      : first === undefined
        ? {
            label: 'Puzzle rating',
            value: String(puzzleNow),
            delta: 'No puzzles in this range',
            tone: 'neutral',
            icon: 'none',
          }
        : {
            label: 'Puzzle rating',
            value: String(puzzleNow),
            delta: `${signed(puzzleNow - first.ratingBefore)} from ${String(first.ratingBefore)}`,
            tone: puzzleNow >= first.ratingBefore ? 'success' : 'neutral',
            icon: puzzleNow >= first.ratingBefore ? 'up' : 'down',
          }

  const inRange = games.filter((g) => within(g.startedAt, from, now + 1))
  const before = compare ? games.filter((g) => within(g.startedAt, previousFrom, from)) : []
  const sparring = inRange.filter((g) => g.white.kind === 'engine' || g.black.kind === 'engine')
  const wins = sparring.filter((g) => g.result === (g.youPlay === 'white' ? '1-0' : '0-1')).length
  const draws = sparring.filter((g) => g.result === '1/2-1/2').length
  const sparringCard: MetricCard = {
    label: 'Sparring rating',
    value: profile === undefined ? '—' : String(profile.sparringRating),
    delta:
      sparring.length === 0
        ? 'No games vs Stockfish yet'
        : `${String(wins)}W ${String(draws)}D ${String(sparring.length - wins - draws)}L`,
    tone: 'neutral',
    icon: 'none',
  }

  const blunders = inRange.map(yourBlunders).filter((v): v is number => v !== undefined)
  const blundersBefore = before.map(yourBlunders).filter((v): v is number => v !== undefined)
  const blunderMean = mean(blunders)
  const blunderBefore = mean(blundersBefore)
  const blunderCard: MetricCard =
    blunderMean === undefined
      ? {
          label: 'Blunders / game',
          value: '—',
          delta: 'Review a game to see this',
          tone: 'neutral',
          icon: 'none',
        }
      : {
          label: 'Blunders / game',
          value: blunderMean.toFixed(1),
          delta:
            blunderBefore === undefined
              ? `${String(blunders.length)} reviewed`
              : `was ${blunderBefore.toFixed(1)}`,
          tone: blunderBefore === undefined || blunderMean <= blunderBefore ? 'success' : 'neutral',
          icon: blunderBefore === undefined ? 'none' : blunderMean <= blunderBefore ? 'down' : 'up',
        }

  const accuracy = mean(inRange.map(yourAccuracy).filter((v): v is number => v !== undefined))
  const accuracyBefore = mean(before.map(yourAccuracy).filter((v): v is number => v !== undefined))
  const accuracyCard: MetricCard =
    accuracy === undefined
      ? {
          label: 'Game accuracy',
          value: '—',
          delta: 'Review a game to see this',
          tone: 'neutral',
          icon: 'none',
        }
      : {
          label: 'Game accuracy',
          value: `${accuracy.toFixed(1)}%`,
          delta:
            accuracyBefore === undefined
              ? 'this range'
              : `${signed(accuracy - accuracyBefore, 1)} pts`,
          tone: accuracyBefore === undefined || accuracy >= accuracyBefore ? 'success' : 'neutral',
          icon: accuracyBefore === undefined ? 'none' : accuracy >= accuracyBefore ? 'up' : 'down',
        }

  const bankCard: MetricCard = {
    label: 'Mistakes saved',
    value: String(mistakes.filter((m) => within(m.createdAt, from, now + 1)).length),
    delta: `${String(mistakes.length)} in your bank`,
    tone: 'neutral',
    icon: 'rotate',
  }

  const firstDay = localDateOf(toTimestamp(from), timeZone)
  const practiced = practicedMsBetween(byDay, firstDay, localDateOf(toTimestamp(now), timeZone))
  const practicedBefore =
    previousFrom === null
      ? undefined
      : practicedMsBetween(
          byDay,
          localDateOf(toTimestamp(previousFrom), timeZone),
          dayString(utcDay(firstDay) - DAY_MS),
        )
  const timeCard: MetricCard = {
    label: 'Time practised',
    value: formatDuration(practiced),
    delta:
      practicedBefore === undefined
        ? 'all time'
        : `${practiced >= practicedBefore ? '+' : '−'}${formatDuration(Math.abs(practiced - practicedBefore))}`,
    tone: practicedBefore === undefined || practiced >= practicedBefore ? 'success' : 'neutral',
    icon: practicedBefore === undefined ? 'none' : practiced >= practicedBefore ? 'up' : 'down',
  }

  return [puzzleCard, sparringCard, blunderCard, accuracyCard, bankCard, timeCard]
}

/* ------------------------------------------------------------------- charts */

export interface SeriesPoint {
  readonly at: number
  readonly value: number
}

export interface ChartGeometry {
  readonly line: string
  readonly area: string
  readonly gridlines: readonly { readonly y: number; readonly label: string }[]
  readonly first: { readonly x: number; readonly y: number; readonly value: number }
  readonly last: { readonly x: number; readonly y: number; readonly value: number }
}

const CHART = { left: 40, right: 310, top: 20, bottom: 130 } as const
const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000] as const

/** Three gridlines, rounded so the axis reads `1400 / 1450 / 1500` rather than `1418.3`. */
function niceAxis(min: number, max: number): { lo: number; hi: number } {
  for (const step of NICE_STEPS) {
    const lo = Math.floor(min / step) * step
    if (lo + 2 * step >= max) return { lo, hi: lo + 2 * step }
  }
  const step = Math.ceil((max - min) / 2)
  return { lo: Math.floor(min), hi: Math.floor(min) + 2 * step }
}

/** Why a function: the SVG is drawn from numbers, so the chart is as testable as any value. */
export function chartGeometry(
  points: readonly SeriesPoint[],
  window: { readonly from: number; readonly to: number },
): ChartGeometry | undefined {
  const sorted = [...points].sort((a, b) => a.at - b.at)
  const firstPoint = sorted[0]
  const lastPoint = sorted.at(-1)
  if (firstPoint === undefined || lastPoint === undefined) return undefined

  const values = sorted.map((p) => p.value)
  const { lo, hi } = niceAxis(Math.min(...values), Math.max(...values))
  const span = Math.max(window.to - window.from, 1)
  const x = (at: number): number =>
    CHART.left +
    ((Math.min(Math.max(at, window.from), window.to) - window.from) / span) *
      (CHART.right - CHART.left)
  const y = (value: number): number =>
    CHART.bottom - ((value - lo) / (hi - lo)) * (CHART.bottom - CHART.top)
  const r = (n: number): string => n.toFixed(1)

  const coords = sorted.map((p) => `${r(x(p.at))},${r(y(p.value))}`)
  const line = coords.join(' ')
  const area = `M${coords.join(' L')} L${r(x(lastPoint.at))},${String(CHART.bottom)} L${r(x(firstPoint.at))},${String(CHART.bottom)}Z`

  return {
    line,
    area,
    gridlines: [hi, (lo + hi) / 2, lo].map((value) => ({
      y: y(value),
      label: String(Math.round(value)),
    })),
    first: { x: x(firstPoint.at), y: y(firstPoint.value), value: firstPoint.value },
    last: { x: x(lastPoint.at), y: y(lastPoint.value), value: lastPoint.value },
  }
}

function ratingSeries(input: ProgressInput, from: number): SeriesPoint[] {
  return input.attempts
    .filter((a) => a.rated && a.endedAt >= from && a.endedAt <= input.now)
    .map((a) => ({ at: a.endedAt, value: a.ratingAfter }))
}

function accuracySeries(input: ProgressInput, from: number): SeriesPoint[] {
  const points: SeriesPoint[] = []
  for (const game of input.games) {
    const accuracy = yourAccuracy(game)
    if (accuracy === undefined || game.startedAt < from || game.startedAt > input.now) continue
    points.push({ at: game.startedAt, value: accuracy })
  }
  return points
}

/* ------------------------------------------------------------------- skills */

export interface ThemeSkill {
  readonly theme: string
  readonly attempts: number
  /** Percent of attempts solved without a wrong move or a hint. */
  readonly score: number
  /** The same score over the previous window, when there was one with data. */
  readonly previous: number | undefined
}

const MAX_SKILLS = 6
const MIN_ATTEMPTS = 3

function scoreByTheme(
  attempts: readonly PuzzleAttempt[],
  themeOf: ReadonlyMap<string, string>,
  from: number,
  to: number,
): Map<string, { attempts: number; firstTry: number }> {
  const byTheme = new Map<string, { attempts: number; firstTry: number }>()
  for (const attempt of attempts) {
    if (!within(attempt.endedAt, from, to) || attempt.skipped) continue
    const theme = themeOf.get(attempt.puzzleId)
    if (theme === undefined) continue
    const entry = byTheme.get(theme) ?? { attempts: 0, firstTry: 0 }
    entry.attempts += 1
    if (attempt.firstTry) entry.firstTry += 1
    byTheme.set(theme, entry)
  }
  return byTheme
}

/** Theme mastery: the radar's axes are the themes the user has actually practised most. */
export function themeSkills(input: ProgressInput): ThemeSkill[] {
  const { from, previousFrom } = windowFor(input.range, input.now)
  const current = scoreByTheme(input.attempts, input.themeOf, from, input.now + 1)
  const previous =
    previousFrom === null
      ? new Map<string, { attempts: number; firstTry: number }>()
      : scoreByTheme(input.attempts, input.themeOf, previousFrom, from)

  return [...current.entries()]
    .filter(([, value]) => value.attempts >= MIN_ATTEMPTS)
    .sort((a, b) => b[1].attempts - a[1].attempts || a[0].localeCompare(b[0]))
    .slice(0, MAX_SKILLS)
    .map(([theme, value]) => {
      const before = previous.get(theme)
      return {
        theme,
        attempts: value.attempts,
        score: Math.round((value.firstTry / value.attempts) * 100),
        previous:
          before !== undefined && before.attempts >= MIN_ATTEMPTS
            ? Math.round((before.firstTry / before.attempts) * 100)
            : undefined,
      }
    })
}

/** `mateIn2` → `Mate in 2`, `discoveredAttack` → `Discovered attack`. */
export function themeLabel(theme: string): string {
  const spaced = theme
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export interface RadarGeometry {
  readonly rings: readonly string[]
  readonly axes: readonly { readonly x: number; readonly y: number }[]
  readonly current: string
  readonly previous: string | undefined
  readonly dots: readonly { readonly x: number; readonly y: number }[]
  readonly labels: readonly {
    readonly x: number
    readonly y: number
    readonly anchor: 'start' | 'middle' | 'end'
    readonly text: string
    readonly value: number
  }[]
}

const RADAR = { cx: 130, cy: 120, radius: 86 } as const

/** Needs at least three axes to be a shape; below that the screen shows a list instead. */
export function radarGeometry(skills: readonly ThemeSkill[]): RadarGeometry | undefined {
  if (skills.length < 3) return undefined
  const count = skills.length
  const angle = (index: number): number => -Math.PI / 2 + (index * 2 * Math.PI) / count
  const point = (index: number, fraction: number): { x: number; y: number } => ({
    x: RADAR.cx + Math.cos(angle(index)) * RADAR.radius * fraction,
    y: RADAR.cy + Math.sin(angle(index)) * RADAR.radius * fraction,
  })
  const fmt = (p: { x: number; y: number }): string => `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  const polygon = (fractions: readonly number[]): string =>
    fractions.map((f, i) => fmt(point(i, f))).join(' ')

  const hasPrevious = skills.some((s) => s.previous !== undefined)
  return {
    rings: [0.25, 0.5, 0.75, 1].map((f) => polygon(skills.map(() => f))),
    axes: skills.map((_, i) => point(i, 1)),
    current: polygon(skills.map((s) => s.score / 100)),
    previous: hasPrevious ? polygon(skills.map((s) => (s.previous ?? s.score) / 100)) : undefined,
    dots: skills.map((s, i) => point(i, s.score / 100)),
    labels: skills.map((s, i) => {
      const at = point(i, 1.2)
      const dx = Math.cos(angle(i))
      return {
        x: at.x,
        y: at.y + 4,
        anchor: Math.abs(dx) < 0.3 ? 'middle' : dx > 0 ? 'start' : 'end',
        text: themeLabel(s.theme),
        value: s.score,
      }
    }),
  }
}

/* ----------------------------------------------------------------- heatmap */

export type HeatmapKind = 'none' | 'low' | 'med' | 'high' | 'max' | 'freeze' | 'future'

export interface HeatmapCell {
  readonly kind: HeatmapKind
  readonly title: string
}

export interface Heatmap {
  /** Sixteen columns of seven days, Monday first. */
  readonly weeks: readonly (readonly HeatmapCell[])[]
  /** Month names over the columns, as `[label, number of weeks it spans]`. */
  readonly months: readonly { readonly label: string; readonly weeks: number }[]
  readonly practicedDays: number
  readonly longestStreak: number
  readonly currentStreak: number
  readonly freezesUsed: number
  readonly averageSessionMs: number | undefined
  readonly daysThisMonth: { readonly practiced: number; readonly elapsed: number }
  readonly busiestWeekday: string | undefined
  readonly favouriteHour: number | undefined
}

function kindFor(minutes: number): HeatmapKind {
  if (minutes <= 0) return 'none'
  if (minutes < 5) return 'low'
  if (minutes < 15) return 'med'
  if (minutes < 30) return 'high'
  return 'max'
}

function utcDay(day: string): number {
  return Date.parse(`${day}T00:00:00Z`)
}

function dayString(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10) as LocalDate
}

const WEEKDAYS = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Longest and current run of consecutive days; a freeze day keeps a run alive. */
function runs(days: ReadonlySet<string>, today: LocalDate): { longest: number; current: number } {
  const sorted = [...days].sort()
  let longest = 0
  let run = 0
  let previous: number | undefined
  for (const day of sorted) {
    const at = utcDay(day)
    run = previous !== undefined && at - previous === DAY_MS ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = at
  }
  // The current run may end yesterday: today is not over, so it has not broken anything yet.
  let cursor = utcDay(today)
  if (!days.has(dayString(cursor))) cursor -= DAY_MS
  let current = 0
  while (days.has(dayString(cursor))) {
    current += 1
    cursor -= DAY_MS
  }
  return { longest, current }
}

export function buildHeatmap(input: ProgressInput, byDay: ReadonlyMap<LocalDate, number>): Heatmap {
  const today = localDateOf(input.now, input.timeZone)
  const todayMs = utcDay(today)
  const weekday = (new Date(todayMs).getUTCDay() + 6) % 7 // Monday = 0
  const start = todayMs - weekday * DAY_MS - (HEATMAP_WEEKS - 1) * 7 * DAY_MS

  const freezeDays = new Set<string>(input.streak?.freezeDaysUsed ?? [])
  const practiced = new Set<string>()
  for (const [day, ms] of byDay) if (ms > 0) practiced.add(day)

  const weeks: HeatmapCell[][] = []
  for (let w = 0; w < HEATMAP_WEEKS; w += 1) {
    const week: HeatmapCell[] = []
    for (let d = 0; d < 7; d += 1) {
      const at = start + (w * 7 + d) * DAY_MS
      const day = dayString(at)
      const label = new Date(at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
      if (at > todayMs) {
        week.push({ kind: 'future', title: label })
      } else if (freezeDays.has(day) && !practiced.has(day)) {
        week.push({ kind: 'freeze', title: `${label} · freeze` })
      } else {
        const minutes = Math.round((byDay.get(day) ?? 0) / 60_000)
        week.push({
          kind: kindFor(minutes),
          title: minutes === 0 ? label : `${label} · ${String(minutes)} min`,
        })
      }
    }
    weeks.push(week)
  }

  const months: { label: string; weeks: number }[] = []
  for (let w = 0; w < HEATMAP_WEEKS; w += 1) {
    const label = MONTHS[new Date(start + w * 7 * DAY_MS).getUTCMonth()] ?? ''
    const last = months.at(-1)
    if (last?.label === label) last.weeks += 1
    else months.push({ label, weeks: 1 })
  }

  const withFreezes = new Set<string>([...practiced, ...freezeDays])
  const { longest, current } = runs(withFreezes, today)

  const windowStart = dayString(start)
  const inWindow = [...practiced].filter((day) => day >= windowStart && day <= today)
  const byWeekday = new Map<number, number>()
  for (const day of inWindow) {
    const index = new Date(utcDay(day)).getUTCDay()
    byWeekday.set(index, (byWeekday.get(index) ?? 0) + 1)
  }
  const busiest = [...byWeekday.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]

  const sessions = input.sessions.filter((s) => s.durationMs > 0)
  const hours = new Map<number, number>()
  for (const session of sessions) {
    const hour =
      Number(
        new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          hour12: false,
          timeZone: input.timeZone,
        }).format(session.startedAt),
      ) % 24
    hours.set(hour, (hours.get(hour) ?? 0) + 1)
  }
  const favourite = [...hours.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]

  const monthPrefix = today.slice(0, 7)
  return {
    weeks,
    months,
    practicedDays: inWindow.length,
    longestStreak: longest,
    currentStreak: current,
    freezesUsed: freezeDays.size,
    averageSessionMs: mean(sessions.map((s) => s.durationMs)),
    daysThisMonth: {
      practiced: [...practiced].filter((day) => day.startsWith(monthPrefix) && day <= today).length,
      elapsed: Number(today.slice(8, 10)),
    },
    busiestWeekday: busiest === undefined ? undefined : WEEKDAYS[busiest[0]],
    favouriteHour: favourite?.[0],
  }
}

/* ------------------------------------------------------------------- garden */

export const GARDEN_STAGES = [
  { id: 'seed', label: 'Seed', days: 0 },
  { id: 'sprout', label: 'Sprout', days: 3 },
  { id: 'sapling', label: 'Sapling', days: 7 },
  { id: 'bloom', label: 'Bloom', days: 15 },
  { id: 'tree', label: 'Tree', days: 40 },
] as const

export type GardenStageId = (typeof GARDEN_STAGES)[number]['id']

export interface Garden {
  readonly stageIndex: number
  readonly level: number
  readonly practicedDays: number
  /** The next stage, or `undefined` once the tree is grown. */
  readonly next: (typeof GARDEN_STAGES)[number] | undefined
  readonly daysToNext: number
}

/** The garden grows with days practised, not with wins: a missed day costs nothing. */
export function gardenFor(totalPracticeDays: number): Garden {
  let stageIndex = 0
  GARDEN_STAGES.forEach((stage, index) => {
    if (totalPracticeDays >= stage.days) stageIndex = index
  })
  const next = GARDEN_STAGES[stageIndex + 1]
  return {
    stageIndex,
    level: stageIndex + 1,
    practicedDays: totalPracticeDays,
    next,
    daysToNext: next === undefined ? 0 : Math.max(next.days - totalPracticeDays, 0),
  }
}

/* --------------------------------------------------------------- milestones */

export interface Milestone {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly icon: 'puzzle' | 'flower' | 'rating' | 'review' | 'mistake'
}

export interface EarnedMilestone extends Milestone {
  readonly earnedOn: string
}

export interface PendingMilestone extends Milestone {
  readonly current: number
  readonly total: number
  readonly currentDisplay: string
}

const SOLVED_TIERS = [1, 10, 50, 200, 1000] as const
const DAYS_TIERS = [1, 7, 15, 30, 60, 100] as const
const REVIEW_TIERS = [1, 5, 25, 100] as const
const MISTAKE_TIERS = [1, 10, 50, 200] as const

interface Family {
  readonly id: string
  readonly icon: Milestone['icon']
  readonly tiers: readonly number[]
  readonly title: (tier: number) => string
  readonly description: (tier: number) => string
  readonly count: number
  /** When the nth item (1-based) happened, as a timestamp or a local date. */
  readonly earnedAt: (tier: number) => number | string | undefined
  readonly unit: string
}

function formatEarned(at: number | string | undefined, timeZone: string): string {
  if (at === undefined) return 'Earned'
  const date = typeof at === 'string' ? new Date(`${at}T12:00:00Z`) : new Date(at)
  const zone = typeof at === 'string' ? 'UTC' : timeZone
  return `Earned ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: zone })}`
}

/** Next hundred above the rating, so there is always a target in sight. */
function ratingTarget(rating: number): number {
  return (Math.floor(rating / 100) + 1) * 100
}

export function buildMilestones(
  input: ProgressInput,
  practiceDays: readonly string[],
): { earned: EarnedMilestone[]; pending: PendingMilestone[] } {
  const solved = input.attempts.filter((a) => a.solved).sort((a, b) => a.endedAt - b.endedAt)
  const reviewed = input.games
    .filter((g) => g.reviewState === 'reviewed')
    .sort((a, b) => a.updatedAt - b.updatedAt)
  const mistakes = [...input.mistakes].sort((a, b) => a.createdAt - b.createdAt)
  const sortedDays = [...practiceDays].sort()

  const families: Family[] = [
    {
      id: 'puzzles-solved',
      icon: 'puzzle',
      tiers: SOLVED_TIERS,
      title: (n) => (n === 1 ? 'First puzzle solved' : `${String(n)} puzzles solved`),
      description: (n) => (n === 1 ? 'The first of many' : `Solve ${String(n)} puzzles in total`),
      count: solved.length,
      earnedAt: (n) => solved[n - 1]?.endedAt,
      unit: 'solved',
    },
    {
      id: 'practice-days',
      icon: 'flower',
      tiers: DAYS_TIERS,
      title: (n) => (n === 1 ? 'First day in the garden' : `${String(n)} days practised`),
      description: (n) =>
        n === 1 ? 'Water it a little each day' : `Practise on ${String(n)} different days`,
      count: sortedDays.length,
      earnedAt: (n) => sortedDays[n - 1],
      unit: 'days',
    },
    {
      id: 'games-reviewed',
      icon: 'review',
      tiers: REVIEW_TIERS,
      title: (n) => (n === 1 ? 'First game reviewed' : `${String(n)} games reviewed`),
      description: (n) => `Look back at ${String(n)} of your own game${n === 1 ? '' : 's'}`,
      count: reviewed.length,
      earnedAt: (n) => reviewed[n - 1]?.updatedAt,
      unit: 'reviewed',
    },
    {
      id: 'mistakes-saved',
      icon: 'mistake',
      tiers: MISTAKE_TIERS,
      title: (n) =>
        n === 1 ? 'First mistake saved' : `${String(n)} mistakes turned into practice`,
      description: (n) => `Keep ${String(n)} idea${n === 1 ? '' : 's'} you missed, and learn them`,
      count: mistakes.length,
      earnedAt: (n) => mistakes[n - 1]?.createdAt,
      unit: 'saved',
    },
  ]

  const earned: EarnedMilestone[] = []
  const pending: PendingMilestone[] = []
  for (const family of families) {
    const reached = family.tiers.filter((tier) => family.count >= tier)
    const top = reached.at(-1)
    if (top !== undefined) {
      earned.push({
        id: `${family.id}-${String(top)}`,
        icon: family.icon,
        title: family.title(top),
        description: family.description(top),
        earnedOn: formatEarned(family.earnedAt(top), input.timeZone),
      })
    }
    const next = family.tiers.find((tier) => family.count < tier)
    if (next !== undefined) {
      pending.push({
        id: `${family.id}-${String(next)}`,
        icon: family.icon,
        title: family.title(next),
        description: family.description(next),
        current: family.count,
        total: next,
        currentDisplay: `${String(family.count)} of ${String(next)} ${family.unit}`,
      })
    }
  }

  const rating = input.profile?.puzzleRating
  if (rating !== undefined && input.attempts.length > 0) {
    const target = ratingTarget(rating)
    pending.push({
      id: `rating-${String(target)}`,
      icon: 'rating',
      title: `Puzzle rating ${String(target)}`,
      description: `${String(target - rating)} points to go`,
      current: rating,
      total: target,
      currentDisplay: `${String(rating)} of ${String(target)}`,
    })
  }
  return { earned, pending }
}

/* --------------------------------------------------------------------- model */

export interface ProgressModel {
  readonly metrics: readonly MetricCard[]
  readonly puzzleChart: ChartGeometry | undefined
  readonly puzzleCount: number
  readonly accuracyChart: ChartGeometry | undefined
  readonly gameCount: number
  readonly skills: readonly ThemeSkill[]
  readonly radar: RadarGeometry | undefined
  readonly heatmap: Heatmap
  readonly garden: Garden
  readonly earned: readonly EarnedMilestone[]
  readonly pending: readonly PendingMilestone[]
  readonly window: { readonly from: number; readonly to: number }
}

export function buildProgress(input: ProgressInput): ProgressModel {
  const { from } = windowFor(input.range, input.now)
  const byDay = practiceMsByDay(input.sessions, input.attempts, input.timeZone)
  const practiceDays = [...byDay].filter(([, ms]) => ms > 0).map(([day]) => day)

  const puzzlePoints = ratingSeries(input, from)
  const accuracyPoints = accuracySeries(input, from)
  const earliest = Math.min(...[...puzzlePoints, ...accuracyPoints].map((p) => p.at), input.now)
  const chartFrom = input.range === 'all' ? earliest : from
  const chartWindow = { from: chartFrom, to: input.now }

  const skills = themeSkills(input)
  const { earned, pending } = buildMilestones(input, practiceDays)

  return {
    metrics: buildMetrics(input, byDay),
    puzzleChart: chartGeometry(puzzlePoints, chartWindow),
    puzzleCount: puzzlePoints.length,
    accuracyChart: chartGeometry(accuracyPoints, chartWindow),
    gameCount: accuracyPoints.length,
    skills,
    radar: radarGeometry(skills),
    heatmap: buildHeatmap(input, byDay),
    garden: gardenFor(practiceDays.length),
    earned,
    pending,
    window: chartWindow,
  }
}
