import {
  domainError,
  type EngineEval,
  EngineEvalSchema,
  type EngineInfo,
  type EngineLane,
  type EngineLine,
  type EnginePersonality,
  err,
  type Fen,
  ok,
  parseValid,
  type Result,
  type Uci,
} from '@/domain'

import { type EngineCapabilities } from './capabilities'
import { pickLineForPersonality } from './options'
import { EnginePool, type EnginePoolOptions } from './pool'
import { type SearchRequest, type SearchResult, type SearchUpdate } from './protocol'
import { type EngineTelemetry, type EngineTelemetryListener } from './telemetry'

/**
 * S07 · the engine, as the rest of the app sees it.
 *
 * Five verbs, all of them lane-aware and cancellable, all of them returning
 * values rather than throwing:
 *
 * - `bestMove`  — what the opponent plays (lane `play`)
 * - `analyse`   — a live stream of lines for the analysis board (lane `interactive`)
 * - `evaluate`  — one position, one answer, for review and classification (lane `batch`)
 * - `setStrength` / `capabilities` — the dials and the honest report
 */

/** Sensible ceilings so a caller cannot ask for an all-day search by accident. */
const DEFAULT_PLAY_MOVETIME_MS = 1000
const DEFAULT_ANALYSE_DEPTH = 22
const DEFAULT_EVALUATE_DEPTH = 16
const DEFAULT_ANALYSE_MULTI_PV = 3
/** MultiPV needed before a personality has anything to choose between. */
const PERSONALITY_MULTI_PV = 3

interface SearchLimits {
  readonly depth?: number
  readonly movetimeMs?: number
  readonly nodes?: number
}

export interface BestMoveOptions extends SearchLimits {
  /** Defaults to `play`, which outranks every other lane. */
  readonly lane?: EngineLane
  readonly multiPv?: number
  /** Overrides `setStrength` for this move only. */
  readonly elo?: number | null
  /** Which near-equal line to prefer; needs MultiPV, so it raises it to 3. */
  readonly personality?: EnginePersonality
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export interface AnalyseOptions extends SearchLimits {
  /** Defaults to `interactive`; pass `batch` for background work. */
  readonly lane?: EngineLane
  readonly multiPv?: number
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export interface EvaluateOptions extends AnalyseOptions {
  readonly elo?: number | null
}

export interface EngineBestMove {
  /** `null` when the position is already over. */
  readonly move: Uci | null
  readonly ponder: Uci | null
  /** The line the move came from, so callers can show why. */
  readonly line: EngineLine | null
  readonly eval: EngineEval
}

export interface Engine {
  /** The plan, without starting an engine: safe to call on any screen. */
  plannedCapabilities(): EngineCapabilities
  /** Starts an engine if needed, so `engine` in the result is the real one. */
  capabilities(): Promise<Result<EngineCapabilities>>
  warmUp(): Promise<Result<EngineInfo>>
  bestMove(fen: Fen, options?: BestMoveOptions): Promise<Result<EngineBestMove>>
  /**
   * Stream the current lines until the search ends.
   *
   * Yields a snapshot (best line first) roughly every 80 ms, and *returns* the
   * completed evaluation — `for await` ignores that, so callers who want it take
   * the iterator by hand. Breaking out of the loop cancels the search.
   */
  analyse(
    fen: Fen,
    options?: AnalyseOptions,
  ): AsyncGenerator<readonly EngineLine[], Result<EngineEval>, void>
  evaluate(fen: Fen, options?: EvaluateOptions): Promise<Result<EngineEval>>
  /** `null` restores full strength. Applies to every later search. */
  setStrength(elo: number | null): void
  telemetry(): EngineTelemetry
  subscribeTelemetry(listener: EngineTelemetryListener): () => void
  shutdown(): Promise<void>
}

/**
 * A stream of snapshots where only the newest one matters.
 *
 * Why coalescing: a consumer that renders each snapshot can be slower than the
 * engine that produces them, and queueing stale lines would make the eval bar lag
 * further behind the longer a search ran.
 */
class UpdateStream {
  #latest: SearchUpdate | undefined
  #waiting: ((update: SearchUpdate | null) => void) | undefined
  #closed = false

  push(update: SearchUpdate): void {
    if (this.#closed) return
    const waiting = this.#waiting
    if (waiting !== undefined) {
      this.#waiting = undefined
      waiting(update)
      return
    }
    this.#latest = update
  }

  close(): void {
    this.#closed = true
    const waiting = this.#waiting
    if (waiting !== undefined) {
      this.#waiting = undefined
      waiting(null)
    }
  }

  async next(): Promise<SearchUpdate | null> {
    const latest = this.#latest
    if (latest !== undefined) {
      this.#latest = undefined
      return latest
    }
    if (this.#closed) return null
    return new Promise<SearchUpdate | null>((resolve) => {
      this.#waiting = resolve
    })
  }
}

/** `undefined` limits mean "the caller did not say"; one of them must be set. */
function limitsOrDefault(limits: SearchLimits, fallback: SearchLimits): SearchLimits {
  const given =
    limits.depth !== undefined || limits.movetimeMs !== undefined || limits.nodes !== undefined
  return given ? limits : fallback
}

function buildRequest(
  fen: Fen,
  lane: EngineLane,
  multiPv: number,
  limits: SearchLimits,
  elo: number | null,
): Omit<SearchRequest, 'id'> {
  return {
    fen,
    lane,
    multiPv,
    strength: { elo },
    showWdl: true,
    ...(limits.depth === undefined ? {} : { depth: limits.depth }),
    ...(limits.movetimeMs === undefined ? {} : { movetimeMs: limits.movetimeMs }),
    ...(limits.nodes === undefined ? {} : { nodes: limits.nodes }),
  }
}

function toEngineEval(
  fen: Fen,
  lane: EngineLane,
  result: SearchResult,
  info: EngineInfo | null,
): Result<EngineEval> {
  if (result.score === null) {
    return err(
      domainError('engine', 'The engine returned no score for this position', {
        where: 'engine.evaluate',
      }),
    )
  }
  return parseValid(
    EngineEvalSchema,
    {
      fen,
      depth: result.depth,
      score: result.score,
      bestMove: result.bestMove,
      ponder: result.ponder,
      lines: result.lines,
      lane,
      computedAt: Date.now(),
      ...(result.nodes === undefined ? {} : { nodes: result.nodes }),
      ...(result.nps === undefined ? {} : { nps: result.nps }),
      ...(result.timeMs === undefined ? {} : { timeMs: result.timeMs }),
      ...(info === null ? {} : { engine: info }),
    },
    'engine: evaluation',
  )
}

class PoolEngine implements Engine {
  readonly #pool: EnginePool
  #elo: number | null = null

  constructor(options: EnginePoolOptions) {
    this.#pool = new EnginePool(options)
  }

  plannedCapabilities(): EngineCapabilities {
    return this.#pool.capabilities()
  }

  async capabilities(): Promise<Result<EngineCapabilities>> {
    const warmed = await this.#pool.warmUp()
    if (!warmed.ok) return err(warmed.error)
    return ok(this.#pool.capabilities())
  }

  async warmUp(): Promise<Result<EngineInfo>> {
    return this.#pool.warmUp()
  }

  setStrength(elo: number | null): void {
    this.#elo = elo
  }

  async bestMove(fen: Fen, options: BestMoveOptions = {}): Promise<Result<EngineBestMove>> {
    const personality = options.personality
    const lane = options.lane ?? 'play'
    const multiPv = Math.max(
      options.multiPv ?? 1,
      personality !== undefined && personality !== 'solid' ? PERSONALITY_MULTI_PV : 1,
    )
    const limits = limitsOrDefault(options, { movetimeMs: DEFAULT_PLAY_MOVETIME_MS })
    const request = buildRequest(fen, lane, multiPv, limits, options.elo ?? this.#elo)

    const result = await this.#pool.submit({
      request,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    })
    if (!result.ok) return err(result.error)

    const evaluated = toEngineEval(fen, lane, result.value, this.#pool.capabilities().engine)
    if (!evaluated.ok) return err(evaluated.error)

    const chosen =
      personality === undefined
        ? (result.value.lines[0] ?? null)
        : (pickLineForPersonality(result.value.lines, personality) ?? null)
    const move = chosen?.pv[0] ?? result.value.bestMove

    return ok({
      move: move ?? null,
      // Pondering only makes sense on the engine's own first choice.
      ponder: chosen === null || chosen.multipv === 1 ? result.value.ponder : null,
      line: chosen,
      eval: evaluated.value,
    })
  }

  async *analyse(
    fen: Fen,
    options: AnalyseOptions = {},
  ): AsyncGenerator<readonly EngineLine[], Result<EngineEval>, void> {
    const lane = options.lane ?? 'interactive'
    const limits = limitsOrDefault(options, { depth: DEFAULT_ANALYSE_DEPTH })
    const request = buildRequest(
      fen,
      lane,
      options.multiPv ?? DEFAULT_ANALYSE_MULTI_PV,
      limits,
      null,
    )

    // A controller of our own so that abandoning the iterator — `break`, an error,
    // an unmounted screen — stops the engine just as an external abort would.
    const controller = new AbortController()
    const abortOuter = (): void => {
      controller.abort()
    }
    const outer = options.signal
    if (outer !== undefined) {
      if (outer.aborted) controller.abort()
      else outer.addEventListener('abort', abortOuter, { once: true })
    }

    const stream = new UpdateStream()
    const pending = this.#pool.submit({
      request,
      onUpdate: (update) => {
        stream.push(update)
      },
      signal: controller.signal,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    })
    void pending.then(
      () => {
        stream.close()
      },
      () => {
        stream.close()
      },
    )

    try {
      for (;;) {
        const update = await stream.next()
        if (update === null) break
        yield update.lines
      }
    } finally {
      controller.abort()
      if (outer !== undefined) outer.removeEventListener('abort', abortOuter)
    }

    const result = await pending
    if (!result.ok) return err(result.error)
    return toEngineEval(fen, lane, result.value, this.#pool.capabilities().engine)
  }

  async evaluate(fen: Fen, options: EvaluateOptions = {}): Promise<Result<EngineEval>> {
    const lane = options.lane ?? 'batch'
    const limits = limitsOrDefault(options, { depth: DEFAULT_EVALUATE_DEPTH })
    const request = buildRequest(fen, lane, options.multiPv ?? 1, limits, options.elo ?? this.#elo)

    const result = await this.#pool.submit({
      request,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    })
    if (!result.ok) return err(result.error)
    return toEngineEval(fen, lane, result.value, this.#pool.capabilities().engine)
  }

  telemetry(): EngineTelemetry {
    return this.#pool.telemetry()
  }

  subscribeTelemetry(listener: EngineTelemetryListener): () => void {
    return this.#pool.subscribeTelemetry(listener)
  }

  async shutdown(): Promise<void> {
    return this.#pool.shutdown()
  }
}

/**
 * Make an engine with its own worker pool.
 *
 * Tests and the benchmark script pass `spawn` and `environment`; the app uses the
 * shared `engine` below, because three pools would each size themselves as if they
 * had the machine to themselves.
 */
export function createEngine(options: EnginePoolOptions = {}): Engine {
  return new PoolEngine(options)
}

/** The app's engine. One pool, one set of lanes, one thread budget. */
export const engine: Engine = createEngine()
