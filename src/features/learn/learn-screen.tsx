import { Link } from '@tanstack/react-router'
import {
  Award,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Clock,
  Compass,
  Crown,
  Eye,
  Flag,
  Flame,
  Footprints,
  MessageCircle,
  Package,
  Play,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react'
import { useContext, useMemo, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Board } from '@/board'
import { Button, toast } from '@/design'
import { emptyBoardShapes, toFen, toSquare, type Arrow, type BoardShapes, type Fen } from '@/domain'

export interface TrackData {
  readonly id: string
  readonly title: string
  readonly lessonsCompleted: number
  readonly totalLessons: number
  readonly percent: number
  readonly icon: 'zap' | 'crown' | 'book-open' | 'flag' | 'compass'
  readonly colorBg: string
  readonly colorText: string
  readonly isCurrent?: boolean
  readonly isDone?: boolean
  readonly isNew?: boolean
  readonly unitHeader: string
  readonly timeLeft: string
}

export interface UnitLessonItem {
  readonly id: string
  readonly title: string
  readonly completed?: boolean
  readonly dateLabel?: string
  readonly isHero?: boolean
}

export interface UnitData {
  readonly id: string
  readonly unitNumber: number
  readonly title: string
  readonly status: 'completed' | 'in-progress' | 'upcoming'
  readonly totalLessons: number
  readonly completedLessons: number
  readonly badge?: string
  readonly badgeClass?: string
  readonly lessons: readonly UnitLessonItem[]
}

export interface ContentPackItem {
  readonly id: string
  readonly title: string
  readonly version: string
  readonly lessonCountText: string
  readonly source: string
  readonly removable?: boolean
  readonly colorClass: string
}

const DEFAULT_TRACK: TrackData = {
  id: 'tactics',
  title: 'Tactics Foundations',
  lessonsCompleted: 8,
  totalLessons: 21,
  percent: 38,
  icon: 'zap',
  colorBg: 'bg-cta-soft',
  colorText: 'text-cta',
  isCurrent: true,
  unitHeader: 'Unit 2 of 5',
  timeLeft: 'about 1 h 20 min left',
}

const TRACKS: readonly TrackData[] = [
  DEFAULT_TRACK,
  {
    id: 'checkmate',
    title: 'Checkmate Patterns',
    lessonsCompleted: 3,
    totalLessons: 20,
    percent: 15,
    icon: 'crown',
    colorBg: 'bg-lilac',
    colorText: 'text-lilac-ink',
    unitHeader: 'Unit 1 of 4',
    timeLeft: 'about 2 h left',
  },
  {
    id: 'openings',
    title: 'Opening Principles',
    lessonsCompleted: 12,
    totalLessons: 12,
    percent: 100,
    icon: 'book-open',
    colorBg: 'bg-sky',
    colorText: 'text-sky-ink',
    isDone: true,
    unitHeader: 'Completed',
    timeLeft: 'All 12 lessons mastered',
  },
  {
    id: 'endgames',
    title: 'Endgame Essentials',
    lessonsCompleted: 4,
    totalLessons: 18,
    percent: 22,
    icon: 'flag',
    colorBg: 'bg-reward-soft',
    colorText: 'text-reward-ink',
    unitHeader: 'Unit 2 of 4',
    timeLeft: 'about 1 h 45 min left',
  },
  {
    id: 'strategy',
    title: 'Strategy Basics',
    lessonsCompleted: 0,
    totalLessons: 16,
    percent: 0,
    icon: 'compass',
    colorBg: 'bg-accent',
    colorText: 'text-accent-foreground',
    isNew: true,
    unitHeader: 'Unit 1 of 4',
    timeLeft: '16 lessons to start',
  },
]

const TACTICS_UNITS: readonly UnitData[] = [
  {
    id: 'u1',
    unitNumber: 1,
    title: 'Seeing the whole board',
    status: 'completed',
    totalLessons: 5,
    completedLessons: 5,
    badge: '5 of 5',
    lessons: [
      { id: 'u1-1', title: 'Checks, captures, threats', completed: true },
      { id: 'u1-2', title: 'Loose pieces drop off', completed: true },
      { id: 'u1-3', title: 'Counting attackers', completed: true },
      { id: 'u1-4', title: 'Safe squares', completed: true },
      { id: 'u1-5', title: 'Checkpoint quiz · 9 of 10', completed: true },
    ],
  },
  {
    id: 'u2',
    unitNumber: 2,
    title: 'Double attacks',
    status: 'in-progress',
    totalLessons: 6,
    completedLessons: 3,
    lessons: [
      { id: 'u2-1', title: 'Double attacks I', completed: true, dateLabel: 'Tue' },
      { id: 'u2-2', title: 'Pawn forks', completed: true, dateLabel: 'Thu' },
      { id: 'u2-3', title: 'Double attacks II', completed: true, dateLabel: 'Today' },
      { id: 'u2-4', title: 'Royal fork', isHero: true },
      { id: 'u2-5', title: 'Queen forks' },
      { id: 'u2-6', title: 'Checkpoint quiz · 10 positions' },
    ],
  },
  {
    id: 'u3',
    unitNumber: 3,
    title: 'Pins & skewers',
    status: 'upcoming',
    totalLessons: 4,
    completedLessons: 0,
    badge: '3 missed pins last week',
    badgeClass: 'border-transparent bg-sky text-sky-ink',
    lessons: [
      { id: 'u3-1', title: 'Absolute pins' },
      { id: 'u3-2', title: 'Relative pins' },
      { id: 'u3-3', title: 'Skewers' },
      { id: 'u3-4', title: 'Checkpoint quiz' },
    ],
  },
  {
    id: 'u4',
    unitNumber: 4,
    title: 'Discovered attacks',
    status: 'upcoming',
    totalLessons: 3,
    completedLessons: 0,
    lessons: [
      { id: 'u4-1', title: 'Discovered checks' },
      { id: 'u4-2', title: 'Double checks' },
      { id: 'u4-3', title: 'Windmill combinations' },
    ],
  },
  {
    id: 'u5',
    unitNumber: 5,
    title: 'Removing the defender',
    status: 'upcoming',
    totalLessons: 3,
    completedLessons: 0,
    lessons: [
      { id: 'u5-1', title: 'Overloaded pieces' },
      { id: 'u5-2', title: 'Deflection tactics' },
      { id: 'u5-3', title: 'Decoy sacrifices' },
    ],
  },
]

const DEFAULT_PACKS: readonly ContentPackItem[] = [
  {
    id: 'core',
    title: 'Chess King Core',
    version: 'v2.3',
    lessonCountText: '87 lessons',
    source: 'built in',
    colorClass: 'bg-accent text-accent-foreground',
  },
  {
    id: 'mating-nets',
    title: 'Mating Nets 101',
    version: 'v1.1',
    lessonCountText: '24 puzzles',
    source: 'community',
    removable: true,
    colorClass: 'bg-lilac text-lilac-ink',
  },
  {
    id: 'caro-kann-traps',
    title: "Rafi's Caro-Kann traps",
    version: 'v0.4',
    lessonCountText: '12 quizzes',
    source: 'shared by Rafi',
    removable: true,
    colorClass: 'bg-sky text-sky-ink',
  },
]

const ROYAL_FORK_FEN: Fen = toFen('r1q2rk1/1p1n1pbp/p2p2p1/3Np3/4P3/2P5/PP2BPPP/R2Q1RK1 w - - 0 13')

/**
 * S16 · Learn Course Map (`/learn`) — ported from `prototype/learn.html`.
 *
 * Provides a structured pathway through chess tracks:
 * - 5 thematic learning tracks (Tactics, Checkmate, Openings, Endgames, Strategy)
 * - Step-by-step units connecting completed, current and upcoming lessons
 * - Interactive lesson preview card with board diagram and target annotations
 * - Practice rooms shortcuts and community content pack manager
 */
export function LearnScreen() {
  const chatPanel = useContext(ChatPanelContext)
  const [activeTrackId, setActiveTrackId] = useState<string>('tactics')
  const [packs, setPacks] = useState<readonly ContentPackItem[]>(DEFAULT_PACKS)

  const activeTrack = useMemo(
    () => TRACKS.find((t) => t.id === activeTrackId) ?? DEFAULT_TRACK,
    [activeTrackId],
  )

  const heroBoardShapes: BoardShapes = useMemo(() => {
    const arrows: Arrow[] = [
      {
        from: toSquare('d5'),
        to: toSquare('e7'),
        kind: 'best',
      },
    ]

    return {
      ...emptyBoardShapes(),
      highlight: [toSquare('g8'), toSquare('c8')],
      arrows,
    }
  }, [])

  const handleAskSage = (prompt: string) => {
    if (chatPanel) {
      chatPanel.open()
      chatPanel.focusComposer()
    }
    toast(prompt)
  }

  const handleRemovePack = (packId: string) => {
    setPacks((prev) => prev.filter((p) => p.id !== packId))
    toast('Pack removed. Your progress is kept.')
  }

  const handleImportPack = () => {
    toast('Choose a .json pack to import')
  }

  return (
    <main>
      <div className="page">
        {/* Course Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Your course</p>
            <h1 className="page-title mt-1" aria-label="Learn">
              Learn
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Short lessons where you play the moves yourself. About 6 minutes each.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-reward-soft px-3 py-1 text-xs font-semibold text-reward-ink">
              <Flame className="size-3.5" aria-hidden="true" />4 lessons this week
            </span>
          </div>
        </header>

        {/* Track Selector */}
        <section className="mt-7" aria-labelledby="tracks-h">
          <h2 id="tracks-h" className="sr-only">
            Tracks
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="tablist">
            {TRACKS.map((track) => {
              const isSelected = track.id === activeTrackId
              return (
                <button
                  key={track.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`option flex-col items-start gap-2 p-4 ${
                    isSelected ? 'is-active' : ''
                  }`}
                  onClick={() => {
                    setActiveTrackId(track.id)
                  }}
                >
                  <span className="flex w-full items-center justify-between">
                    <span
                      className={`grid size-9 place-items-center rounded-lg ${track.colorBg} ${track.colorText}`}
                    >
                      {track.icon === 'zap' && <Zap className="size-4" aria-hidden="true" />}
                      {track.icon === 'crown' && <Crown className="size-4" aria-hidden="true" />}
                      {track.icon === 'book-open' && (
                        <BookOpen className="size-4" aria-hidden="true" />
                      )}
                      {track.icon === 'flag' && <Flag className="size-4" aria-hidden="true" />}
                      {track.icon === 'compass' && (
                        <Compass className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    {track.isCurrent ? <span className="badge badge-soft">Current</span> : null}
                    {track.isNew ? <span className="badge text-muted-foreground">New</span> : null}
                  </span>
                  <span className="font-display text-[15px] leading-tight font-bold">
                    {track.title}
                  </span>
                  <span className="flex w-full items-center gap-2">
                    <span
                      role="progressbar"
                      aria-valuenow={track.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${track.title} progress`}
                      className="progress h-1.5 flex-1"
                    >
                      <span style={{ width: `${String(track.percent)}%` }} />
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        track.percent === 0 ? 'text-muted-foreground' : ''
                      }`}
                    >
                      {track.isDone ? 'Done' : `${String(track.percent)}%`}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {track.lessonsCompleted > 0
                      ? `${String(track.lessonsCompleted)} of ${String(track.totalLessons)} lessons`
                      : `${String(track.totalLessons)} lessons`}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Main Content: Track Path + Side Column */}
        <div className="mt-8 grid gap-6 min-[1500px]:grid-cols-[minmax(0,1fr)_300px]">
          {/* Left Column: Track Path */}
          <section aria-labelledby="path-h" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="path-h" className="font-display text-xl font-bold">
                {activeTrack.title}
              </h2>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{activeTrack.unitHeader}</span> ·{' '}
                {activeTrack.timeLeft}
              </div>
            </div>

            <ol className="relative mt-4 space-y-3 before:absolute before:top-6 before:bottom-6 before:left-[19px] before:w-0.5 before:rounded before:bg-[repeating-linear-gradient(to_bottom,var(--border)_0_6px,transparent_6px_12px)]">
              {TACTICS_UNITS.map((unit) => {
                if (unit.status === 'completed') {
                  return (
                    <li key={unit.id} className="relative flex items-center gap-4">
                      <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-5" aria-hidden="true" />
                      </span>
                      <details className="card group min-w-0 flex-1 opacity-85">
                        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-muted-foreground">
                              Unit {unit.unitNumber}
                            </div>
                            <div className="text-sm font-medium">{unit.title}</div>
                          </div>
                          {unit.badge ? (
                            <span className="badge text-muted-foreground max-sm:hidden">
                              {unit.badge}
                            </span>
                          ) : null}
                          <ChevronDown
                            className="size-4 text-muted-foreground transition group-open:rotate-180"
                            aria-hidden="true"
                          />
                        </summary>
                        <ul className="grid gap-1 border-t px-4 py-3 text-sm sm:grid-cols-2">
                          {unit.lessons.map((lesson) => (
                            <li
                              key={lesson.id}
                              className="flex items-center gap-2 text-muted-foreground"
                            >
                              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                              <span>{lesson.title}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  )
                }

                if (unit.status === 'in-progress') {
                  return (
                    <li key={unit.id} className="relative flex items-start gap-4">
                      <span className="z-10 mt-5 grid size-10 shrink-0 place-items-center rounded-full border-[2.5px] border-cta bg-card font-display font-bold text-cta shadow-[0_0_0_6px_rgba(224,103,60,.12)]">
                        {unit.unitNumber}
                      </span>
                      <div className="card @container min-w-0 flex-1 overflow-hidden border-cta/30">
                        {/* Unit Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Unit {unit.unitNumber} · in progress
                            </div>
                            <h3 className="font-display text-lg font-bold">{unit.title}</h3>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              <span className="font-medium text-foreground">
                                {unit.completedLessons} of {unit.totalLessons}
                              </span>{' '}
                              lessons
                            </span>
                            <div
                              className="flex gap-1"
                              role="group"
                              aria-label={`${String(unit.completedLessons)} of ${String(unit.totalLessons)} lessons finished`}
                            >
                              <span className="h-1.5 w-5 rounded-full bg-primary" />
                              <span className="h-1.5 w-5 rounded-full bg-primary" />
                              <span className="h-1.5 w-5 rounded-full bg-primary" />
                              <span className="h-1.5 w-5 rounded-full bg-cta" />
                              <span className="h-1.5 w-5 rounded-full bg-muted" />
                              <span className="h-1.5 w-5 rounded-full bg-muted" />
                            </div>
                          </div>
                        </div>

                        {/* Completed Past Lessons */}
                        <ul className="divide-y text-sm">
                          {unit.lessons
                            .filter((l) => l.completed)
                            .map((lesson) => (
                              <li
                                key={lesson.id}
                                className="flex items-center gap-3 px-5 py-2.5 text-muted-foreground"
                              >
                                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                                <span className="flex-1">{lesson.title}</span>
                                {lesson.dateLabel ? (
                                  <span className="text-xs">{lesson.dateLabel}</span>
                                ) : null}
                              </li>
                            ))}
                        </ul>

                        {/* The Current Lesson Hero Card */}
                        <div className="grid gap-5 border-y border-cta/20 bg-cta-soft/50 p-5 @[560px]:grid-cols-[minmax(0,1fr)_180px]">
                          <div>
                            <span className="badge border-transparent bg-reward-soft text-reward-ink">
                              <Sparkles className="size-3.5" aria-hidden="true" />
                              Next up · picked for you
                            </span>
                            <h4 className="mt-3 font-display text-[26px] leading-[1.05] font-bold tracking-tight">
                              Royal fork
                            </h4>
                            <p className="mt-2 text-sm text-muted-foreground">
                              One knight jump, two targets: the king and the queen. The king has to
                              move, and the queen falls.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <Footprints className="size-3.5" aria-hidden="true" />
                                Step 3 of 7
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="size-3.5" aria-hidden="true" />4 min left
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <Target className="size-3.5" aria-hidden="true" />
                                Linked to 4 of your losses
                              </span>
                            </div>
                            <div
                              className="mt-4 flex items-center gap-1.5"
                              role="group"
                              aria-label="Step 3 of 7"
                            >
                              <span className="h-1.5 w-7 rounded-full bg-primary" />
                              <span className="h-1.5 w-7 rounded-full bg-primary" />
                              <span className="h-1.5 w-7 rounded-full bg-cta" />
                              <span className="h-1.5 w-7 rounded-full bg-card" />
                              <span className="h-1.5 w-7 rounded-full bg-card" />
                              <span className="h-1.5 w-7 rounded-full bg-card" />
                              <span className="h-1.5 w-7 rounded-full bg-card" />
                            </div>
                            <div className="mt-5 flex flex-wrap items-center gap-3">
                              <Button asChild className="btn-cta bg-cta text-white hover:bg-cta/90">
                                <Link to="/learn/lesson">
                                  <Play className="mr-1.5 size-4" aria-hidden="true" />
                                  Continue: Royal fork
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                className="h-11 text-muted-foreground"
                                aria-label="Ask Sage about royal fork"
                                onClick={() => {
                                  handleAskSage(
                                    'Before I start: what is a royal fork, in one sentence?',
                                  )
                                }}
                              >
                                <MessageCircle className="mr-1.5 size-4" aria-hidden="true" />
                                Ask Sage first
                              </Button>
                            </div>
                          </div>
                          <figure className="max-w-[220px]">
                            <div className="overflow-hidden rounded-xl ring-1 ring-border">
                              <Board
                                fen={ROYAL_FORK_FEN}
                                orientation="white"
                                coordinates={false}
                                movable="none"
                                shapes={heroBoardShapes}
                                label="Lesson position: White to move"
                              />
                            </div>
                            <figcaption className="mt-2 text-xs text-muted-foreground">
                              <b className="font-medium text-foreground">White to play.</b> Two
                              targets, one jump.
                            </figcaption>
                          </figure>
                        </div>

                        {/* Upcoming Lessons in Unit 2 */}
                        <ul className="divide-y text-sm">
                          {unit.lessons
                            .filter((l) => !l.completed && !l.isHero)
                            .map((lesson) => (
                              <li key={lesson.id}>
                                <Link
                                  to="/learn/lesson"
                                  className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/50"
                                >
                                  <CircleDashed
                                    className="size-4 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                  <span className="flex-1">{lesson.title}</span>
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <Eye className="size-3.5" aria-hidden="true" />
                                    Preview
                                  </span>
                                </Link>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </li>
                  )
                }

                // Upcoming Units (3, 4, 5)
                if (unit.unitNumber === 3) {
                  return (
                    <li key={unit.id} className="relative flex items-center gap-4">
                      <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full border bg-card font-display font-bold text-muted-foreground">
                        {unit.unitNumber}
                      </span>
                      <details className="card group min-w-0 flex-1">
                        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-muted-foreground">
                              Unit {unit.unitNumber} · {unit.totalLessons} lessons
                            </div>
                            <div className="text-sm font-medium">{unit.title}</div>
                          </div>
                          {unit.badge ? (
                            <span
                              className={`badge max-sm:hidden ${unit.badgeClass ?? 'text-muted-foreground'}`}
                            >
                              {unit.badge}
                            </span>
                          ) : null}
                          <ChevronDown
                            className="size-4 text-muted-foreground transition group-open:rotate-180"
                            aria-hidden="true"
                          />
                        </summary>
                        <ul className="divide-y border-t text-sm">
                          {unit.lessons.map((lesson) => (
                            <li key={lesson.id}>
                              <Link
                                to="/learn/lesson"
                                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                              >
                                <CircleDashed
                                  className="size-4 text-muted-foreground"
                                  aria-hidden="true"
                                />
                                <span className="flex-1">{lesson.title}</span>
                                <span className="text-xs text-muted-foreground">Preview</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  )
                }

                return (
                  <li key={unit.id} className="relative flex items-center gap-4">
                    <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full border bg-card font-display font-bold text-muted-foreground">
                      {unit.unitNumber}
                    </span>
                    <div className="card flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground">
                          Unit {unit.unitNumber} · {unit.totalLessons} lessons
                        </div>
                        <div className="text-sm font-medium">{unit.title}</div>
                      </div>
                      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                        <Link to="/learn/lesson">
                          <Eye className="mr-1 size-3.5" aria-hidden="true" />
                          Preview
                        </Link>
                      </Button>
                    </div>
                  </li>
                )
              })}

              {/* Track Milestone Card */}
              <li className="relative flex items-center gap-4">
                <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-reward bg-reward-soft text-reward-ink">
                  <Award className="size-5" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  <span>
                    Finish the track to earn the{' '}
                    <span className="font-medium text-foreground">Tactician</span> leaf for your
                    garden
                  </span>
                </div>
              </li>
            </ol>
          </section>

          {/* Right Column: Practice Rooms, Packs, Order Insights */}
          <div className="grid content-start gap-4 md:max-[1499px]:grid-cols-2">
            {/* Practice Rooms */}
            <section className="card p-5" aria-labelledby="short-h">
              <h2 id="short-h" className="label">
                Practice rooms
              </h2>
              <div className="mt-3 space-y-2">
                <Link
                  to="/openings"
                  className="flex items-center gap-3 rounded-xl bg-sky/50 p-3 transition hover:-translate-y-0.5"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-card text-sky-ink">
                    <BookOpen className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Openings</span>
                    <span className="block text-xs text-muted-foreground">
                      Your repertoire · 7 lines due
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
                <Link
                  to="/drills/endgames"
                  className="flex items-center gap-3 rounded-xl bg-reward-soft p-3 transition hover:-translate-y-0.5"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-card text-reward-ink">
                    <Flag className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Endgames</span>
                    <span className="block text-xs text-muted-foreground">
                      Drills vs Stockfish · 7 drills
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </div>
            </section>

            {/* Content Packs */}
            <section className="card p-5" aria-labelledby="packs-h">
              <div className="flex items-center justify-between gap-2">
                <h2 id="packs-h" className="font-display text-base font-bold">
                  Content packs
                </h2>
                <Button variant="outline" size="sm" onClick={handleImportPack}>
                  <Upload className="mr-1 size-3.5" aria-hidden="true" />
                  Import
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Lessons and quizzes are plain JSON packs. Import one from a friend, a coach or the
                community.
              </p>
              <ul className="mt-3 divide-y text-sm">
                {packs.map((pack) => (
                  <li key={pack.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`grid size-8 place-items-center rounded-lg ${pack.colorClass}`}
                    >
                      <Package className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{pack.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {pack.version} · {pack.lessonCountText} · {pack.source}
                      </span>
                    </span>
                    {pack.removable ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${pack.title}`}
                        onClick={() => {
                          handleRemovePack(pack.id)
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div
                className="mt-3 rounded-lg bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground"
                aria-label="Pack format example"
              >
                <span className="text-foreground">{'{'}</span> &quot;pack&quot;:
                &quot;mating-nets-101&quot;,
                <br />
                &nbsp;&nbsp;&quot;lessons&quot;: [ {'{'} &quot;fen&quot;: &quot;…&quot;,
                &quot;task&quot;: &quot;…&quot; {'}'} ]{' '}
                <span className="text-foreground">{'}'}</span>
              </div>
            </section>

            {/* Why This Order Insight Card */}
            <section className="card bg-accent/50 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Brain className="size-3.5" aria-hidden="true" />
                Why this order?
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sage can reorder lessons around the ideas you missed in your games. You can always
                choose your own path.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                aria-label="Ask Sage to suggest a lesson order"
                onClick={() => {
                  handleAskSage('Suggest a lesson order based on my recent games')
                }}
              >
                <MessageCircle className="mr-1 size-3.5" aria-hidden="true" />
                Ask Sage
              </Button>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
