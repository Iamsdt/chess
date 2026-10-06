import type { LessonProgress } from '@/data'
import type { Difficulty, Lesson } from '@/domain'

/**
 * S16 · The course map as plain values: tracks, their lessons, and how far along each is.
 *
 * Pure, so the screen only lays out what this returns. Lessons come from whatever packs
 * are installed and progress from what the player has done; nothing is assumed about
 * either, so an imported pack shows up in the map the moment it is installed.
 */

export type LessonStatus = 'new' | 'in-progress' | 'completed'

export interface LessonRow {
  readonly lesson: Lesson
  readonly status: LessonStatus
  /** Steps reached out of all steps, for the progress bar on an unfinished lesson. */
  readonly stepsDone: number
  readonly completedAt: number | null
}

export interface TrackSummary {
  readonly id: string
  readonly title: string
  readonly lessons: readonly LessonRow[]
  readonly completed: number
  readonly percent: number
  readonly minutesLeft: number
}

export interface Course {
  readonly tracks: readonly TrackSummary[]
  /** Where "Continue" goes: the lesson most recently started and not finished, else the next new one. */
  readonly next: LessonRow | undefined
  readonly totalLessons: number
  readonly totalCompleted: number
}

const TRACK_TITLES: Readonly<Record<string, string>> = {
  tactics: 'Tactics',
  'semi-open': 'Semi-open games',
  open: 'Open games',
  closed: 'Closed games',
  symmetrical: 'Symmetrical openings',
  endgames: 'Endgames',
  strategy: 'Strategy',
}

const DIFFICULTY_ORDER: Readonly<Record<Difficulty, number>> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
}

/** `semi-open` → `Semi-open games`; an unknown track id from an imported pack still reads well. */
export function trackTitle(id: string): string {
  const known = TRACK_TITLES[id]
  if (known !== undefined) return known
  const spaced = id.replace(/[-_]+/g, ' ').trim()
  return spaced === '' ? 'Lessons' : spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Easier first, then the pack's own order, so a course reads as a course. */
function byDifficulty(a: Lesson, b: Lesson, order: ReadonlyMap<string, number>): number {
  return (
    DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] ||
    (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  )
}

function rowFor(lesson: Lesson, progress: LessonProgress | undefined): LessonRow {
  if (progress === undefined) return { lesson, status: 'new', stepsDone: 0, completedAt: null }
  const total = lesson.steps.length
  if (progress.status === 'completed') {
    return { lesson, status: 'completed', stepsDone: total, completedAt: progress.completedAt }
  }
  return {
    lesson,
    status: progress.status === 'in-progress' ? 'in-progress' : 'new',
    stepsDone: Math.min(progress.currentStepIndex, total),
    completedAt: null,
  }
}

export function buildCourse(
  lessons: readonly Lesson[],
  progress: readonly LessonProgress[],
): Course {
  const byId = new Map(progress.map((entry) => [entry.lessonId, entry]))
  const order = new Map(lessons.map((lesson, index) => [lesson.id, index]))

  const groups = new Map<string, Lesson[]>()
  for (const lesson of lessons) {
    const key = lesson.trackId ?? 'lessons'
    groups.set(key, [...(groups.get(key) ?? []), lesson])
  }

  const tracks: TrackSummary[] = [...groups.entries()]
    .map(([id, group]) => {
      const rows = [...group]
        .sort((a, b) => byDifficulty(a, b, order))
        .map((lesson) => rowFor(lesson, byId.get(lesson.id)))
      const completed = rows.filter((row) => row.status === 'completed').length
      return {
        id,
        title: trackTitle(id),
        lessons: rows,
        completed,
        percent: rows.length === 0 ? 0 : Math.round((completed / rows.length) * 100),
        minutesLeft: rows
          .filter((row) => row.status !== 'completed')
          .reduce((sum, row) => sum + row.lesson.estimatedMinutes, 0),
      }
    })
    .sort((a, b) => b.lessons.length - a.lessons.length || a.title.localeCompare(b.title))

  const rows = tracks.flatMap((track) => track.lessons)
  const inProgress = rows
    .filter((row) => row.status === 'in-progress')
    .sort(
      (a, b) => (byId.get(b.lesson.id)?.updatedAt ?? 0) - (byId.get(a.lesson.id)?.updatedAt ?? 0),
    )[0]
  const firstNew = tracks
    .map((track) => track.lessons.find((row) => row.status === 'new'))
    .find((row) => row !== undefined)

  return {
    tracks,
    next: inProgress ?? firstNew,
    totalLessons: rows.length,
    totalCompleted: rows.filter((row) => row.status === 'completed').length,
  }
}
