import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import {
  FIXTURE_NOW,
  makeLesson,
  makeRepertoireNode,
  positionKeyFromFen,
  toLessonId,
  toPackId,
  toRepertoireNodeId,
  toTimestamp,
  type ContentPack,
} from '@/domain'

import { createDb, type ChessKingDb } from '../db'

import { createLessonsProgressRepository } from './lessons-progress'
import { createPacksRepository } from './packs'
import { createRepertoireRepository } from './repertoire'

import type { LessonProgress } from '../schema'

let counter = 0
let db: ChessKingDb | undefined

afterEach(() => {
  db?.close()
  db = undefined
})

function setup(): {
  packs: ReturnType<typeof createPacksRepository>
  progress: ReturnType<typeof createLessonsProgressRepository>
  repertoire: ReturnType<typeof createRepertoireRepository>
} {
  counter += 1
  db = createDb(`content-test-${String(counter)}`)
  return {
    packs: createPacksRepository(db),
    progress: createLessonsProgressRepository(db),
    repertoire: createRepertoireRepository(db),
  }
}

const pack = (
  id: string,
  lessonIds: string[],
  overrides: Partial<ContentPack> = {},
): ContentPack => ({
  id: toPackId(id),
  formatVersion: 1,
  version: '1.0',
  name: `Pack ${id}`,
  kind: 'lessons',
  source: 'builtin',
  licence: 'CC0-1.0',
  itemCount: lessonIds.length,
  lessons: lessonIds.map((lessonId) =>
    makeLesson({ id: toLessonId(lessonId), packId: toPackId(id) }),
  ),
  puzzles: [],
  importedAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  ...overrides,
})

describe('packs repository', () => {
  it('installs a pack and finds a lesson inside it', async () => {
    const { packs } = setup()
    const installed = await packs.install(pack('p1', ['l1', 'l2']))
    expect(installed.ok).toBe(true)

    expect(await packs.count()).toBe(1)
    expect((await packs.listLessons()).map((lesson) => lesson.id)).toEqual(['l1', 'l2'])
    expect((await packs.findLesson(toLessonId('l2')))?.packId).toBe('p1')
    expect(await packs.findLesson(toLessonId('absent'))).toBeUndefined()
  })

  it('replaces a pack on reinstall rather than adding a second copy', async () => {
    const { packs } = setup()
    await packs.install(pack('p1', ['l1', 'l2']))
    await packs.install(pack('p1', ['l1'], { version: '2.0' }))

    expect(await packs.count()).toBe(1)
    expect((await packs.get(toPackId('p1')))?.version).toBe('2.0')
    expect((await packs.listLessons()).map((lesson) => lesson.id)).toEqual(['l1'])
  })

  it('filters by kind and by source', async () => {
    const { packs } = setup()
    await packs.install(pack('p1', ['l1']))
    await packs.install(pack('p2', [], { kind: 'openings', source: 'community' }))

    expect((await packs.list('lessons')).map((row) => row.id)).toEqual(['p1'])
    expect((await packs.listBySource('community')).map((row) => row.id)).toEqual(['p2'])
  })

  it('refuses a pack whose format does not validate', async () => {
    const { packs } = setup()
    const result = await packs.install({ ...pack('p1', ['l1']), licence: '' })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.code).toBe('validation')
    expect(await packs.count()).toBe(0)
  })
})

describe('lessons progress repository', () => {
  const progressFor = (
    lessonId: string,
    overrides: Partial<LessonProgress> = {},
  ): LessonProgress => ({
    lessonId: toLessonId(lessonId),
    packId: toPackId('p1'),
    status: 'in-progress',
    lessonVersion: 1,
    currentStepIndex: 0,
    completedStepIds: [],
    hintsUsed: 0,
    wrongMoves: 0,
    timeSpentMs: 0,
    startedAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    completedAt: null,
    ...overrides,
  })

  it('keeps one row per lesson', async () => {
    const { progress } = setup()
    await progress.put(progressFor('l1'))
    await progress.put(progressFor('l1', { currentStepIndex: 3 }))

    expect((await progress.list()).length).toBe(1)
    expect((await progress.get(toLessonId('l1')))?.currentStepIndex).toBe(3)
  })

  it('counts completed lessons per pack', async () => {
    const { progress } = setup()
    await progress.put(progressFor('l1', { status: 'completed', completedAt: FIXTURE_NOW }))
    await progress.put(progressFor('l2'))
    await progress.put(progressFor('l3', { packId: toPackId('p2'), status: 'completed' }))

    expect(await progress.countCompleted()).toBe(2)
    expect(await progress.countCompleted(toPackId('p1'))).toBe(1)
    expect(
      (await progress.listByStatus('completed', toPackId('p1'))).map((row) => row.lessonId),
    ).toEqual(['l1'])
  })

  it('finds the lesson to resume', async () => {
    const { progress } = setup()
    await progress.put(progressFor('l1', { updatedAt: toTimestamp(FIXTURE_NOW - 1000) }))
    await progress.put(progressFor('l2', { updatedAt: FIXTURE_NOW }))
    expect((await progress.mostRecent())?.lessonId).toBe('l2')
  })

  it('refuses a patch for a lesson that was never started', async () => {
    const { progress } = setup()
    const result = await progress.update(toLessonId('nope'), { currentStepIndex: 1 })
    expect(!result.ok && result.error.code).toBe('not-found')
  })
})

describe('repertoire repository', () => {
  it('finds roots by colour and children by link', async () => {
    const { repertoire } = setup()
    const rootId = toRepertoireNodeId('r1')
    const childId = toRepertoireNodeId('r1c')
    await repertoire.putMany([
      makeRepertoireNode({
        id: rootId,
        parentId: null,
        ply: 0,
        color: 'white',
        childIds: [childId],
      }),
      makeRepertoireNode({ id: childId, parentId: rootId, ply: 1, color: 'white', childIds: [] }),
      makeRepertoireNode({
        id: toRepertoireNodeId('b1'),
        parentId: null,
        ply: 0,
        color: 'black',
        childIds: [],
      }),
    ])

    expect((await repertoire.listRoots('white')).map((node) => node.id)).toEqual(['r1'])
    expect((await repertoire.listRoots('black')).map((node) => node.id)).toEqual(['b1'])
    expect((await repertoire.listChildren(rootId)).map((node) => node.id)).toEqual(['r1c'])
    expect(await repertoire.count('white')).toBe(2)
  })

  it('collides transpositions on the position key', async () => {
    const { repertoire } = setup()
    const shared = makeRepertoireNode({ id: toRepertoireNodeId('a') })
    await repertoire.putMany([
      shared,
      { ...shared, id: toRepertoireNodeId('b'), ply: 4 },
      { ...shared, id: toRepertoireNodeId('c'), positionKey: 'something else' },
    ])

    const found = await repertoire.findByPosition(shared.color, shared.fen)
    expect(found.map((node) => node.id).sort()).toEqual(['a', 'b'])
    expect(shared.positionKey).toBe(positionKeyFromFen(shared.fen))
  })

  it('deletes a subtree and unlinks it from its parent', async () => {
    const { repertoire } = setup()
    const rootId = toRepertoireNodeId('r')
    const childId = toRepertoireNodeId('c')
    const grandchildId = toRepertoireNodeId('g')
    await repertoire.putMany([
      makeRepertoireNode({ id: rootId, parentId: null, ply: 0, childIds: [childId] }),
      makeRepertoireNode({ id: childId, parentId: rootId, ply: 1, childIds: [grandchildId] }),
      makeRepertoireNode({ id: grandchildId, parentId: childId, ply: 2, childIds: [] }),
    ])

    const removed = await repertoire.removeSubtree(childId)
    expect(removed.ok && removed.value).toBe(2)
    expect(await repertoire.get(grandchildId)).toBeUndefined()
    expect((await repertoire.get(rootId))?.childIds).toEqual([])
  })

  it('refuses a node whose ply is not a whole number', async () => {
    const { repertoire } = setup()
    const result = await repertoire.put({ ...makeRepertoireNode(), ply: 1.5 })
    expect(result.ok).toBe(false)
    expect(await repertoire.count()).toBe(0)
  })
})
