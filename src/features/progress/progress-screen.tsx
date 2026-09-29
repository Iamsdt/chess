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
  Swords,
  Target,
  Trees,
  TrendingUp,
} from 'lucide-react'
import { useContext, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Button, cn, toast } from '@/design'

export type TimeRange = '30d' | '90d' | 'all'

interface MetricCard {
  readonly label: string
  readonly value: string
  readonly delta: string
  readonly deltaType: 'success' | 'neutral'
  readonly deltaIcon: 'up' | 'down' | 'rotate'
}

interface SkillStat {
  readonly name: string
  readonly value: number
  readonly delta: string
  readonly status: 'success' | 'highlight'
}

interface CompletedMilestone {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly earnedDate: string
  readonly icon: 'shield' | 'swords' | 'mistake'
}

interface InProgressMilestone {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly current: number
  readonly total: number
  readonly progressPercent: number
  readonly currentDisplay: string
  readonly icon: 'castle' | 'puzzle' | 'flower'
}

type HeatmapCellKind = 'none' | 'low' | 'med' | 'high' | 'max' | 'freeze' | 'future'

interface HeatmapCell {
  readonly kind: HeatmapCellKind
  readonly title: string
}

// 16 weeks of practice data from prototype (7 days per week, Mon-Sun)
const PRACTICE_WEEKS: readonly (readonly HeatmapCell[])[] = [
  // W1
  [
    { kind: 'low', title: '5 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'med', title: '12 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'med', title: '12 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'none', title: 'no practice' },
  ],
  // W2
  [
    { kind: 'med', title: '12 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'low', title: '5 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'none', title: 'no practice' },
    { kind: 'low', title: '5 min' },
    { kind: 'high', title: '20 min' },
  ],
  // W3
  [
    { kind: 'none', title: 'no practice' },
    { kind: 'none', title: 'no practice' },
    { kind: 'med', title: '12 min' },
    { kind: 'max', title: '35 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'max', title: '35 min' },
  ],
  // W4
  [
    { kind: 'none', title: 'no practice' },
    { kind: 'high', title: '20 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'none', title: 'no practice' },
    { kind: 'low', title: '5 min' },
    { kind: 'high', title: '20 min' },
  ],
  // W5
  [
    { kind: 'none', title: 'no practice' },
    { kind: 'med', title: '12 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'none', title: 'no practice' },
  ],
  // W6
  [
    { kind: 'none', title: 'no practice' },
    { kind: 'med', title: '12 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'low', title: '5 min' },
  ],
  // W7
  [
    { kind: 'high', title: '20 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'high', title: '20 min' },
    { kind: 'high', title: '20 min' },
  ],
  // W8
  [
    { kind: 'low', title: '5 min' },
    { kind: 'max', title: '35 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'low', title: '5 min' },
    { kind: 'high', title: '20 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'med', title: '12 min' },
  ],
  // W9
  [
    { kind: 'none', title: 'no practice' },
    { kind: 'med', title: '12 min' },
    { kind: 'high', title: '20 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'high', title: '20 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'med', title: '12 min' },
  ],
  // W10
  [
    { kind: 'med', title: '12 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'high', title: '20 min' },
    { kind: 'max', title: '35 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'med', title: '12 min' },
  ],
  // W11
  [
    { kind: 'none', title: 'no practice' },
    { kind: 'med', title: '12 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'max', title: '35 min' },
    { kind: 'high', title: '20 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'low', title: '5 min' },
  ],
  // W12
  [
    { kind: 'med', title: '12 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'med', title: '12 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'none', title: 'no practice' },
    { kind: 'high', title: '20 min' },
  ],
  // W13
  [
    { kind: 'low', title: '5 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'high', title: '20 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'low', title: '5 min' },
    { kind: 'med', title: '12 min' },
  ],
  // W14
  [
    { kind: 'high', title: '20 min' },
    { kind: 'high', title: '20 min' },
    { kind: 'high', title: '20 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'none', title: 'no practice' },
    { kind: 'low', title: '5 min' },
    { kind: 'high', title: '20 min' },
  ],
  // W15
  [
    { kind: 'max', title: '35 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'med', title: '12 min' },
  ],
  // W16
  [
    { kind: 'low', title: '5 min' },
    { kind: 'low', title: '5 min' },
    { kind: 'freeze', title: 'streak freeze' },
    { kind: 'low', title: '5 min' },
    { kind: 'med', title: '12 min' },
    { kind: 'max', title: '35 min' },
    { kind: 'future', title: 'tomorrow' },
  ],
]

function getHeatmapCellClasses(kind: HeatmapCellKind): string {
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

const METRICS_BY_RANGE: Record<TimeRange, readonly MetricCard[]> = {
  '30d': [
    {
      label: 'Puzzle rating',
      value: '1482',
      delta: '+64 from 1418',
      deltaType: 'success',
      deltaIcon: 'up',
    },
    {
      label: 'Sparring rating',
      value: '1180',
      delta: '+56 from 1124',
      deltaType: 'success',
      deltaIcon: 'up',
    },
    {
      label: 'Blunders / game',
      value: '1.4',
      delta: 'was 2.3',
      deltaType: 'success',
      deltaIcon: 'down',
    },
    {
      label: 'Game accuracy',
      value: '78.6%',
      delta: '+4.1 pts',
      deltaType: 'success',
      deltaIcon: 'up',
    },
    {
      label: 'Mistakes cleared',
      value: '23',
      delta: '7 due this week',
      deltaType: 'neutral',
      deltaIcon: 'rotate',
    },
    {
      label: 'Time practised',
      value: '6h 10m',
      delta: '+1h 20m',
      deltaType: 'success',
      deltaIcon: 'up',
    },
  ],
  '90d': [
    {
      label: 'Puzzle rating',
      value: '1482',
      delta: '+142 from 1340',
      deltaType: 'success',
      deltaIcon: 'up',
    },
    {
      label: 'Sparring rating',
      value: '1180',
      delta: '+118 from 1062',
      deltaType: 'success',
      deltaIcon: 'up',
    },
    {
      label: 'Blunders / game',
      value: '1.4',
      delta: 'was 3.1',
      deltaType: 'success',
      deltaIcon: 'down',
    },
    {
      label: 'Game accuracy',
      value: '78.6%',
      delta: '+8.3 pts',
      deltaType: 'success',
      deltaIcon: 'up',
    },
    {
      label: 'Mistakes cleared',
      value: '64',
      delta: '7 due this week',
      deltaType: 'neutral',
      deltaIcon: 'rotate',
    },
    {
      label: 'Time practised',
      value: '18h 40m',
      delta: '+4h 15m',
      deltaType: 'success',
      deltaIcon: 'up',
    },
  ],
  all: [
    {
      label: 'Puzzle rating',
      value: '1482',
      delta: '+282 from 1200',
      deltaType: 'success',
      deltaIcon: 'up',
    },
    {
      label: 'Sparring rating',
      value: '1180',
      delta: '+230 from 950',
      deltaType: 'success',
      deltaIcon: 'up',
    },
    {
      label: 'Blunders / game',
      value: '1.4',
      delta: 'was 4.0',
      deltaType: 'success',
      deltaIcon: 'down',
    },
    {
      label: 'Game accuracy',
      value: '78.6%',
      delta: '+15.2 pts',
      deltaType: 'success',
      deltaIcon: 'up',
    },
    {
      label: 'Mistakes cleared',
      value: '112',
      delta: '7 due this week',
      deltaType: 'neutral',
      deltaIcon: 'rotate',
    },
    {
      label: 'Time practised',
      value: '42h 20m',
      delta: 'Total learning',
      deltaType: 'success',
      deltaIcon: 'up',
    },
  ],
}

const SKILL_STATS: readonly SkillStat[] = [
  { name: 'Tactics', value: 78, delta: '+16', status: 'success' },
  { name: 'Openings', value: 72, delta: '+6', status: 'success' },
  { name: 'Endgames', value: 42, delta: '+2 · flat', status: 'highlight' },
  { name: 'Calculation', value: 60, delta: '+8', status: 'success' },
  { name: 'Time use', value: 50, delta: '+6', status: 'success' },
  { name: 'Board vision', value: 66, delta: '+11', status: 'success' },
]

const COMPLETED_MILESTONES: readonly CompletedMilestone[] = [
  {
    id: 'blunder-week',
    title: 'A week without blunders',
    description: '7 games in a row, no piece left hanging',
    earnedDate: 'Earned 14 Sep',
    icon: 'shield',
  },
  {
    id: 'beat-stockfish',
    title: 'Beat Stockfish 1200',
    description: 'Won with the Italian, no take-backs',
    earnedDate: 'Earned 9 Sep',
    icon: 'swords',
  },
  {
    id: 'mistake-mastered',
    title: 'First mistake mastered',
    description: 'Recalled it at 3, 7 and 21 days',
    earnedDate: 'Earned 28 Aug',
    icon: 'mistake',
  },
]

const IN_PROGRESS_MILESTONES: readonly InProgressMilestone[] = [
  {
    id: 'lucena-bridge',
    title: 'Build the bridge',
    description: 'Win the Lucena position 3 times',
    current: 1,
    total: 3,
    progressPercent: 33,
    currentDisplay: '1 of 3',
    icon: 'castle',
  },
  {
    id: 'rating-1500',
    title: 'Puzzle rating 1500',
    description: '18 points to go at this pace: about 6 days',
    current: 1482,
    total: 1500,
    progressPercent: 78,
    currentDisplay: '1482 of 1500',
    icon: 'puzzle',
  },
  {
    id: 'first-bloom',
    title: 'First bloom',
    description: 'Practise 15 days in a row',
    current: 12,
    total: 15,
    progressPercent: 80,
    currentDisplay: '12 of 15',
    icon: 'flower',
  },
]

/**
 * Growth / Progress Screen (`/progress`) — ported from `prototype/progress.html`.
 *
 * Provides a serene, personal progress sanctuary:
 * - Garden hero visualizing practice consistency through a botanical metaphor
 * - Rating progression tracking against previous self
 * - 6-axis skill radar highlighting strengths and areas needing focus
 * - 16-week practice heatmap with freeze detection
 * - Milestones celebrating personal growth
 */
export function ProgressScreen() {
  const chatPanel = useContext(ChatPanelContext)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  const metrics = METRICS_BY_RANGE[timeRange]
  const dateRangeLabel =
    timeRange === '30d'
      ? '20 Aug → 19 Sep'
      : timeRange === '90d'
        ? '21 Jun → 19 Sep'
        : 'All-time journey'

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
      `}</style>

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Only you vs you. No leaderboards, ever.</p>
          <h1 className="page-title mt-1">Growth</h1>
        </div>
        <div className="seg flex w-full sm:w-auto" role="group" aria-label="Time range">
          <button
            type="button"
            className={cn(
              'min-h-[36px] flex-1 sm:min-h-0 sm:flex-none',
              timeRange === '30d' && 'is-active',
            )}
            onClick={() => {
              setTimeRange('30d')
            }}
          >
            30 days
          </button>
          <button
            type="button"
            className={cn(
              'min-h-[36px] flex-1 sm:min-h-0 sm:flex-none',
              timeRange === '90d' && 'is-active',
            )}
            onClick={() => {
              setTimeRange('90d')
            }}
          >
            90 days
          </button>
          <button
            type="button"
            className={cn(
              'min-h-[36px] flex-1 sm:min-h-0 sm:flex-none',
              timeRange === 'all' && 'is-active',
            )}
            onClick={() => {
              setTimeRange('all')
            }}
          >
            All time
          </button>
        </div>
      </header>

      {/* Garden Hero */}
      <section className="card mt-6 overflow-hidden" aria-labelledby="garden-h">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Garden Graphic */}
          <div className="relative flex flex-col bg-accent/60 p-4 sm:p-6">
            <span className="badge badge-reward self-start">
              <Flame className="size-3.5" aria-hidden="true" />
              12-day streak
            </span>

            <svg
              viewBox="70 14 220 186"
              className="mx-auto my-auto w-full max-w-[280px] pt-2 sm:max-w-[360px]"
              role="img"
              aria-label="Your chess garden: a sapling with a yellow bud, three days from blooming"
            >
              <circle cx="252" cy="50" r="22" fill="var(--reward)" opacity=".35" />
              <circle cx="252" cy="50" r="13" fill="var(--reward)" opacity=".7" />
              <ellipse cx="180" cy="182" rx="104" ry="13" fill="#a3b89b" opacity=".35" />
              <ellipse cx="180" cy="180" rx="62" ry="7" fill="#a3b89b" opacity=".45" />

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

              {/* Living sapling */}
              <g className="garden-sway">
                <path
                  d="M180 176 C180 146 178 116 181 70"
                  stroke="#5f8b6c"
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M180 140 C160 134 142 120 138 98 C160 98 176 114 180 140Z"
                  fill="#8fb88f"
                />
                <path d="M181 118 C200 110 218 96 222 74 C198 74 184 92 181 118Z" fill="#6c9d73" />
                <path
                  d="M180 158 C198 154 212 146 218 132 C200 130 186 140 180 158Z"
                  fill="#8fb88f"
                />
                <path d="M181 96 C166 92 156 82 152 68 C168 68 178 78 181 96Z" fill="#6c9d73" />
                <circle cx="181" cy="66" r="9" fill="var(--reward)" />
                <circle cx="181" cy="66" r="4" fill="var(--cta)" opacity=".6" />
              </g>
              <path
                d="M150 180 Q180 170 210 180"
                stroke="#5f8b6c"
                strokeWidth="2"
                fill="none"
                opacity=".5"
              />
            </svg>
            <p className="text-center text-xs text-muted-foreground">
              Dashed outline: what it becomes at Bloom
            </p>
          </div>

          {/* Garden Status & Stages */}
          <div className="flex flex-col p-4 sm:p-6">
            <p className="eyebrow">Your chess garden · Level 4</p>
            <h2 id="garden-h" className="mt-1 text-2xl leading-tight font-bold sm:text-[28px]">
              Sapling, and nearly in bloom
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              It grows with steady practice, not with wins. Missed days don&apos;t kill it. A freeze
              keeps it watered.
            </p>

            <ol
              className="mt-5 grid grid-cols-5 gap-1 text-center text-[11px] font-medium"
              aria-label="Garden stages"
            >
              <li>
                <span className="mx-auto grid size-8 place-items-center rounded-full bg-primary text-primary-foreground sm:size-9">
                  <CircleDot className="size-3.5 sm:size-4" aria-hidden="true" />
                </span>
                <span className="mt-1.5 block">Seed</span>
              </li>
              <li>
                <span className="mx-auto grid size-8 place-items-center rounded-full bg-primary text-primary-foreground sm:size-9">
                  <Sprout className="size-3.5 sm:size-4" aria-hidden="true" />
                </span>
                <span className="mt-1.5 block">Sprout</span>
              </li>
              <li aria-current="step">
                <span className="mx-auto grid size-8 place-items-center rounded-full border-[2.5px] border-cta bg-card text-cta shadow-[0_0_0_5px_rgba(224,103,60,.12)] sm:size-9">
                  <Leaf className="size-3.5 sm:size-4" aria-hidden="true" />
                </span>
                <span className="mt-1.5 block font-semibold text-cta">Sapling</span>
              </li>
              <li>
                <span className="mx-auto grid size-8 place-items-center rounded-full border border-dashed bg-card text-muted-foreground sm:size-9">
                  <Flower2 className="size-3.5 sm:size-4" aria-hidden="true" />
                </span>
                <span className="mt-1.5 block text-muted-foreground">Bloom</span>
              </li>
              <li>
                <span className="mx-auto grid size-8 place-items-center rounded-full border border-dashed bg-card text-muted-foreground sm:size-9">
                  <Trees className="size-3.5 sm:size-4" aria-hidden="true" />
                </span>
                <span className="mt-1.5 block text-muted-foreground">Tree</span>
              </li>
            </ol>

            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">To Bloom</span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">12 of 15</span> practice days
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={12}
                aria-valuemin={0}
                aria-valuemax={15}
                aria-label="Practice days to Bloom"
                className="progress mt-2 h-2.5"
              >
                <span className="w-[80%] bg-cta" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                3 more days. 1 freeze saved in case life gets busy.
              </p>
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild className="btn-cta min-h-[44px] w-full sm:w-auto">
                <Link to="/">
                  <Droplets className="size-[18px]" aria-hidden="true" />
                  Water it today · 4 min
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
          <span className="text-xs text-muted-foreground">{dateRangeLabel}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6 @[520px]:grid-cols-3 @[980px]:grid-cols-6">
          {metrics.map((m) => (
            <div key={m.label} className="card p-3 sm:p-4">
              <div className="label truncate text-[11px] sm:text-xs">{m.label}</div>
              <div className="mt-1 font-display text-xl font-bold tabular-nums sm:text-2xl">
                {m.value}
              </div>
              <div
                className={cn(
                  'mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium sm:text-xs',
                  m.deltaType === 'success' ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {m.deltaIcon === 'up' && (
                  <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                {m.deltaIcon === 'down' && (
                  <ArrowDownRight className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                {m.deltaIcon === 'rotate' && (
                  <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{m.delta}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rating Charts */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Rating charts">
        {/* Puzzle Rating */}
        <figure className="card p-4 sm:p-5">
          <figcaption className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">Puzzle rating</h3>
              <p className="text-xs text-muted-foreground">Last 30 days · 412 puzzles</p>
            </div>
            <span className="badge badge-soft">+64</span>
          </figcaption>
          <svg
            viewBox="0 0 320 160"
            className="mt-3 w-full"
            role="img"
            aria-label="Puzzle rating rose from 1418 to 1482 over 30 days"
          >
            <g className="text-[10px]" fill="var(--muted-foreground)">
              <line x1="40" x2="312" y1="20" y2="20" stroke="var(--border)" />
              <text x="32" y="23" textAnchor="end">
                1500
              </text>
              <line x1="40" x2="312" y1="75" y2="75" stroke="var(--border)" />
              <text x="32" y="78" textAnchor="end">
                1450
              </text>
              <line x1="40" x2="312" y1="130" y2="130" stroke="var(--border)" />
              <text x="32" y="133" textAnchor="end">
                1400
              </text>
              <text x="40" y="150">
                20 Aug
              </text>
              <text x="175" y="150" textAnchor="middle">
                4 Sep
              </text>
              <text x="310" y="150" textAnchor="end">
                Today
              </text>
            </g>
            <path
              d="M40,110.2 L70,102.5 L100,116.8 L130,90.4 L160,84.9 L190,93.7 L220,72.8 L250,64 L280,51.9 L310,39.8 L310,130 L40,130Z"
              fill="var(--q-best)"
              opacity=".12"
            />
            <polyline
              points="40,110.2 70,102.5 100,116.8 130,90.4 160,84.9 190,93.7 220,72.8 250,64 280,51.9 310,39.8"
              fill="none"
              stroke="var(--q-best)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle
              cx="40"
              cy="110.2"
              r="3.5"
              fill="var(--card)"
              stroke="var(--muted-foreground)"
              strokeWidth="1.5"
            />
            <circle
              cx="310"
              cy="39.8"
              r="4.5"
              fill="var(--q-best)"
              stroke="var(--card)"
              strokeWidth="2"
            />
            <text
              x="302"
              y="30"
              textAnchor="end"
              className="text-[11px] font-semibold"
              fill="var(--foreground)"
            >
              1482
            </text>
          </svg>
        </figure>

        {/* Sparring Rating */}
        <figure className="card p-5">
          <figcaption className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">Sparring rating</h3>
              <p className="text-xs text-muted-foreground">Last 30 days · 18 games vs Stockfish</p>
            </div>
            <span className="badge badge-soft">+56</span>
          </figcaption>
          <svg
            viewBox="0 0 320 160"
            className="mt-3 w-full"
            role="img"
            aria-label="Sparring rating rose from 1124 to 1180 over 30 days"
          >
            <g className="text-[10px]" fill="var(--muted-foreground)">
              <line x1="40" x2="312" y1="20" y2="20" stroke="var(--border)" />
              <text x="32" y="23" textAnchor="end">
                1200
              </text>
              <line x1="40" x2="312" y1="75" y2="75" stroke="var(--border)" />
              <text x="32" y="78" textAnchor="end">
                1150
              </text>
              <line x1="40" x2="312" y1="130" y2="130" stroke="var(--border)" />
              <text x="32" y="133" textAnchor="end">
                1100
              </text>
              <text x="40" y="150">
                20 Aug
              </text>
              <text x="175" y="150" textAnchor="middle">
                4 Sep
              </text>
              <text x="310" y="150" textAnchor="end">
                Today
              </text>
            </g>
            <path
              d="M40,103.6 L70,95.9 L100,109.1 L130,86 L160,72.8 L190,79.4 L220,66.2 L250,60.7 L280,51.9 L310,42 L310,130 L40,130Z"
              fill="var(--sky-ink)"
              opacity=".12"
            />
            <polyline
              points="40,103.6 70,95.9 100,109.1 130,86 160,72.8 190,79.4 220,66.2 250,60.7 280,51.9 310,42"
              fill="none"
              stroke="var(--sky-ink)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle
              cx="40"
              cy="103.6"
              r="3.5"
              fill="var(--card)"
              stroke="var(--muted-foreground)"
              strokeWidth="1.5"
            />
            <circle
              cx="310"
              cy="42"
              r="4.5"
              fill="var(--sky-ink)"
              stroke="var(--card)"
              strokeWidth="2"
            />
            <text
              x="302"
              y="32"
              textAnchor="end"
              className="text-[11px] font-semibold"
              fill="var(--foreground)"
            >
              1180
            </text>
          </svg>
        </figure>
      </section>

      {/* Skills Map & Focus Areas */}
      <section
        className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        aria-labelledby="skills-h"
      >
        {/* Radar Map */}
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="skills-h" className="text-base font-bold">
                Skill map
              </h2>
              <p className="text-xs text-muted-foreground">From your games, puzzles and drills</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-q-best/40 ring-1 ring-q-best" />
                Now
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" />
                30 days ago
              </span>
            </div>
          </div>

          <svg
            viewBox="-56 -10 372 262"
            className="mx-auto mt-3 w-full max-w-[440px]"
            role="img"
            aria-label="Skill radar. Tactics 78, Openings 72, Endgames 42, Calculation 60, Time use 50, Board vision 66. Every skill grew except Endgames, which is flat."
          >
            {/* Radar Grid Rings */}
            <polygon
              points="130.0,98.5 148.6,109.2 148.6,130.8 130.0,141.5 111.4,130.8 111.4,109.2"
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
            />
            <polygon
              points="130.0,77.0 167.2,98.5 167.2,141.5 130.0,163.0 92.8,141.5 92.8,98.5"
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
            />
            <polygon
              points="130.0,55.5 185.9,87.8 185.9,152.2 130.0,184.5 74.1,152.2 74.1,87.8"
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
            />
            <polygon
              points="130.0,34.0 204.5,77.0 204.5,163.0 130.0,206.0 55.5,163.0 55.5,77.0"
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
            />

            {/* Axes */}
            <line x1="130" y1="120" x2="130.0" y2="34.0" stroke="var(--border)" strokeWidth="1" />
            <line x1="130" y1="120" x2="204.5" y2="77.0" stroke="var(--border)" strokeWidth="1" />
            <line x1="130" y1="120" x2="204.5" y2="163.0" stroke="var(--border)" strokeWidth="1" />
            <line x1="130" y1="120" x2="130.0" y2="206.0" stroke="var(--border)" strokeWidth="1" />
            <line x1="130" y1="120" x2="55.5" y2="163.0" stroke="var(--border)" strokeWidth="1" />
            <line x1="130" y1="120" x2="55.5" y2="77.0" stroke="var(--border)" strokeWidth="1" />

            {/* 30 days ago polygon */}
            <polygon
              points="130.0,66.7 179.2,91.6 159.8,137.2 130.0,164.7 97.2,138.9 89.0,96.3"
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />

            {/* Current polygon */}
            <polygon
              points="130.0,52.9 183.6,89.0 161.3,138.1 130.0,171.6 92.8,141.5 80.8,91.6"
              fill="var(--q-best)"
              fillOpacity=".22"
              stroke="var(--q-best)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle
              cx="130.0"
              cy="52.9"
              r="3.5"
              fill="var(--q-best)"
              stroke="var(--card)"
              strokeWidth="1.5"
            />
            <circle
              cx="183.6"
              cy="89.0"
              r="3.5"
              fill="var(--q-best)"
              stroke="var(--card)"
              strokeWidth="1.5"
            />
            <circle
              cx="161.3"
              cy="138.1"
              r="3.5"
              fill="var(--q-best)"
              stroke="var(--card)"
              strokeWidth="1.5"
            />
            <circle
              cx="130.0"
              cy="171.6"
              r="3.5"
              fill="var(--q-best)"
              stroke="var(--card)"
              strokeWidth="1.5"
            />
            <circle
              cx="92.8"
              cy="141.5"
              r="3.5"
              fill="var(--q-best)"
              stroke="var(--card)"
              strokeWidth="1.5"
            />
            <circle
              cx="80.8"
              cy="91.6"
              r="3.5"
              fill="var(--q-best)"
              stroke="var(--card)"
              strokeWidth="1.5"
            />

            {/* Skill Labels */}
            <text
              x="130.0"
              y="20.8"
              textAnchor="middle"
              className="fill-foreground text-[12.5px] font-medium"
            >
              Tactics <tspan className="fill-muted-foreground">78</tspan>
            </text>
            <text
              x="219.4"
              y="72.4"
              textAnchor="start"
              className="fill-foreground text-[12.5px] font-medium"
            >
              Openings <tspan className="fill-muted-foreground">72</tspan>
            </text>
            <text
              x="219.4"
              y="175.6"
              textAnchor="start"
              className="fill-foreground text-[12.5px] font-medium"
            >
              Endgames <tspan className="fill-muted-foreground">42</tspan>
            </text>
            <text
              x="130.0"
              y="227.2"
              textAnchor="middle"
              className="fill-foreground text-[12.5px] font-medium"
            >
              Calculation <tspan className="fill-muted-foreground">60</tspan>
            </text>
            <text
              x="40.6"
              y="175.6"
              textAnchor="end"
              className="fill-foreground text-[12.5px] font-medium"
            >
              Time use <tspan className="fill-muted-foreground">50</tspan>
            </text>
            <text
              x="40.6"
              y="72.4"
              textAnchor="end"
              className="fill-foreground text-[12.5px] font-medium"
            >
              Board vision <tspan className="fill-muted-foreground">66</tspan>
            </text>
          </svg>

          {/* Skill deltas */}
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            {SKILL_STATS.map((s) => (
              <div
                key={s.name}
                className={cn(
                  'rounded-lg p-2',
                  s.status === 'highlight' ? 'bg-cta-soft' : 'bg-muted/60',
                )}
              >
                <dt className="text-muted-foreground">{s.name}</dt>
                <dd
                  className={cn(
                    'font-semibold',
                    s.status === 'highlight' ? 'text-cta' : 'text-success',
                  )}
                >
                  {s.delta}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Strengths and Focus Cards */}
        <div className="grid content-start gap-4">
          {/* Getting Stronger */}
          <div className="card p-5">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <TrendingUp className="text-success" aria-hidden="true" />
              Getting stronger
            </h3>
            <ul className="mt-3 divide-y text-sm">
              <li className="flex items-center gap-3 py-2.5">
                <span className="flex-1">
                  <span className="block font-medium">Tactics: forks and pins</span>
                  <span className="text-xs text-muted-foreground">
                    +16 this month · you spot them 2s faster
                  </span>
                </span>
                <Button asChild variant="ghost" size="sm" className="min-h-[36px]">
                  <Link to="/puzzles">Keep sharp</Link>
                </Button>
              </li>
              <li className="flex items-center gap-3 py-2.5">
                <span className="flex-1">
                  <span className="block font-medium">Italian Game</span>
                  <span className="text-xs text-muted-foreground">84.6% accuracy in 11 games</span>
                </span>
                <Button asChild variant="ghost" size="sm" className="min-h-[36px]">
                  <Link to="/openings">Repertoire</Link>
                </Button>
              </li>
              <li className="flex items-center gap-3 py-2.5">
                <span className="flex-1">
                  <span className="block font-medium">Board vision</span>
                  <span className="text-xs text-muted-foreground">
                    +11 · fewer pieces left hanging
                  </span>
                </span>
                <Button asChild variant="ghost" size="sm" className="min-h-[36px]">
                  <Link to="/drills/vision">Keep sharp</Link>
                </Button>
              </li>
            </ul>
          </div>

          {/* Needs a Little Love */}
          <div className="card border-cta/25 bg-cta-soft p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <HeartHandshake className="text-cta" aria-hidden="true" />
              Needs a little love
            </h3>
            <ul className="mt-3 divide-y divide-cta/15 text-sm">
              <li className="flex items-center gap-3 py-2.5">
                <span className="flex-1">
                  <span className="block font-medium">Rook endgames</span>
                  <span className="text-xs text-muted-foreground">
                    3 won positions ended in draws
                  </span>
                </span>
                <Button
                  asChild
                  size="sm"
                  className="min-h-[36px] bg-cta text-white hover:brightness-105"
                >
                  <Link to="/drills/endgames">
                    <Target className="size-3.5" aria-hidden="true" />
                    Train this
                  </Link>
                </Button>
              </li>
              <li className="flex items-center gap-3 py-2.5">
                <span className="flex-1">
                  <span className="block font-medium">Time use</span>
                  <span className="text-xs text-muted-foreground">
                    You spend 40% of your clock on moves 8–12
                  </span>
                </span>
                <Button asChild variant="outline" size="sm" className="min-h-[36px]">
                  <Link to="/play">Train this</Link>
                </Button>
              </li>
              <li className="flex items-center gap-3 py-2.5">
                <span className="flex-1">
                  <span className="block font-medium">Defending knight forks</span>
                  <span className="text-xs text-muted-foreground">Started 4 of your 5 losses</span>
                </span>
                <Button asChild variant="outline" size="sm" className="min-h-[36px]">
                  <Link to="/mistakes">Train this</Link>
                </Button>
              </li>
            </ul>
            <button
              type="button"
              className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 text-xs font-medium text-cta hover:underline"
              aria-label="Ask Sage why Endgames is flat"
              onClick={() => {
                chatPanel?.open()
                toast("Asking Sage why Endgames is flat and what's the smallest fix")
              }}
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Ask Sage why Endgames is flat
            </button>
          </div>
        </div>
      </section>

      {/* Heatmap Section */}
      <section className="card mt-6 p-4 sm:p-5" aria-labelledby="heat-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="heat-h" className="text-base font-bold">
              Practice, last 16 weeks
            </h2>
            <p className="text-xs text-muted-foreground">
              88 days practised · longest streak 19 days · 1 freeze used
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

        <div className="mt-4 flex flex-col items-start gap-x-10 gap-y-6 lg:flex-row">
          <div className="w-full max-w-full overflow-x-auto pb-2 lg:max-w-[480px]">
            <div className="min-w-[340px]">
              {/* Months Header */}
              <div
                className="ml-9 grid grid-cols-16 gap-[3px] text-[10px] text-muted-foreground"
                aria-hidden="true"
              >
                <span className="col-span-5">June</span>
                <span className="col-span-4">July</span>
                <span className="col-span-5">August</span>
                <span className="col-span-2">Sep</span>
              </div>

              {/* Days and Grid */}
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
                    aria-label="Practice heatmap for the last 16 weeks"
                  >
                    {PRACTICE_WEEKS.map((week, weekIndex) => (
                      <div key={`week-${String(weekIndex)}`} className="grid grid-rows-7 gap-[3px]">
                        {week.map((cell, dayIndex) => (
                          <span
                            key={`cell-${String(weekIndex)}-${String(dayIndex)}`}
                            className={getHeatmapCellClasses(cell.kind)}
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

          {/* Activity Breakdown */}
          <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 text-sm sm:gap-x-6 sm:gap-y-4 lg:flex-1">
            <div>
              <dt className="label">Favourite time</dt>
              <dd className="mt-0.5 font-semibold">Evenings, around 8pm</dd>
            </div>
            <div>
              <dt className="label">Average session</dt>
              <dd className="mt-0.5 font-semibold">14 min</dd>
            </div>
            <div>
              <dt className="label">Most consistent</dt>
              <dd className="mt-0.5 font-semibold">Thursdays</dd>
            </div>
            <div>
              <dt className="label">This month</dt>
              <dd className="mt-0.5 font-semibold">17 of 19 days</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Milestones Section */}
      <section className="mt-8" aria-labelledby="ms-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ms-h" className="text-xl font-bold">
            Milestones
          </h2>
          <span className="text-xs text-muted-foreground">Few, and they mean something</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Completed Milestones */}
          {COMPLETED_MILESTONES.map((ms) => (
            <div key={ms.id} className="card flex items-start gap-3 p-3.5 sm:p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-reward text-[#5a3f00] sm:size-11">
                {ms.icon === 'shield' && <ShieldCheck className="size-5" aria-hidden="true" />}
                {ms.icon === 'swords' && <Swords className="size-5" aria-hidden="true" />}
                {ms.icon === 'mistake' && <RotateCcw className="size-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{ms.title}</div>
                <div className="text-xs text-muted-foreground">{ms.description}</div>
                <div className="mt-1 text-[11px] font-medium text-reward-ink">{ms.earnedDate}</div>
              </div>
            </div>
          ))}

          {/* In-Progress Milestones */}
          {IN_PROGRESS_MILESTONES.map((ms) => (
            <div
              key={ms.id}
              className="flex items-start gap-3 rounded-xl border border-dashed p-3.5 sm:p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground sm:size-11">
                {ms.icon === 'castle' && <Castle className="size-5" aria-hidden="true" />}
                {ms.icon === 'puzzle' && <Puzzle className="size-5" aria-hidden="true" />}
                {ms.icon === 'flower' && <Flower2 className="size-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{ms.title}</div>
                <div className="text-xs text-muted-foreground">{ms.description}</div>
                <div
                  role="progressbar"
                  aria-valuenow={ms.current}
                  aria-valuemin={0}
                  aria-valuemax={ms.total}
                  aria-label={`${ms.title} progress`}
                  className="progress mt-2 h-1.5"
                >
                  <span style={{ width: `${String(ms.progressPercent)}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{ms.currentDisplay}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
