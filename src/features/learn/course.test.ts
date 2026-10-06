import { describe, expect, it } from 'vitest'

import type { LessonProgress } from '@/data'
import {
  FIXTURE_NOW,
  makeLesson,
  toLessonId,
  toPackId,
  toTimestamp,
  toTrackId,
  type Lesson,
} from '@/domain'

import { buildCourse, trackTitle } from './course'

function lesson(
  id: string,
  trackId: string,
  difficulty: Lesson['difficulty'] = 'beginner',
): Lesson {
  return makeLesson({
    id: toLessonId(id),
    trackId: toTrackId(trackId),
    difficulty,
    estimatedMinutes: 4,
  })
}

function progress(
  id: string,
  status: LessonProgress['status'],
  extra: Partial<LessonProgress> = {},
): LessonProgress {
  return {
    lessonId: toLessonId(id),
    packId: toPackId('pack'),
    status,
    lessonVersion: 1,
    currentStepIndex: 0,
    completedStepIds: [],
    hintsUsed: 0,
    wrongMoves: 0,
    timeSpentMs: 0,
    startedAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    completedAt: status === 'completed' ? FIXTURE_NOW : null,
    ...extra,
  }
}

describe('trackTitle', () => {
  it('names the shipped tracks and makes anything else readable', () => {
    expect(trackTitle('semi-open')).toBe('Semi-open games')
    expect(trackTitle('tactics')).toBe('Tactics')
    expect(trackTitle('endgame_basics')).toBe('Endgame basics')
  })
})

describe('buildCourse', () => {
  const lessons = [
    lesson('a', 'tactics', 'intermediate'),
    lesson('b', 'tactics', 'beginner'),
    lesson('c', 'open'),
    lesson('d', 'tactics'),
  ]

  it('is empty for no lessons', () => {
    expect(buildCourse([], [])).toMatchObject({ tracks: [], next: undefined, totalLessons: 0 })
  })

  it('groups by track, biggest first, easier lessons before harder ones', () => {
    const course = buildCourse(lessons, [])
    expect(course.tracks.map((t) => t.id)).toEqual(['tactics', 'open'])
    expect(course.tracks[0]?.lessons.map((r) => r.lesson.id)).toEqual(['b', 'd', 'a'])
  })

  it('reads status, steps reached and percent from progress', () => {
    const course = buildCourse(lessons, [
      progress('b', 'completed'),
      progress('d', 'in-progress', { currentStepIndex: 1 }),
    ])
    const tactics = course.tracks[0]
    expect(tactics).toMatchObject({ completed: 1, percent: 33, minutesLeft: 8 })
    expect(tactics?.lessons.map((r) => r.status)).toEqual(['completed', 'in-progress', 'new'])
    expect(tactics?.lessons[1]?.stepsDone).toBe(1)
    expect(course).toMatchObject({ totalLessons: 4, totalCompleted: 1 })
  })

  it('continues the most recently touched unfinished lesson', () => {
    const course = buildCourse(lessons, [
      progress('b', 'in-progress', { updatedAt: toTimestamp(FIXTURE_NOW + 10) }),
      progress('d', 'in-progress', { updatedAt: toTimestamp(FIXTURE_NOW + 99) }),
    ])
    expect(course.next?.lesson.id).toBe('d')
  })

  it('otherwise offers the first lesson nobody has started, and nothing when all are done', () => {
    expect(buildCourse(lessons, [progress('b', 'completed')]).next?.lesson.id).toBe('d')
    const done = lessons.map((l) => progress(l.id, 'completed'))
    expect(buildCourse(lessons, done).next).toBeUndefined()
  })

  it('puts a lesson with no track in a track of its own instead of dropping it', () => {
    const loose = makeLesson({ id: toLessonId('x'), trackId: undefined })
    expect(buildCourse([loose], []).tracks[0]?.title).toBe('Lessons')
  })
})
