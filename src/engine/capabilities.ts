import { type EngineInfo } from '@/domain'

/**
 * Which Stockfish build can run here, and how much of the machine it may take.
 *
 * Why this is a pure planner with a separate one-line detector: "how many threads
 * do we give the engine" is a decision with a lot of clamps in it, and clamps are
 * exactly what regress silently. `planEngineResources` takes a plain description
 * of the machine so every branch is a unit test, and `detectEngineEnvironment`
 * does nothing but read the globals.
 */

export const ENGINE_BUILD_IDS = ['mt', 'st'] as const
export type EngineBuildId = (typeof ENGINE_BUILD_IDS)[number]

/** Where the vendored builds live under `public/`; see `public/engine/Copying.txt`. */
const BUILD_FILES: Readonly<Record<EngineBuildId, string>> = {
  mt: 'engine/stockfish-19-lite.js',
  st: 'engine/stockfish-19-lite-single.js',
}

/**
 * The engine takes at most this many threads for a foreground search, per the
 * sprint plan: `min(hardwareConcurrency - 1, 4)`. One core always stays for the UI.
 */
export const MAX_SEARCH_THREADS = 4
/** Never run more than three engines at once: one per lane, and no more. */
export const MAX_ENGINE_WORKERS = 3
export const MIN_HASH_MB = 16
export const MAX_HASH_MB = 128

/** What the browser told us about itself. */
export interface EngineEnvironment {
  readonly hardwareConcurrency: number
  /** `navigator.deviceMemory` in GB, or `null` where the browser does not report it. */
  readonly deviceMemoryGb: number | null
  readonly hasSharedArrayBuffer: boolean
  readonly crossOriginIsolated: boolean
}

/** The sizing decision, ready to hand to a worker. */
export interface EngineResourcePlan {
  readonly build: EngineBuildId
  /** `true` when the multi-threaded build will be loaded. */
  readonly multiThreaded: boolean
  /** Threads for the foreground worker (lanes `play` and `interactive`). */
  readonly threads: number
  /** Threads for background workers, so a review cannot starve a live move. */
  readonly batchThreads: number
  /** Transposition table per worker. */
  readonly hashMb: number
  /** How many engines may exist at once. */
  readonly maxWorkers: number
}

/** The plan plus, once an engine has actually loaded, what it says it is. */
export interface EngineCapabilities extends EngineEnvironment, EngineResourcePlan {
  /** `null` until the first worker finishes its `uci` handshake. */
  readonly engine: EngineInfo | null
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** Why guarded rather than cast: `deviceMemory` is Chromium-only and untyped. */
function readDeviceMemory(source: object): number | null {
  const value: unknown = (source as Record<string, unknown>).deviceMemory
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function readHardwareConcurrency(source: object): number {
  const value: unknown = (source as Record<string, unknown>).hardwareConcurrency
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1
}

/**
 * Read the live environment. Works on the main thread and inside a worker, since
 * both have `navigator` and `crossOriginIsolated`.
 */
export function detectEngineEnvironment(): EngineEnvironment {
  const nav: object = typeof navigator === 'undefined' ? {} : navigator
  return {
    hardwareConcurrency: readHardwareConcurrency(nav),
    deviceMemoryGb: readDeviceMemory(nav),
    hasSharedArrayBuffer: typeof SharedArrayBuffer === 'function',
    crossOriginIsolated: typeof crossOriginIsolated === 'boolean' ? crossOriginIsolated : false,
  }
}

/**
 * Decide the build and the budgets.
 *
 * The multi-threaded build needs `SharedArrayBuffer`, and a browser only hands
 * that over under cross-origin isolation (COOP + COEP, set in `vite.config.ts`).
 * Missing either one is not an error — it is the single-threaded build, which is
 * the same engine at a lower node rate.
 */
export function planEngineResources(environment: EngineEnvironment): EngineResourcePlan {
  const multiThreaded = environment.hasSharedArrayBuffer && environment.crossOriginIsolated
  const cores = Math.max(1, environment.hardwareConcurrency)

  const threads = multiThreaded ? clamp(cores - 1, 1, MAX_SEARCH_THREADS) : 1
  // Background searches get half, so three lanes at once cannot oversubscribe the
  // machine and make the foreground lane slower than it would have been alone.
  const batchThreads = multiThreaded ? Math.max(1, Math.floor(threads / 2)) : 1

  // 8 MB of hash per GB of reported memory, which leaves a 4 GB phone with 32 MB
  // per worker. Browsers that hide `deviceMemory` get the conservative floor.
  const hashMb =
    environment.deviceMemoryGb === null
      ? MIN_HASH_MB
      : clamp(Math.round(environment.deviceMemoryGb * 8), MIN_HASH_MB, MAX_HASH_MB)

  // One engine per two cores: on a dual-core machine a second engine buys nothing
  // but context switches.
  const maxWorkers = clamp(Math.floor(cores / 2), 1, MAX_ENGINE_WORKERS)

  return {
    build: multiThreaded ? 'mt' : 'st',
    multiThreaded,
    threads,
    batchThreads,
    hashMb,
    maxWorkers,
  }
}

/**
 * Absolute URL of a build's loader script.
 *
 * The loader derives its `.wasm` sibling from its own URL, and spawns its pthread
 * workers from the same file, so this one URL is all a worker needs.
 */
export function engineScriptUrl(build: EngineBuildId, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${base}${BUILD_FILES[build]}`
}

/** The `.wasm` the loader will fetch, which is what the asset cache needs to hold. */
export function engineWasmUrl(build: EngineBuildId, baseUrl: string): string {
  return engineScriptUrl(build, baseUrl).replace(/\.js$/, '.wasm')
}
