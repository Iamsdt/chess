import 'fake-indexeddb/auto'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TUTORIAL_PACK_ID } from '@/content'
import { clearAllData, lessonsProgressRepo, packsRepo } from '@/data'

import { playableLesson } from './learn-fixtures'
import { ensureBuiltinLessons, saveLessonProgress } from './lesson-store'

/** Serves `public/` from disk, so the real tutorials are converted without a server. */
function serveShippedTutorials() {
  const fetchMock = vi.fn(async (url: string) => {
    try {
      const text = await readFile(join(process.cwd(), 'public', url.replace(/^\//, '')), 'utf8')
      return new Response(text, { status: 200 })
    } catch {
      return new Response('missing', { status: 404 })
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('ensureBuiltinLessons', () => {
  beforeEach(async () => {
    await clearAllData()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('installs the shipped tutorials as the builtin pack, once', async () => {
    const fetchMock = serveShippedTutorials()
    const first = await ensureBuiltinLessons()
    expect(first.ok).toBe(true)

    const pack = await packsRepo.get(TUTORIAL_PACK_ID)
    expect(pack?.source).toBe('builtin')
    // 19 of the 48 shipped tutorials are known not to replay and are left out, not fatal.
    expect(pack?.lessons.length).toBeGreaterThan(20)
    expect(pack?.itemCount).toBe(pack?.lessons.length)

    const calls = fetchMock.mock.calls.length
    const second = await ensureBuiltinLessons()
    expect(second).toEqual({ ok: true, value: { skipped: 0 } })
    expect(fetchMock.mock.calls.length).toBe(calls)
  }, 60_000)

  it('reports a readable error, and tries again next time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('no', { status: 500 }))),
    )
    const failed = await ensureBuiltinLessons()
    expect(failed.ok).toBe(false)
    expect(await packsRepo.count()).toBe(0)

    serveShippedTutorials()
    expect((await ensureBuiltinLessons()).ok).toBe(true)
  }, 60_000)
})

describe('saveLessonProgress', () => {
  const lesson = playableLesson('l1', 'One', 'tactics')
  const save = (overrides: Partial<Parameters<typeof saveLessonProgress>[0]> = {}) =>
    saveLessonProgress({
      lesson,
      stepIndex: 1,
      completedStepIds: [lesson.steps[0]?.id ?? ''],
      hintsUsed: 1,
      wrongMoves: 0,
      sinceLastSaveMs: 30_000,
      completed: false,
      ...overrides,
    })

  beforeEach(async () => {
    await clearAllData()
  })

  it('starts a lesson and adds to it on every save', async () => {
    await save()
    await save({ stepIndex: 2, hintsUsed: 2, wrongMoves: 3, sinceLastSaveMs: 45_000 })
    expect(await lessonsProgressRepo.get(lesson.id)).toMatchObject({
      status: 'in-progress',
      currentStepIndex: 2,
      hintsUsed: 3,
      wrongMoves: 3,
      timeSpentMs: 75_000,
    })
  })

  it('does not count an hour away from the keyboard as an hour of study', async () => {
    await save({ sinceLastSaveMs: 3_600_000 })
    expect((await lessonsProgressRepo.get(lesson.id))?.timeSpentMs).toBe(300_000)
  })

  it('completes once and stays complete when the lesson is replayed', async () => {
    await save({ completed: true, stepIndex: 2 })
    const done = await lessonsProgressRepo.get(lesson.id)
    expect(done).toMatchObject({ status: 'completed', currentStepIndex: 2 })

    await save({ stepIndex: 0, completed: false })
    expect(await lessonsProgressRepo.get(lesson.id)).toMatchObject({
      status: 'completed',
      currentStepIndex: 2,
      completedAt: done?.completedAt,
    })
  })

  it('never records the same step twice', async () => {
    await save()
    await save()
    expect((await lessonsProgressRepo.get(lesson.id))?.completedStepIds).toHaveLength(1)
  })
})
