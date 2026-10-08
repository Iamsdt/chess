import { Link } from '@tanstack/react-router'
import {
  ArrowDownRight,
  ArrowUpRight,
  Castle,
  CircleDot,
  Droplets,
  Flame,
  Flower2,
  HeartHandshake,
  HelpCircle,
  Leaf,
  MessageCircle,
  Puzzle,
  RotateCcw,
  ShieldCheck,
  Sprout,
  Target,
  Trees,
  TrendingUp,
} from 'lucide-react'
import { useContext, useEffect, useMemo, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import {
  useAllAttempts,
  useAllSessions,
  useGames,
  useKvValue,
  useMistakes,
  useProfile,
  usePuzzlesByIds,
  useStreak,
} from '@/data'
import { Button, cn, toast } from '@/design'
import { localDateOf, toTimestamp, type PuzzleId } from '@/domain'
import { viewStreak } from '@/features/habit'

import {
  buildProgress,
  GARDEN_STAGES,
  themeLabel,
  type ChartGeometry,
  type HeatmapKind,
  type Milestone,
  type ProgressModel,
  type RadarGeometry,
  type ThemeSkill,
  type TimeRange,
} from './progress-stats'
import { requestStatsRebuild } from './stats-job'
import { modelFromSnapshot, STATS_SNAPSHOT_KEY, statsSignature } from './stats-snapshot'

export type { TimeRange } from './progress-stats'

const STAGE_ICONS = [CircleDot, Sprout, Leaf, Flower2, Trees] as const

const RANGES: readonly { readonly id: TimeRange; readonly label: string }[] = [
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'all', label: 'All time' },
]

function heatmapCellClasses(kind: HeatmapKind): string {
  switch (kind) {
    case 'none':
      return 'aspect-square rounded-[3px] bg-muted'
    case 'low':
      return 'aspect-square rounded-[3px] bg-q-best/25'
    case 'med':
      return 'aspect-square rounded-[3px] bg-q-best/50'
    case 'high':
      return 'aspect-square rounded-[3px] bg-q-best/75'
    case 'max':
      return 'aspect-square rounded-[3px] bg-q-best'
    case 'freeze':
      return 'aspect-square rounded-[3px] bg-sky ring-1 ring-inset ring-sky-ink/30'
    case 'future':
      return 'aspect-square rounded-[3px] border border-dashed bg-transparent'
  }
}

function shortDate(at: number): string {
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function dateRangeLabel(range: TimeRange, from: number, to: number): string {
  return range === 'all' ? 'All-time journey' : `${shortDate(from)} → ${shortDate(to)}`
}

interface DataTableProps {
  readonly caption: string
  readonly columns: readonly string[]
  readonly rows: readonly (readonly string[])[]
  readonly empty: string
}

/**
 * The text twin of a picture: the same figures in a real table, behind a disclosure so it
 * does not crowd the page. Why not `sr-only`: a sighted keyboard user wants it too.
 */
function DataTable({ caption, columns, rows, empty }: DataTableProps) {
  const [open, setOpen] = useState(false)
  return (
    <details open={open} className="mt-3 text-xs">
      <summary
        className="inline-flex min-h-[36px] cursor-pointer items-center font-medium text-muted-foreground hover:text-foreground"
        onClick={(event) => {
          // Controlled, so a year of rows is only built for the person who asked for them.
          event.preventDefault()
          setOpen((current) => !current)
        }}
      >
        View as table
      </summary>
      {open &&
        (rows.length === 0 ? (
          <p className="mt-2 text-muted-foreground">{empty}</p>
        ) : (
          <div className="mt-2 max-h-56 overflow-auto rounded-lg border">
            <table className="w-full text-left tabular-nums">
              <caption className="sr-only">{caption}</caption>
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {columns.map((column) => (
                    <th key={column} scope="col" className="px-3 py-1.5 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.join('|')}>
                    {row.map((cell, index) =>
                      index === 0 ? (
                        <th key={cell} scope="row" className="px-3 py-1.5 font-normal">
                          {cell}
                        </th>
                      ) : (
                        <td key={`${cell}-${String(index)}`} className="px-3 py-1.5">
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </details>
  )
}

function MilestoneIcon({ icon }: { readonly icon: Milestone['icon'] }) {
  switch (icon) {
    case 'puzzle':
      return <Puzzle className="size-5" aria-hidden="true" />
    case 'flower':
      return <Flower2 className="size-5" aria-hidden="true" />
    case 'rating':
      return <Castle className="size-5" aria-hidden="true" />
    case 'review':
      return <ShieldCheck className="size-5" aria-hidden="true" />
    case 'mistake':
      return <RotateCcw className="size-5" aria-hidden="true" />
  }
}

interface LineChartProps {
  readonly title: string
  readonly caption: string
  readonly badge: string | undefined
  readonly chart: ChartGeometry | undefined
  readonly colour: string
  readonly from: number
  readonly to: number
  readonly summary: string
  readonly empty: string
  /** Heading of the value column in the table alternative. */
  readonly valueLabel: string
}

/** One line chart on the shared 320×160 canvas; every coordinate comes from `chartGeometry`. */
export function LineChart({
  title,
  caption,
  badge,
  chart,
  colour,
  from,
  to,
  summary,
  empty,
  valueLabel,
}: LineChartProps) {
  return (
    <figure className="card p-4 sm:p-5">
      <figcaption className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
        {badge !== undefined && <span className="badge badge-soft">{badge}</span>}
      </figcaption>
      {chart === undefined ? (
        <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <svg viewBox="0 0 320 160" className="mt-3 w-full" role="img" aria-label={summary}>
          <g className="text-[10px]" fill="var(--muted-foreground)">
            {chart.gridlines.map((line) => (
              <g key={line.label}>
                <line x1="40" x2="312" y1={line.y} y2={line.y} stroke="var(--border)" />
                <text x="32" y={line.y + 3} textAnchor="end">
                  {line.label}
                </text>
              </g>
            ))}
            <text x="40" y="150">
              {shortDate(from)}
            </text>
            <text x="310" y="150" textAnchor="end">
              {shortDate(to)}
            </text>
          </g>
          <path d={chart.area} fill={colour} opacity=".12" />
          <polyline
            points={chart.line}
            fill="none"
            stroke={colour}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx={chart.first.x}
            cy={chart.first.y}
            r="3.5"
            fill="var(--card)"
            stroke="var(--muted-foreground)"
            strokeWidth="1.5"
          />
          <circle
            cx={chart.last.x}
            cy={chart.last.y}
            r="4.5"
            fill={colour}
            stroke="var(--card)"
            strokeWidth="2"
          />
          <text
            x={Math.min(chart.last.x - 8, 302)}
            y={chart.last.y - 10}
            textAnchor="end"
            className="text-[11px] font-semibold"
            fill="var(--foreground)"
          >
            {Math.round(chart.last.value)}
          </text>
        </svg>
      )}
      {chart !== undefined && (
        <DataTable
          caption={`${title} by day`}
          columns={['Day', valueLabel]}
          rows={chart.table.map((row) => [shortDate(row.at), String(Math.round(row.value))])}
          empty="Nothing to list yet."
        />
      )}
    </figure>
  )
}

function Radar({ radar, summary }: { readonly radar: RadarGeometry; readonly summary: string }) {
  return (
    <svg
      viewBox="-56 -10 372 262"
      className="mx-auto mt-3 w-full max-w-[440px]"
      role="img"
      aria-label={summary}
    >
      {radar.rings.map((ring) => (
        <polygon key={ring} points={ring} fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {radar.axes.map((axis) => (
        <line
          key={`${String(axis.x)}-${String(axis.y)}`}
          x1="130"
          y1="120"
          x2={axis.x}
          y2={axis.y}
          stroke="var(--border)"
          strokeWidth="1"
        />
      ))}
      {radar.previous !== undefined && (
        <polygon
          points={radar.previous}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}
      <polygon
        points={radar.current}
        fill="var(--q-best)"
        fillOpacity=".22"
        stroke="var(--q-best)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {radar.dots.map((dot) => (
        <circle
          key={`${String(dot.x)}-${String(dot.y)}`}
          cx={dot.x}
          cy={dot.y}
          r="3.5"
          fill="var(--q-best)"
          stroke="var(--card)"
          strokeWidth="1.5"
        />
      ))}
      {radar.labels.map((label) => (
        <text
          key={label.text}
          x={label.x}
          y={label.y}
          textAnchor={label.anchor}
          className="fill-foreground text-[12.5px] font-medium"
        >
          {label.text} <tspan className="fill-muted-foreground">{label.value}</tspan>
        </text>
      ))}
    </svg>
  )
}

function skillDelta(skill: ThemeSkill): string {
  if (skill.previous === undefined) return `${String(skill.attempts)} tries`
  const change = skill.score - skill.previous
  return `${change > 0 ? '+' : ''}${String(change)}`
}

/**
 * Growth Screen (`/progress`) — ported from `prototype/progress.html`, drawn from the
 * stored attempts, sessions, games and mistakes by `buildProgress`.
 *
 * - Garden hero: grows with days practised, never with wins
 * - You vs you: six figures against the equally long stretch before
 * - Rating and accuracy charts, a theme-mastery radar, a 16-week heatmap, milestones
 *
 * It reads the rows the `rebuild-stats` job precomputed and falls back to counting the
 * history live when they are missing or stale.
 *
 * Nothing is invented: with no data a card says what it is waiting for.
 */
export function ProgressScreen() {
  const chatPanel = useContext(ChatPanelContext)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  // Fixed per visit, so the charts do not shift while the page is open.
  const [now] = useState(() => toTimestamp(Date.now()))

  const profile = useProfile()
  const streak = useStreak()
  const attempts = useAllAttempts()
  const sessions = useAllSessions()
  const games = useGames()
  const mistakes = useMistakes()

  const puzzleIds = useMemo(
    () => [...new Set((attempts ?? []).map((attempt) => attempt.puzzleId))] as PuzzleId[],
    [attempts],
  )
  const puzzles = usePuzzlesByIds(puzzleIds)
  const snapshot = useKvValue(STATS_SNAPSHOT_KEY)
  const timeZone = profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  const loaded: { model: ProgressModel; precomputed: boolean } | undefined = useMemo(() => {
    if (
      attempts === undefined ||
      sessions === undefined ||
      games === undefined ||
      mistakes === undefined ||
      puzzles === undefined
    ) {
      return undefined
    }
    // The rebuild job's rows, when they still describe exactly these rows; otherwise count
    // the history here. The signature is what makes a stale snapshot impossible to show.
    const precomputed = modelFromSnapshot(snapshot, timeRange, {
      signature: statsSignature({ attempts, sessions, games, mistakes, profile, streak }),
      now,
      timeZone,
    })
    if (precomputed !== undefined) return { model: precomputed, precomputed: true }
    const live = buildProgress({
      now,
      range: timeRange,
      timeZone,
      profile,
      streak,
      attempts,
      sessions,
      games,
      mistakes,
      themeOf: new Map(puzzles.map((puzzle) => [puzzle.id, puzzle.theme])),
    })
    return { model: live, precomputed: false }
  }, [
    attempts,
    sessions,
    games,
    mistakes,
    puzzles,
    profile,
    streak,
    now,
    timeRange,
    snapshot,
    timeZone,
  ])

  // Ask for fresh rows only after the live numbers are on screen, so the page never waits.
  const needsRebuild = loaded !== undefined && !loaded.precomputed
  useEffect(() => {
    if (needsRebuild) void requestStatsRebuild()
  }, [needsRebuild])

  const model = loaded?.model

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="label">Only you vs you. No leaderboards, ever.</p>
        <h1 className="page-title mt-1">Growth</h1>
      </div>
      <div className="seg flex w-full sm:w-auto" role="group" aria-label="Time range">
        {RANGES.map((range) => (
          <button
            key={range.id}
            type="button"
            className={cn(
              'min-h-[36px] flex-1 sm:min-h-0 sm:flex-none',
              timeRange === range.id && 'is-active',
            )}
            onClick={() => {
              setTimeRange(range.id)
            }}
          >
            {range.label}
          </button>
        ))}
      </div>
    </header>
  )

  if (model === undefined) {
    return (
      <div className="page pb-12" aria-busy="true">
        {header}
        <p className="mt-8 text-sm text-muted-foreground">Gathering your practice…</p>
      </div>
    )
  }

  const { garden, heatmap } = model
  // The stored streak knows about freezes; the heatmap only knows about sessions. Whichever
  // is longer is the truer count, since practice recorded without a session still counts.
  const streakDays = Math.max(
    heatmap.currentStreak,
    viewStreak(streak, localDateOf(now, timeZone)).current,
  )
  const stage = GARDEN_STAGES[garden.stageIndex]
  const gardenAlt =
    garden.next === undefined
      ? `Your chess garden: a grown ${stage?.label.toLowerCase() ?? 'tree'}`
      : `Your chess garden: a ${stage?.label.toLowerCase() ?? 'seed'}, ${String(garden.daysToNext)} practice days from ${garden.next.label.toLowerCase()}`
  const progressPercent =
    garden.next === undefined || stage === undefined
      ? 100
      : Math.round(((garden.practicedDays - stage.days) / (garden.next.days - stage.days)) * 100)

  const puzzleRange = model.metrics[0]
  const strongest = [...model.skills].sort((a, b) => b.score - a.score).slice(0, 3)
  const weakest = [...model.skills]
    .sort((a, b) => a.score - b.score)
    .filter((skill) => !strongest.includes(skill) || model.skills.length <= 3)
    .slice(0, 3)
  const weakestSkill = weakest[0]
  const radarSummary = `Theme mastery. ${model.skills.map((skill) => `${themeLabel(skill.theme)} ${String(skill.score)}`).join(', ')}.`

  return (
    <div className="page pb-12">
      <style>{`
        @keyframes garden-sway {
          0%, 100% { transform: rotate(-1.5deg); }
          50% { transform: rotate(1.5deg); }
        }
        .garden-sway {
          transform-origin: 180px 170px;
          animation: garden-sway 6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .garden-sway { animation: none; }
        }
      `}</style>

      {header}

      {/* Garden Hero */}
      <section className="card mt-6 overflow-hidden" aria-labelledby="garden-h">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="relative flex flex-col bg-accent/60 p-4 sm:p-6">
            <span className="badge badge-reward self-start">
              <Flame className="size-3.5" aria-hidden="true" />
              {streakDays}-day streak
            </span>

            <svg
              viewBox="70 14 220 186"
              className="mx-auto my-auto w-full max-w-[280px] pt-2 sm:max-w-[360px]"
              role="img"
              aria-label={gardenAlt}
            >
              <circle cx="252" cy="50" r="22" fill="var(--reward)" opacity=".35" />
              <circle cx="252" cy="50" r="13" fill="var(--reward)" opacity=".7" />
              <ellipse
                cx="180"
                cy="182"
                rx="104"
                ry="13"
                fill="var(--garden-ground)"
                opacity=".35"
              />
              <ellipse cx="180" cy="180" rx="62" ry="7" fill="var(--garden-ground)" opacity=".45" />

              {/* Next stage ghost */}
              <g
                opacity=".35"
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth="1.5"
                strokeDasharray="3 4"
              >
                <circle cx="180" cy="44" r="16" />
                <circle cx="160" cy="58" r="10" />
                <circle cx="202" cy="56" r="11" />
              </g>

              {garden.stageIndex < 2 ? (
                /* A seed or a sprout: the full sapling is what the dashed outline promises. */
                <g className="garden-sway">
                  <path
                    d="M180 176 C180 168 180 160 181 150"
                    stroke="var(--garden-stem)"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                  />
                  {garden.stageIndex === 1 && (
                    <>
                      <path
                        d="M181 154 C168 152 158 144 156 134 C170 134 179 142 181 154Z"
                        fill="var(--garden-leaf-light)"
                      />
                      <path
                        d="M181 150 C194 146 204 138 206 128 C192 128 183 138 181 150Z"
                        fill="var(--garden-leaf)"
                      />
                    </>
                  )}
                  {garden.stageIndex === 0 && (
                    <circle cx="181" cy="172" r="5" fill="var(--reward)" />
                  )}
                </g>
              ) : (
                <g className="garden-sway">
                  <path
                    d="M180 176 C180 146 178 116 181 70"
                    stroke="var(--garden-stem)"
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M180 140 C160 134 142 120 138 98 C160 98 176 114 180 140Z"
                    fill="var(--garden-leaf-light)"
                  />
                  <path
                    d="M181 118 C200 110 218 96 222 74 C198 74 184 92 181 118Z"
                    fill="var(--garden-leaf)"
                  />
                  <path
                    d="M180 158 C198 154 212 146 218 132 C200 130 186 140 180 158Z"
                    fill="var(--garden-leaf-light)"
                  />
                  <path
                    d="M181 96 C166 92 156 82 152 68 C168 68 178 78 181 96Z"
                    fill="var(--garden-leaf)"
                  />
                  <circle cx="181" cy="66" r="9" fill="var(--reward)" />
                  <circle cx="181" cy="66" r="4" fill="var(--cta)" opacity=".6" />
                </g>
              )}
              <path
                d="M150 180 Q180 170 210 180"
                stroke="var(--garden-stem)"
                strokeWidth="2"
                fill="none"
                opacity=".5"
              />
            </svg>
            <p className="text-center text-xs text-muted-foreground">
              {garden.next === undefined
                ? 'Fully grown. It stays that way as long as you keep visiting.'
                : `Dashed outline: what it becomes at ${garden.next.label}`}
            </p>
          </div>

          <div className="flex flex-col p-4 sm:p-6">
            <p className="eyebrow">Your chess garden · Level {garden.level}</p>
            <h2 id="garden-h" className="mt-1 text-2xl leading-tight font-bold sm:text-[28px]">
              {garden.practicedDays === 0
                ? 'A seed, waiting for its first day'
                : garden.next === undefined
                  ? `${stage?.label ?? 'Tree'}, fully grown`
                  : `${stage?.label ?? 'Seed'}, ${String(garden.daysToNext)} days from ${garden.next.label.toLowerCase()}`}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              It grows with steady practice, not with wins. Missed days don&apos;t kill it. A freeze
              keeps it watered.
            </p>

            <ol
              className="mt-5 grid grid-cols-5 gap-1 text-center text-[11px] font-medium"
              aria-label="Garden stages"
            >
              {GARDEN_STAGES.map((entry, index) => {
                const Icon = STAGE_ICONS[index] ?? CircleDot
                const reached = index < garden.stageIndex
                const current = index === garden.stageIndex
                return (
                  <li key={entry.id} aria-current={current ? 'step' : undefined}>
                    <span
                      className={cn(
                        'mx-auto grid size-8 place-items-center rounded-full sm:size-9',
                        reached && 'bg-primary text-primary-foreground',
                        current &&
                          'border-[2.5px] border-cta bg-card text-cta shadow-[0_0_0_5px_rgba(224,103,60,.12)]',
                        !reached &&
                          !current &&
                          'border border-dashed bg-card text-muted-foreground',
                      )}
                    >
                      <Icon className="size-3.5 sm:size-4" aria-hidden="true" />
                    </span>
                    <span
                      className={cn(
                        'mt-1.5 block',
                        current && 'font-semibold text-cta',
                        !reached && !current && 'text-muted-foreground',
                      )}
                    >
                      {entry.label}
                    </span>
                  </li>
                )
              })}
            </ol>

            {garden.next !== undefined && stage !== undefined && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">To {garden.next.label}</span>
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {garden.practicedDays} of {garden.next.days}
                    </span>{' '}
                    practice days
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={garden.practicedDays}
                  aria-valuemin={0}
                  aria-valuemax={garden.next.days}
                  aria-label={`Practice days to ${garden.next.label}`}
                  className="progress mt-2 h-2.5"
                >
                  <span className="bg-cta" style={{ width: `${String(progressPercent)}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {garden.daysToNext} more {garden.daysToNext === 1 ? 'day' : 'days'}.
                  {streak !== undefined && streak.freezesAvailable > 0
                    ? ' 1 freeze saved in case life gets busy.'
                    : ''}
                </p>
              </div>
            )}

            <p className="mt-4 flex items-center gap-2 text-sm" data-testid="garden-water">
              <Droplets
                className={cn('size-4', garden.watered ? 'text-sky-ink' : 'text-muted-foreground')}
                aria-hidden="true"
              />
              {garden.watered
                ? 'Watered today: you reached your daily goal.'
                : garden.minutesToWater > 0
                  ? `${String(garden.minutesToWater)} more ${garden.minutesToWater === 1 ? 'minute' : 'minutes'} of practice waters it today.`
                  : 'Any practice today keeps it growing.'}
            </p>

            <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild className="btn-cta min-h-[44px] w-full sm:w-auto">
                <Link to="/">
                  <Droplets className="size-[18px]" aria-hidden="true" />
                  Water it today
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 min-h-[44px] w-full text-muted-foreground sm:w-auto"
                onClick={() => {
                  chatPanel?.open()
                  toast('How does the chess garden grow? Asked Sage.')
                }}
              >
                <HelpCircle className="size-4" aria-hidden="true" />
                How it grows
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* You vs You Metrics */}
      <section className="@container mt-8" aria-labelledby="vs-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="vs-h" className="text-xl font-bold">
            You vs you,{' '}
            {timeRange === '30d'
              ? '30 days ago'
              : timeRange === '90d'
                ? '90 days ago'
                : 'from the start'}
          </h2>
          <span className="text-xs text-muted-foreground">
            {dateRangeLabel(timeRange, model.window.from, model.window.to)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6 @[520px]:grid-cols-3 @[980px]:grid-cols-6">
          {model.metrics.map((metric) => (
            <div key={metric.label} className="card p-3 sm:p-4">
              <div className="label truncate text-[11px] sm:text-xs">{metric.label}</div>
              <div className="mt-1 font-display text-xl font-bold tabular-nums sm:text-2xl">
                {metric.value}
              </div>
              <div
                className={cn(
                  'mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium sm:text-xs',
                  metric.tone === 'success' ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {metric.icon === 'up' && (
                  <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                {metric.icon === 'down' && (
                  <ArrowDownRight className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                {metric.icon === 'rotate' && (
                  <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{metric.delta}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Charts */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Rating charts">
        <LineChart
          title="Puzzle rating"
          caption={`${timeRange === 'all' ? 'All time' : timeRange === '30d' ? 'Last 30 days' : 'Last 90 days'} · ${String(model.puzzleCount)} rated puzzles`}
          badge={puzzleRange?.icon === 'none' ? undefined : puzzleRange?.delta.split(' ')[0]}
          chart={model.puzzleChart}
          colour="var(--q-best)"
          from={model.window.from}
          to={model.window.to}
          summary={
            model.puzzleChart === undefined
              ? ''
              : `Puzzle rating from ${String(Math.round(model.puzzleChart.first.value))} to ${String(Math.round(model.puzzleChart.last.value))}`
          }
          empty="Solve a few rated puzzles and your rating line appears here."
          valueLabel="Rating"
        />
        <LineChart
          title="Game accuracy"
          caption={`${timeRange === 'all' ? 'All time' : timeRange === '30d' ? 'Last 30 days' : 'Last 90 days'} · ${String(model.gameCount)} reviewed games`}
          badge={undefined}
          chart={model.accuracyChart}
          colour="var(--sky-ink)"
          from={model.window.from}
          to={model.window.to}
          summary={
            model.accuracyChart === undefined
              ? ''
              : `Game accuracy from ${String(Math.round(model.accuracyChart.first.value))} to ${String(Math.round(model.accuracyChart.last.value))} percent`
          }
          empty="Review a game and its accuracy is plotted here."
          valueLabel="Accuracy (%)"
        />
      </section>

      {/* Skills */}
      <section
        className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        aria-labelledby="skills-h"
      >
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="skills-h" className="text-base font-bold">
                Skill map
              </h2>
              <p className="text-xs text-muted-foreground">
                Puzzle themes you practise most, by first-try solves
              </p>
            </div>
            {model.radar?.previous !== undefined && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-sm bg-q-best/40 ring-1 ring-q-best" />
                  Now
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" />
                  Before
                </span>
              </div>
            )}
          </div>

          {model.radar !== undefined ? (
            <Radar radar={model.radar} summary={radarSummary} />
          ) : (
            <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {model.skills.length === 0
                ? 'Practise a few puzzles in three different themes and your map takes shape.'
                : 'Practise one more theme and your map takes shape.'}
            </p>
          )}

          {model.skills.length > 0 && (
            <DataTable
              caption="Theme mastery"
              columns={['Theme', 'First-try %', 'Puzzles', 'Before']}
              rows={model.skills.map((skill) => [
                themeLabel(skill.theme),
                String(skill.score),
                String(skill.attempts),
                skill.previous === undefined ? 'n/a' : String(skill.previous),
              ])}
              empty="No themes yet."
            />
          )}

          {model.skills.length > 0 && (
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {model.skills.map((skill) => (
                <div key={skill.theme} className="rounded-lg bg-muted/60 p-2">
                  <dt className="text-muted-foreground">{themeLabel(skill.theme)}</dt>
                  <dd className="font-semibold text-foreground">{skillDelta(skill)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="grid content-start gap-4">
          <div className="card p-5">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <TrendingUp className="text-success" aria-hidden="true" />
              Getting stronger
            </h3>
            {strongest.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Your strongest themes show up here once you have a few puzzles behind you.
              </p>
            ) : (
              <ul className="mt-3 divide-y text-sm">
                {strongest.map((skill) => (
                  <li key={skill.theme} className="flex items-center gap-3 py-2.5">
                    <span className="flex-1">
                      <span className="block font-medium">{themeLabel(skill.theme)}</span>
                      <span className="text-xs text-muted-foreground">
                        {skill.score}% first try in {skill.attempts} puzzles
                      </span>
                    </span>
                    <Button asChild variant="ghost" size="sm" className="min-h-[36px]">
                      <Link to="/puzzles">Keep sharp</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card border-cta/25 bg-cta-soft p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <HeartHandshake className="text-cta" aria-hidden="true" />
              Needs a little love
            </h3>
            {weakest.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing yet. Themes that need attention appear after a few more puzzles.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-cta/15 text-sm">
                {weakest.map((skill) => (
                  <li key={skill.theme} className="flex items-center gap-3 py-2.5">
                    <span className="flex-1">
                      <span className="block font-medium">{themeLabel(skill.theme)}</span>
                      <span className="text-xs text-muted-foreground">
                        {skill.score}% first try in {skill.attempts} puzzles
                      </span>
                    </span>
                    <Button
                      asChild
                      size="sm"
                      className="min-h-[36px] bg-cta text-white hover:brightness-105"
                    >
                      <Link to="/puzzles">
                        <Target className="size-3.5" aria-hidden="true" />
                        Train this
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {weakestSkill !== undefined && (
              <button
                type="button"
                className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 text-xs font-medium text-cta hover:underline"
                aria-label={`Ask Sage about ${themeLabel(weakestSkill.theme)}`}
                onClick={() => {
                  chatPanel?.open()
                  toast(`Asking Sage about ${themeLabel(weakestSkill.theme)}`)
                }}
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                Ask Sage about {themeLabel(weakestSkill.theme)}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Heatmap */}
      <section className="card mt-6 p-4 sm:p-5" aria-labelledby="heat-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="heat-h" className="text-base font-bold">
              Practice, last 16 weeks
            </h2>
            <p className="text-xs text-muted-foreground">
              {heatmap.practicedDays} days practised · longest streak {heatmap.longestStreak} days ·{' '}
              {heatmap.freezesUsed} {heatmap.freezesUsed === 1 ? 'freeze' : 'freezes'} used
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            Less
            <span className="size-3 rounded-[3px] bg-muted" />
            <span className="size-3 rounded-[3px] bg-q-best/25" />
            <span className="size-3 rounded-[3px] bg-q-best/50" />
            <span className="size-3 rounded-[3px] bg-q-best/75" />
            <span className="size-3 rounded-[3px] bg-q-best" />
            More
            <span className="ml-1 size-3 rounded-[3px] bg-sky ring-1 ring-sky-ink/30 ring-inset sm:ml-2" />
            Freeze
          </div>
        </div>

        <DataTable
          caption="Practice per day over the last 16 weeks"
          columns={['Day', 'Practice']}
          rows={heatmap.weeks.flatMap((week) =>
            week
              .filter((cell) => cell.kind !== 'none' && cell.kind !== 'future')
              .map((cell): readonly string[] => {
                const [day = '', detail = 'practised'] = cell.title.split(' · ')
                return [day, detail]
              }),
          )}
          empty="No practice days in this stretch yet."
        />

        <div className="mt-4 flex flex-col items-start gap-x-10 gap-y-6 lg:flex-row">
          <div className="w-full max-w-full overflow-x-auto pb-2 lg:max-w-[480px]">
            <div className="min-w-[340px]">
              <div
                className="ml-9 grid grid-cols-16 gap-[3px] text-[10px] text-muted-foreground"
                aria-hidden="true"
              >
                {heatmap.months.map((month, index) => (
                  <span
                    key={`${month.label}-${String(index)}`}
                    style={{ gridColumn: `span ${String(month.weeks)}` }}
                  >
                    {month.weeks >= 2 ? month.label : ''}
                  </span>
                ))}
              </div>

              <div className="mt-1.5 flex gap-1.5">
                <div
                  className="grid w-7.5 shrink-0 grid-rows-7 gap-[3px] text-[10px] leading-none text-muted-foreground"
                  aria-hidden="true"
                >
                  <span className="flex items-center">Mon</span>
                  <span />
                  <span className="flex items-center">Wed</span>
                  <span />
                  <span className="flex items-center">Fri</span>
                  <span />
                  <span />
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="grid grid-cols-16 gap-[3px]"
                    role="img"
                    aria-label={`Practice heatmap for the last 16 weeks: ${String(heatmap.practicedDays)} days practised`}
                  >
                    {heatmap.weeks.map((week, weekIndex) => (
                      <div key={`week-${String(weekIndex)}`} className="grid grid-rows-7 gap-[3px]">
                        {week.map((cell, dayIndex) => (
                          <span
                            key={`cell-${String(weekIndex)}-${String(dayIndex)}`}
                            className={heatmapCellClasses(cell.kind)}
                            title={cell.title}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 text-sm sm:gap-x-6 sm:gap-y-4 lg:flex-1">
            <div>
              <dt className="label">Favourite time</dt>
              <dd className="mt-0.5 font-semibold">
                {heatmap.favouriteHour === undefined
                  ? 'Not enough sessions yet'
                  : `Around ${String(heatmap.favouriteHour).padStart(2, '0')}:00`}
              </dd>
            </div>
            <div>
              <dt className="label">Average session</dt>
              <dd className="mt-0.5 font-semibold">
                {heatmap.averageSessionMs === undefined
                  ? '—'
                  : `${String(Math.max(1, Math.round(heatmap.averageSessionMs / 60_000)))} min`}
              </dd>
            </div>
            <div>
              <dt className="label">Most consistent</dt>
              <dd className="mt-0.5 font-semibold">{heatmap.busiestWeekday ?? '—'}</dd>
            </div>
            <div>
              <dt className="label">This month</dt>
              <dd className="mt-0.5 font-semibold">
                {heatmap.daysThisMonth.practiced} of {heatmap.daysThisMonth.elapsed} days
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Milestones */}
      <section className="mt-8" aria-labelledby="ms-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ms-h" className="text-xl font-bold">
            Milestones
          </h2>
          <span className="text-xs text-muted-foreground">Few, and they mean something</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {model.earned.map((milestone) => (
            <div key={milestone.id} className="card flex items-start gap-3 p-3.5 sm:p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-reward text-reward-foreground sm:size-11">
                <MilestoneIcon icon={milestone.icon} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{milestone.title}</div>
                <div className="text-xs text-muted-foreground">{milestone.description}</div>
                <div className="mt-1 text-[11px] font-medium text-reward-ink">
                  {milestone.earnedOn}
                </div>
              </div>
            </div>
          ))}

          {model.pending.map((milestone) => (
            <div
              key={milestone.id}
              className="flex items-start gap-3 rounded-xl border border-dashed p-3.5 sm:p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground sm:size-11">
                <MilestoneIcon icon={milestone.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{milestone.title}</div>
                <div className="text-xs text-muted-foreground">{milestone.description}</div>
                <div
                  role="progressbar"
                  aria-valuenow={milestone.current}
                  aria-valuemin={0}
                  aria-valuemax={milestone.total}
                  aria-label={`${milestone.title} progress`}
                  className="progress mt-2 h-1.5"
                >
                  <span
                    style={{
                      width: `${String(Math.min(100, Math.round((milestone.current / milestone.total) * 100)))}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {milestone.currentDisplay}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
