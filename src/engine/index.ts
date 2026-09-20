/**
 * S07 · Stockfish, off the main thread.
 *
 * ```ts
 * import { engine } from '@/engine'
 *
 * const move = await engine.bestMove(fen, { movetimeMs: 800, elo: 1500 })
 * for await (const lines of engine.analyse(fen, { multiPv: 3, signal })) render(lines)
 * const evaluation = await engine.evaluate(fen, { depth: 18 })   // lane: batch
 * ```
 *
 * Everything returns a `Result`; nothing throws across this boundary. Searches
 * carry a lane (`play` > `interactive` > `batch`) and an optional `AbortSignal`,
 * and the pool guarantees that a background job never keeps a live move waiting.
 *
 * Tests that need an engine without a worker import
 * `@/engine/testing/fake-engine` and pass its factory to `createEngine`.
 *
 * The vendored builds live in `public/engine/` and are **GPLv3** (see
 * `public/engine/Copying.txt`): the licence has to ship with the app and be
 * credited in About.
 */
export {
  ENGINE_BUILD_IDS,
  type EngineBuildId,
  type EngineCapabilities,
  type EngineEnvironment,
  type EngineResourcePlan,
  MAX_ENGINE_WORKERS,
  MAX_HASH_MB,
  MAX_SEARCH_THREADS,
  MIN_HASH_MB,
  detectEngineEnvironment,
  engineScriptUrl,
  engineWasmUrl,
  planEngineResources,
} from './capabilities'
export { ENGINE_CACHE_NAME, engineAssetUrls, primeEngineAssets } from './assets'
export { UciDriver, type UciDriverOptions, type UciTransport } from './driver'
export {
  type AnalyseOptions,
  type BestMoveOptions,
  type Engine,
  type EngineBestMove,
  type EvaluateOptions,
  createEngine,
  engine,
} from './engine'
export {
  formatGoCommand,
  formatSetOption,
  pickLineForPersonality,
  scoreToMoverCentipawns,
  searchOptions,
  strengthOptions,
  type UciOptionSetting,
} from './options'
export { EnginePool, type EnginePoolOptions, type PoolSubmission } from './pool'
export {
  type EngineInitConfig,
  EngineInitConfigSchema,
  type EngineStrength,
  EngineStrengthSchema,
  MAX_UCI_ELO,
  MIN_STRENGTH_ELO,
  MIN_UCI_ELO,
  type SearchRequest,
  SearchRequestSchema,
  type SearchResult,
  SearchResultSchema,
  type SearchUpdate,
  SearchUpdateSchema,
  hasSearchLimit,
} from './protocol'
export {
  type EngineLaneTelemetry,
  type EngineSearchCounters,
  type EngineTelemetry,
  type EngineTelemetryListener,
  type EngineWorkerState,
  type EngineWorkerTelemetry,
} from './telemetry'
export { parseUciLine, type UciInfo, type UciMessage, type UciOption } from './uci'
/** Implementations stay out of the barrel so the worker chunk stays lazy. */
export type { EngineClient, EngineClientFactory } from './worker-client'
