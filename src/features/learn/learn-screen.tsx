import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock,
  Package,
  Play,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Board } from '@/board'
import { importContentPackFromFile } from '@/content'
import { packsRepo, useAllLessonProgress, useInstalledPacks, useLessons, useSettings } from '@/data'
import { Button, cn, EmptyState, toast } from '@/design'
import { emptyBoardShapes, toFen, type PackId } from '@/domain'

import { buildCourse, type LessonRow, type TrackSummary } from './course'
import { ensureBuiltinLessons } from './lesson-store'

type Install =
  | { readonly status: 'loading' }
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly message: string }

function difficultyLabel(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
}

/** The position the lesson is about, for the card's board: the first one the player will move in. */
function previewFen(row: LessonRow) {
  const step =
    row.lesson.steps.find((candidate) => candidate.kind === 'move') ?? row.lesson.steps[0]
  return toFen(step?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
}

function LessonLink({ row }: { readonly row: LessonRow }) {
  return (
    <Link
      to="/learn/lesson"
      search={{ id: row.lesson.id }}
      className="flex min-h-[56px] items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-ring/60 sm:px-4"
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full',
          row.status === 'completed' && 'bg-primary text-primary-foreground',
          row.status === 'in-progress' && 'border-[2.5px] border-cta text-cta',
          row.status === 'new' && 'border border-dashed text-muted-foreground',
        )}
      >
        {row.status === 'completed' ? (
          <Check className="size-4" aria-hidden="true" />
        ) : row.status === 'in-progress' ? (
          <Play className="size-3.5" aria-hidden="true" />
        ) : (
          <CircleDashed className="size-4" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{row.lesson.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {difficultyLabel(row.lesson.difficulty)} · about {row.lesson.estimatedMinutes} min
          {row.status === 'in-progress' &&
            ` · step ${String(row.stepsDone + 1)} of ${String(row.lesson.steps.length)}`}
        </span>
      </span>
      <span className="sr-only">
        {row.status === 'completed'
          ? 'Completed'
          : row.status === 'in-progress'
            ? 'In progress'
            : 'Not started'}
      </span>
    </Link>
  )
}

/**
 * Learn Screen (`/learn`) — the course map, ported from `prototype/learn.html`.
 *
 * Built from whatever lesson packs are installed: the 49 shipped tutorials arrive as the
 * builtin pack the first time this opens, and a pack imported from a file shows up the
 * moment it is installed. Progress, the "Continue" card and every percentage come from
 * what the player has actually finished.
 */
export function LearnScreen() {
  const lessons = useLessons()
  const progress = useAllLessonProgress()
  const packs = useInstalledPacks()
  const settings = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [install, setInstall] = useState<Install>({ status: 'loading' })
  const [activeTrack, setActiveTrack] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void ensureBuiltinLessons().then((result) => {
      if (cancelled) return
      setInstall(
        result.ok ? { status: 'ready' } : { status: 'error', message: result.error.message },
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  const course = useMemo(
    () =>
      lessons === undefined || progress === undefined ? undefined : buildCourse(lessons, progress),
    [lessons, progress],
  )

  const track: TrackSummary | undefined =
    course?.tracks.find((candidate) => candidate.id === activeTrack) ?? course?.tracks[0]

  function retryInstall(): void {
    setInstall({ status: 'loading' })
    void ensureBuiltinLessons().then((result) => {
      setInstall(
        result.ok ? { status: 'ready' } : { status: 'error', message: result.error.message },
      )
    })
  }

  function onImport(file: File | undefined): void {
    if (file === undefined) return
    void importContentPackFromFile(file).then(async (result) => {
      if (!result.ok) {
        toast.error('That pack could not be imported', {
          description: result.error.problems[0]
            ? `${result.error.problems[0].path}: ${result.error.problems[0].message}`
            : 'The file is not a valid content pack.',
        })
        return
      }
      const installed = await packsRepo.install(result.value)
      if (!installed.ok) {
        toast.error('That pack could not be installed', { description: installed.error.message })
        return
      }
      toast.success(`${installed.value.name} installed`, {
        description: `${String(installed.value.itemCount)} items.`,
      })
    })
  }

  function onRemove(id: PackId, name: string): void {
    void packsRepo.remove(id).then((result) => {
      if (result.ok) toast(`${name} removed`)
      else toast.error('Could not remove that pack', { description: result.error.message })
    })
  }

  const loading =
    course === undefined || (install.status === 'loading' && course.totalLessons === 0)

  return (
    <div className="page @container pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">One small step at a time</p>
          <h1 className="page-title mt-1" aria-label="Learn">
            Learn
          </h1>
        </div>
        {course !== undefined && course.totalLessons > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{course.totalCompleted}</span> of{' '}
            {course.totalLessons} lessons finished
          </p>
        )}
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground" role="status">
          Getting your lessons ready…
        </p>
      ) : install.status === 'error' && course.totalLessons === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={BookOpen}
            title="The lessons could not be loaded"
            description={install.message}
            action={
              <Button onClick={retryInstall}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Try again
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {course.next !== undefined && (
            <section className="card @container mt-6 overflow-hidden" aria-labelledby="continue-h">
              <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 @[560px]:grid-cols-[minmax(0,1fr)_200px]">
                <div>
                  <p className="eyebrow">
                    {course.next.status === 'in-progress'
                      ? 'Continue where you left off'
                      : 'Up next'}
                  </p>
                  <h2
                    id="continue-h"
                    className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl"
                  >
                    {course.next.lesson.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{course.next.lesson.summary}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden="true" />
                    About {course.next.lesson.estimatedMinutes} min ·{' '}
                    {difficultyLabel(course.next.lesson.difficulty)}
                  </p>
                  <Button asChild className="btn-cta mt-4 h-11">
                    <Link to="/learn/lesson" search={{ id: course.next.lesson.id }}>
                      <Play className="size-[18px]" aria-hidden="true" />
                      {course.next.status === 'in-progress' ? 'Continue lesson' : 'Start lesson'}
                    </Link>
                  </Button>
                </div>
                <div className="hidden max-w-[200px] overflow-hidden rounded-xl ring-1 ring-border @[560px]:block">
                  <Board
                    fen={previewFen(course.next)}
                    orientation="white"
                    coordinates={false}
                    movable="none"
                    shapes={emptyBoardShapes()}
                    animationSpeed={settings.board.animation}
                    label={`Preview of ${course.next.lesson.title}`}
                  />
                </div>
              </div>
            </section>
          )}

          {course.totalLessons === 0 ? (
            <div className="mt-8">
              <EmptyState
                icon={BookOpen}
                title="No lessons installed"
                description="Import a content pack to add some."
              />
            </div>
          ) : (
            <section className="mt-6 sm:mt-8" aria-labelledby="tracks-h">
              <h2 id="tracks-h" className="sr-only">
                Tracks
              </h2>
              <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {course.tracks.map((candidate) => {
                  const selected = candidate.id === track?.id
                  return (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                          'card w-full p-4 text-left transition hover:-translate-y-0.5',
                          selected && 'ring-2 ring-primary',
                        )}
                        onClick={() => {
                          setActiveTrack(candidate.id)
                        }}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-display text-base font-bold">
                            {candidate.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {candidate.completed} of {candidate.lessons.length}
                          </span>
                        </span>
                        <span
                          role="progressbar"
                          aria-valuenow={candidate.percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${candidate.title} progress`}
                          className="progress mt-3 h-1.5"
                        >
                          <span style={{ width: `${String(candidate.percent)}%` }} />
                        </span>
                        <span className="mt-1.5 block text-xs text-muted-foreground">
                          {candidate.minutesLeft === 0
                            ? 'All done'
                            : `About ${String(candidate.minutesLeft)} min left`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {track !== undefined && (
                <div className="mt-6">
                  <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                    {track.title}
                    {track.completed === track.lessons.length && (
                      <CheckCircle2 className="size-4 text-primary" aria-label="Track complete" />
                    )}
                  </h3>
                  <ul className="mt-3 grid gap-2 lg:grid-cols-2">
                    {track.lessons.map((row) => (
                      <li key={row.lesson.id}>
                        <LessonLink row={row} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section className="card mt-8 p-4 sm:p-5" aria-labelledby="packs-h">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="packs-h" className="font-display text-base font-bold">
                  Lesson packs
                </h2>
                <p className="text-xs text-muted-foreground">
                  Anyone can write one. They are plain JSON files, and stay on this device.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fileInput.current?.click()
                }}
              >
                <Upload className="size-3.5" aria-hidden="true" />
                Import a pack
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Content pack file"
                tabIndex={-1}
                onChange={(event) => {
                  onImport(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </div>
            <ul className="mt-3 divide-y">
              {(packs ?? []).map((pack) => (
                <li key={pack.id} className="flex items-center gap-3 py-2.5">
                  <Package className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{pack.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {pack.itemCount} items · {pack.licence} ·{' '}
                      {pack.source === 'builtin' ? 'Ships with the app' : 'Imported'}
                    </span>
                  </span>
                  {pack.source !== 'builtin' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${pack.name}`}
                      onClick={() => {
                        onRemove(pack.id, pack.name)
                      }}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
