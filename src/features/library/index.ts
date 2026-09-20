/**
 * S20 · Games library — the public surface of this slice.
 *
 * The screen is the only thing `@/app` needs; everything else is exported because the
 * pieces are useful on their own terms — the PGN port for a future "import into a
 * repertoire", the provider feeds for S22's stats, the filters for anything that wants
 * this screen's definition of "you won".
 */
export { GamesLibraryScreen } from './games-library-screen'

export {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  LIBRARY_ROW_LIMIT,
  matchesFilters,
  openingOptions,
  opponentOf,
  outcomeOf,
  sortRows,
  toGameFilter,
  yourAccuracy,
  type LibraryFilters,
  type OpeningOption,
  type Outcome,
  type SortColumn,
  type SortState,
} from './library-filters'

export {
  DEFAULT_BATCH_SIZE,
  blobPgnSource,
  createPgnChunker,
  fingerprintGame,
  gameToPgnGame,
  parsePgnStream,
  pgnGameToGame,
  serializeGames,
  textPgnSource,
  type ImportedBatch,
  type PgnParseSummary,
  type PgnStreamSource,
} from './pgn-import'

export {
  createWorkerPgnPort,
  defaultWorkerFactory,
  type PgnPort,
  type WorkerFactory,
} from './pgn-port'

export {
  MAX_REPORTED_SKIPS,
  importFromFeed,
  importPgn,
  type FeedChunk,
  type GamesSink,
  type ImportDeps,
  type ImportProgress,
  type ImportReport,
  type PgnFeed,
} from './import-service'

export {
  CHESSCOM_ORIGIN,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RETRY_MS,
  LICHESS_ORIGIN,
  chesscomFeed,
  lichessFeed,
  type ChesscomOptions,
  type FetchLike,
  type LichessOptions,
  type ProviderDeps,
} from './providers'

export {
  EXPORT_PAGE_SIZE,
  downloadFile,
  exportGame,
  exportGames,
  pgnFileName,
  type ExportDeps,
  type ExportSummary,
  type SaveFile,
} from './export-service'

export {
  analyseGames,
  analysisDedupeKey,
  createJobsPort,
  type AnalyseDeps,
  type AnalyseReport,
  type LibraryJobsPort,
} from './jobs-port'

export { useGameRows, usePgnPort, type LibraryRows, type RowsState } from './use-library'

export { FilterBar, type FilterBarProps } from './filter-bar'
export { GamesTable, type GamesTableProps } from './games-table'
export { ImportCard, type ImportCardProps } from './import-card'
export { ExportCard, type ExportCardProps } from './export-card'

export {
  PgnImportOptionsSchema,
  SkippedGameSchema,
  WorkerRequestSchema,
  WorkerResponseSchema,
  type PgnImportOptions,
  type PgnWireSource,
  type SkippedGame,
} from './worker-protocol'
