/**
 * S10 · Content: the puzzle importer, the pack format, and the registry.
 *
 * Two jobs live here. The first is getting `public/quiz/`'s 10,000 Lichess
 * puzzles out of six CSV files and into storage — parsed in a worker, validated
 * row by row against S03's `Puzzle`, written through a port so this layer never
 * meets a database. The second is the JSON pack format that lessons and
 * community content arrive in, with a loader, a registry and a readable
 * validation report.
 *
 * What is *not* here: the tables (S05 implements `PuzzleSink`), the rules (S06
 * replaces `createChessJsReplay`), the job queue (S11 can drive
 * `importPuzzleBands` chunk by chunk), and every screen that reads this data.
 *
 * Attribution is a licence obligation, not a nicety: every puzzle keeps its
 * `source` and `lichess_id`, and `docs/licences.md` records the terms.
 */

// The CSV reader. Streaming, because 3.6 MB arrives in chunks.
export { CsvStreamParser, parseBraceList, parseCsv, type CsvRow } from './csv'

// One CSV row → one `Puzzle`, or one reported skip.
export {
  checkPuzzleCsvHeader,
  formatSkippedRow,
  puzzleFromCsvRow,
  type SkippedPuzzleRow,
} from './puzzle-row'

// The content manifest (`public/quiz/index.json`).
export {
  DEFAULT_QUIZ_BASE_URL,
  QuizManifestSchema,
  bandCsvUrl,
  bandVersion,
  parseQuizManifest,
  quizManifestUrl,
  type QuizManifest,
} from './manifest'

// Parsing a band: the port, the inline implementation, and the chunk sources.
export {
  DEFAULT_BATCH_SIZE,
  createFetchChunkSource,
  createInlinePuzzleParser,
  parseBandFromSource,
  textChunkSource,
  type BandParseRequest,
  type BandParseSummary,
  type CsvChunkSource,
  type CsvChunks,
  type PuzzleBatch,
  type PuzzleBatchHandler,
  type PuzzleParser,
} from './puzzle-parser'

// Parsing a band in a dedicated worker — the app's default.
export {
  createWorkerPuzzleParser,
  defaultWorkerFactory,
  type WorkerFactory,
} from './puzzle-parser-worker'

// The storage port S05 implements, and two implementations of it.
export {
  CONTENT_META_KEY_PATH,
  CONTENT_META_STORE_NAME,
  ImportedBandStateSchema,
  PUZZLE_IMPORT_STATE_KEY,
  PUZZLE_INDEXES,
  PUZZLE_KEY_PATH,
  PUZZLE_STORE_NAME,
  PuzzleImportStateSchema,
  createInMemoryPuzzleSink,
  emptyStats,
  findBandState,
  withBandState,
  type ImportedBandState,
  type PuzzleImportState,
  type PuzzleIndexName,
  type PuzzleSink,
  type PuzzleStoreStats,
  type PuzzleWriteSummary,
} from './puzzle-sink'

export {
  createContentStores,
  createIndexedDbPuzzleSink,
  openPuzzleDatabase,
  type OpenPuzzleDatabaseOptions,
} from './puzzle-sink-idb'

// The import itself.
export {
  getPuzzleStats,
  importPuzzleBands,
  type BandImportOutcome,
  type BandImportStatus,
  type ImportProgress,
  type ImportPuzzleBandsOptions,
  type PuzzleImportReport,
  type PuzzleStats,
} from './import-puzzles'

// The JSON pack format: file schema, validation report, loader, registry.
export {
  ContentPackFileSchema,
  formatPackReport,
  loadContentPack,
  parseContentPackText,
  type ContentPackFile,
  type LoadContentPackOptions,
  type PackProblem,
  type PackValidationReport,
} from './pack-file'

export {
  importContentPackFromFile,
  importContentPackFromUrl,
  type ImportPackOptions,
  type PackFileLike,
} from './pack-loader'

export { createContentPackRegistry, type ContentPackRegistry } from './pack-registry'

// The builtin lesson pack, converted from `public/tutorial/`.
export {
  DEFAULT_TUTORIAL_BASE_URL,
  TUTORIAL_PACK_ID,
  TUTORIAL_PACK_LICENCE,
  TutorialFileSchema,
  TutorialIndexSchema,
  loadTutorialPack,
  tutorialToLesson,
  type LoadTutorialPackOptions,
  type TutorialFile,
  type TutorialPackLoad,
  type TutorialIndex,
} from './tutorial-pack'

// SAN replay: the one thing in here that needs the rules of chess.
export { createChessJsReplay, type ReplayedMove, type SanReplay } from './san-replay'

// Validation shared by the app and `npm run content:validate`.
export {
  formatContentFailures,
  validateContent,
  type BandValidation,
  type ContentValidationOptions,
  type ContentValidationReport,
  type PackValidation,
} from './validate-content'

/* The S05 integration seam: the importer writing into the real database. */
export { createRepositoryPuzzleSink } from './puzzle-sink-repo'
