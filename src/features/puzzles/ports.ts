import { createRepositoryPuzzleSink, importPuzzleBands } from '@/content'
import type { ImportProgress, PuzzleImportReport } from '@/content'
import type { Result } from '@/domain'

/**
 * The seams this feature reaches the rest of the app through.
 *
 * There is one, and it exists because the puzzle screens are useless until the 10,000
 * Lichess puzzles are in IndexedDB, and nothing else in the app currently brings them in:
 * S10 wrote the importer and the repository sink, S11's queue — which is where a long
 * import belongs — is still a stub that throws. So the hub offers the import itself,
 * behind this port, and a test hands it a fake instead of downloading 3.6 MB of CSV.
 *
 * When S11 lands, `createContentImportPort` becomes a one-line `jobs.enqueue`
 * ('import-puzzles' is already in `JOB_TYPES`) and nothing above this file changes.
 */
export interface PuzzleImportPort {
  run: (options: {
    readonly onProgress?: ((progress: ImportProgress) => void) | undefined
    readonly signal?: AbortSignal | undefined
  }) => Promise<Result<PuzzleImportReport>>
}

/** The real thing: S10's importer, writing through S05's repositories. */
export function createContentImportPort(): PuzzleImportPort {
  return {
    run: ({ onProgress, signal }) =>
      importPuzzleBands({ sink: createRepositoryPuzzleSink(), onProgress, signal }),
  }
}
