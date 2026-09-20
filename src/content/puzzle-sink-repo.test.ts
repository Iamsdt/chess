import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { puzzlesRepo } from '@/data'
import { makePuzzle, toTimestamp } from '@/domain'

import { createRepositoryPuzzleSink } from './puzzle-sink-repo'

/**
 * Proves the S10 → S05 seam actually stores something. Both sides were built in parallel
 * against their own half of the contract, so the only thing that can show they meet is a
 * test that writes through the sink and reads back through the repository.
 */
describe('repository puzzle sink', () => {
  const sink = createRepositoryPuzzleSink()

  beforeEach(async () => {
    await puzzlesRepo.clear()
  })

  it('writes puzzles the repository can then select', async () => {
    const puzzle = makePuzzle()
    const written = await sink.putPuzzles([puzzle])

    expect(written.ok && written.value.written).toBe(1)
    expect(await puzzlesRepo.get(puzzle.id)).toMatchObject({ id: puzzle.id, fen: puzzle.fen })
  })

  it('is idempotent: re-importing updates rather than duplicating', async () => {
    const puzzle = makePuzzle()
    await sink.putPuzzles([puzzle])
    await sink.putPuzzles([puzzle])

    expect(await puzzlesRepo.count()).toBe(1)
  })

  it('round-trips the resume cursor', async () => {
    const before = await sink.readImportState()
    expect(before.ok && before.value).toBeNull()

    await sink.writeImportState({
      stateVersion: 1,
      manifestVersion: 3,
      bands: [],
      updatedAt: toTimestamp(1_700_000_000_000),
    })

    const after = await sink.readImportState()
    expect(after.ok && after.value?.manifestVersion).toBe(3)
  })

  it('reports stats the importer can show', async () => {
    await sink.putPuzzles([makePuzzle()])
    const stats = await sink.stats()

    expect(stats.ok && stats.value.total).toBe(1)
    expect(stats.ok && Object.values(stats.value.byTheme).reduce((a, b) => a + b, 0)).toBe(1)
  })
})
