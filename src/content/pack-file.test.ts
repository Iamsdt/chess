import { describe, expect, it } from 'vitest'

import { CONTENT_PACK_FORMAT_VERSION, toLessonId, toPackId, toTimestamp } from '@/domain'

import { formatPackReport, loadContentPack, parseContentPackText } from './pack-file'
import { importContentPackFromFile, importContentPackFromUrl } from './pack-loader'
import { createContentPackRegistry } from './pack-registry'

/**
 * The pack format, from the import dialog's point of view: what it accepts, and
 * whether what it says about a rejection is any use to the person who wrote the
 * file.
 */

const now = () => toTimestamp(1_700_000_000_000)

const lesson = (id: string) => ({
  id,
  packId: 'pack-1',
  title: 'Forks',
  summary: 'The knight hits two things at once.',
  difficulty: 'beginner',
  estimatedMinutes: 4,
  themes: ['fork'],
  prerequisites: [],
  steps: [
    {
      id: `${id}-0`,
      index: 0,
      kind: 'info',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      orientation: 'white',
      prompt: 'Look at the knight.',
    },
  ],
  version: 1,
})

const packFile = (overrides: Record<string, unknown> = {}) => ({
  id: 'pack-1',
  formatVersion: CONTENT_PACK_FORMAT_VERSION,
  version: '1.0',
  name: 'Forks',
  kind: 'lessons',
  licence: 'CC BY-SA 4.0',
  itemCount: 1,
  lessons: [lesson('lesson-1')],
  puzzles: [],
  ...overrides,
})

const options = { where: 'forks.json', source: 'imported' as const, now }

describe('loading a pack file', () => {
  it('accepts a well-formed pack and stamps how it arrived', () => {
    const result = loadContentPack(packFile(), options)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.source).toBe('imported')
    expect(result.value.importedAt).toBe(1_700_000_000_000)
    expect(result.value.updatedAt).toBe(1_700_000_000_000)
  })

  it('keeps the original install date when a pack is updated', () => {
    const result = loadContentPack(packFile({ version: '1.1' }), {
      ...options,
      importedAt: toTimestamp(1_600_000_000_000),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.importedAt).toBe(1_600_000_000_000)
    expect(result.value.updatedAt).toBe(1_700_000_000_000)
  })

  it('stamps the pack id onto the pack’s own puzzles', () => {
    const puzzle = {
      id: 'p1',
      fen: 'rn2k2r/pQ2nppp/2p5/8/4p1bN/P5P1/P1qP1PBP/R1B1K2R b KQkq - 2 11',
      solution: ['c2d1'],
      band: 'pawn',
      subLevel: 1,
      difficulty: 'beginner',
      title: 'Mate',
      theme: 'mateIn1',
      prompt: 'Black to move.',
      rating: 800,
      ratingLabel: 'Novice',
      explanation: 'Mate in one.',
      source: 'pack',
    }
    const result = loadContentPack(packFile({ itemCount: 2, puzzles: [puzzle] }), options)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.puzzles[0]?.packId).toBe('pack-1')
  })

  it('refuses a pack written for a newer format, and says so in words', () => {
    const result = loadContentPack(packFile({ formatVersion: 99 }), options)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(formatPackReport(result.error)).toContain('needs a newer version of Chess King')
  })

  it('refuses a pack whose item count lies', () => {
    const result = loadContentPack(packFile({ itemCount: 7 }), options)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.problems[0]?.path).toBe('itemCount')
  })

  it('refuses duplicate lesson ids inside one pack', () => {
    const result = loadContentPack(
      packFile({ itemCount: 2, lessons: [lesson('same'), lesson('same')] }),
      options,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.problems[0]?.message).toContain('Duplicate lesson id')
  })

  it('refuses steps that are numbered out of order', () => {
    const broken = lesson('lesson-1')
    const result = loadContentPack(
      packFile({ lessons: [{ ...broken, steps: [{ ...broken.steps[0], index: 5 }] }] }),
      options,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.problems[0]?.path).toBe('lessons[0].steps[0].index')
  })

  it('names the offending field when the schema rejects the file', () => {
    const result = loadContentPack(packFile({ licence: '' }), options)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.problems.map((problem) => problem.path)).toContain('licence')
  })

  it('reports invalid JSON as a problem rather than throwing', () => {
    const result = parseContentPackText('{ not json', options)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.problems[0]?.message).toContain('Not valid JSON')
  })
})

describe('importing a pack', () => {
  it('reads a dropped file', async () => {
    const result = await importContentPackFromFile(
      { name: 'forks.json', text: () => Promise.resolve(JSON.stringify(packFile())) },
      { now },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.name).toBe('Forks')
  })

  it('reports a file it cannot read', async () => {
    const result = await importContentPackFromFile({
      name: 'forks.json',
      text: () => Promise.reject(new Error('permission denied')),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.problems[0]?.message).toContain('permission denied')
  })

  it('reads a pack from a URL', async () => {
    const fetchImpl = (): Promise<Response> =>
      Promise.resolve(new Response(JSON.stringify(packFile()), { status: 200 }))
    const result = await importContentPackFromUrl('https://example.test/forks.json', {
      now,
      fetchImpl,
    })
    expect(result.ok).toBe(true)
  })

  it('reports an HTTP failure with the status', async () => {
    const fetchImpl = (): Promise<Response> => Promise.resolve(new Response('', { status: 404 }))
    const result = await importContentPackFromUrl('https://example.test/forks.json', { fetchImpl })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.problems[0]?.message).toContain('404')
  })
})

describe('the pack registry', () => {
  const pack = (id: string, lessonId: string) => {
    const loaded = loadContentPack(
      packFile({ id, lessons: [{ ...lesson(lessonId), packId: id }] }),
      { ...options, where: `${id}.json` },
    )
    if (!loaded.ok) throw new Error(formatPackReport(loaded.error))
    return loaded.value
  }

  it('lists what has been registered and finds a lesson across packs', () => {
    const registry = createContentPackRegistry([pack('pack-1', 'a'), pack('pack-2', 'b')])
    expect(registry.list()).toHaveLength(2)
    expect(registry.lessons()).toHaveLength(2)
    expect(registry.lesson(toLessonId('b'))?.packId).toBe('pack-2')
    expect(registry.lesson(toLessonId('missing'))).toBeNull()
  })

  it('replaces a pack with the same id, which is how an update lands', () => {
    const registry = createContentPackRegistry([pack('pack-1', 'a')])
    const updated = registry.register(pack('pack-1', 'a'))
    expect(updated.ok).toBe(true)
    expect(registry.list()).toHaveLength(1)
  })

  it('refuses two packs that claim the same lesson', () => {
    const registry = createContentPackRegistry([pack('pack-1', 'shared')])
    const clash = registry.register(pack('pack-2', 'shared'))
    expect(clash.ok).toBe(false)
    if (clash.ok) return
    expect(clash.error.code).toBe('conflict')
  })

  it('forgets a pack on request', () => {
    const registry = createContentPackRegistry([pack('pack-1', 'a')])
    expect(registry.unregister(toPackId('pack-1'))).toBe(true)
    expect(registry.get(toPackId('pack-1'))).toBeNull()
    expect(registry.lessons()).toEqual([])
  })
})
