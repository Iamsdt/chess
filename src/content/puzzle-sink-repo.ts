import { defineKvKey, kvRepo, puzzlesRepo } from '@/data'
import { err, ok, type Result } from '@/domain'

import {
  PuzzleImportStateSchema,
  type PuzzleImportState,
  type PuzzleSink,
  type PuzzleStoreStats,
  type PuzzleWriteSummary,
} from './puzzle-sink'

/**
 * The integration seam between S10's importer and S05's storage.
 *
 * Both sprints were built in parallel and neither could import the other, so each defined
 * its own half: `PuzzleSink` says what the importer needs, `puzzlesRepo` says what the
 * database offers. This adapter is the only place the two names meet.
 */

/** Where the resume cursor lives. Device-local progress, so it is backup-safe but dull. */
const importStateKey = defineKvKey('puzzle-import-state', PuzzleImportStateSchema)

/** Groups puzzle themes for the sink's open-ended `byTheme` count. */
async function themeCounts(): Promise<Record<string, number>> {
  const themes = await puzzlesRepo.listThemes()
  return Object.fromEntries(themes.map(({ theme, count }) => [theme, count]))
}

export function createRepositoryPuzzleSink(): PuzzleSink {
  return {
    async putPuzzles(puzzles): Promise<Result<PuzzleWriteSummary>> {
      const written = await puzzlesRepo.bulkUpsert(puzzles)
      if (!written.ok) return err(written.error)
      // The sink counts rows handed over; the repository splits them into new and updated.
      return ok({ written: written.value.inserted + written.value.updated })
    },

    async readImportState(): Promise<Result<PuzzleImportState | null>> {
      const state = await kvRepo.get(importStateKey)
      return ok(state ?? null)
    },

    async writeImportState(state): Promise<Result<void>> {
      const saved = await kvRepo.set(importStateKey, state)
      return saved.ok ? ok(undefined) : err(saved.error)
    },

    async stats(): Promise<Result<PuzzleStoreStats>> {
      const [counts, byTheme] = await Promise.all([puzzlesRepo.stats(), themeCounts()])
      return ok({
        total: counts.total,
        byBand: counts.byBand,
        byDifficulty: counts.byDifficulty,
        byTheme,
      })
    },
  }
}
