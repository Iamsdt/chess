import { type EngineInfo, type EngineLine, makeEngineLine, toUci } from '@/domain'

import {
  type EngineInitConfig,
  type SearchRequest,
  type SearchResult,
  type SearchUpdate,
} from '../protocol'
import { type EngineClient, type EngineClientFactory } from '../worker-client'

/**
 * A scripted engine, for testing everything above the UCI layer.
 *
 * The pool's interesting behaviour — lanes, preemption, cancellation, timeouts,
 * idle shutdown — is all about *when* searches start and stop, which a real
 * Stockfish makes slow and non-deterministic to observe. This fake lets a test
 * say "now the engine reaches depth 12" and "now it answers", and nothing else.
 *
 * It ships in `src/` rather than in a test file because S12, S14 and S19 need the
 * same fake to test their features without a worker.
 */

export interface FakeSearchHandle {
  readonly request: SearchRequest
  /** `true` once the pool has asked this search to stop. */
  readonly stopped: boolean
  readonly finished: boolean
  /** Push a snapshot to whoever is listening. */
  emit(update?: Partial<Omit<SearchUpdate, 'id'>>): void
  /** Settle the search, as a real engine does when it prints `bestmove`. */
  finish(result?: Partial<Omit<SearchResult, 'id'>>): void
}

export interface FakeEngineClient extends EngineClient {
  readonly config: EngineInitConfig | null
  readonly searches: readonly FakeSearchHandle[]
  readonly current: FakeSearchHandle | null
  readonly disposed: boolean
}

export interface FakeEngineOptions {
  readonly info?: Partial<EngineInfo>
  /** Ids for which `init` should reject, to exercise the failure path. */
  readonly failInit?: (id: string) => boolean
  /** When `false`, `stop()` only marks the search so a test can finish it later. */
  readonly autoFinishOnStop?: boolean
}

export interface FakeEngineFleet {
  readonly factory: EngineClientFactory
  readonly clients: readonly FakeEngineClient[]
  /** The live search for a request id, wherever it ended up running. */
  searchFor(searchId: string): FakeSearchHandle | null
}

const DEFAULT_LINE: EngineLine = makeEngineLine()

class FakeSearch implements FakeSearchHandle {
  readonly request: SearchRequest
  readonly #onUpdate: (update: SearchUpdate) => void
  readonly #settle: (result: SearchResult) => void
  #stopped = false
  #finished = false
  #lines: readonly EngineLine[] = [DEFAULT_LINE]
  #depth = DEFAULT_LINE.depth

  constructor(
    request: SearchRequest,
    onUpdate: (update: SearchUpdate) => void,
    settle: (result: SearchResult) => void,
  ) {
    this.request = request
    this.#onUpdate = onUpdate
    this.#settle = settle
  }

  get stopped(): boolean {
    return this.#stopped
  }

  get finished(): boolean {
    return this.#finished
  }

  markStopped(): void {
    this.#stopped = true
  }

  emit(update: Partial<Omit<SearchUpdate, 'id'>> = {}): void {
    if (this.#finished) return
    if (update.lines !== undefined) this.#lines = update.lines
    if (update.depth !== undefined) this.#depth = update.depth
    this.#onUpdate({
      id: this.request.id,
      depth: this.#depth,
      lines: [...this.#lines],
      ...(update.nodes === undefined ? {} : { nodes: update.nodes }),
      ...(update.nps === undefined ? {} : { nps: update.nps }),
      ...(update.timeMs === undefined ? {} : { timeMs: update.timeMs }),
    })
  }

  finish(result: Partial<Omit<SearchResult, 'id'>> = {}): void {
    if (this.#finished) return
    this.#finished = true
    const lines = result.lines ?? [...this.#lines]
    const first = lines[0]
    // `null` is a meaningful answer here — a finished game — so it is not a
    // missing value to be defaulted away.
    const bestMove =
      result.bestMove === undefined ? (first?.pv[0] ?? toUci('e2e4')) : result.bestMove
    this.#settle({
      id: this.request.id,
      depth: result.depth ?? this.#depth,
      lines,
      bestMove,
      ponder: result.ponder ?? null,
      score: result.score === undefined ? (first?.score ?? { kind: 'cp', value: 0 }) : result.score,
      stoppedEarly: result.stoppedEarly ?? this.#stopped,
      ...(result.nodes === undefined ? {} : { nodes: result.nodes }),
      ...(result.nps === undefined ? {} : { nps: result.nps }),
      ...(result.timeMs === undefined ? {} : { timeMs: result.timeMs }),
    })
  }
}

class FakeClient implements FakeEngineClient {
  readonly id: string
  readonly searches: FakeSearchHandle[] = []
  config: EngineInitConfig | null = null
  current: FakeSearch | null = null
  disposed = false

  readonly #options: FakeEngineOptions

  constructor(id: string, options: FakeEngineOptions) {
    this.id = id
    this.#options = options
  }

  async init(config: EngineInitConfig): Promise<EngineInfo> {
    if (this.#options.failInit?.(this.id) === true) {
      throw new Error(`fake engine ${this.id}: init failed`)
    }
    this.config = config
    return Promise.resolve({
      name: 'Fake Stockfish',
      multiThreaded: config.threads > 1,
      threads: config.threads,
      hashMb: config.hashMb,
      ...this.#options.info,
    })
  }

  async search(
    request: SearchRequest,
    onUpdate: (update: SearchUpdate) => void,
  ): Promise<SearchResult> {
    return new Promise<SearchResult>((resolve) => {
      const search = new FakeSearch(request, onUpdate, (result) => {
        if (this.current === search) this.current = null
        resolve(result)
      })
      this.current = search
      this.searches.push(search)
    })
  }

  async stop(): Promise<void> {
    const search = this.current
    if (search === null) return Promise.resolve()
    search.markStopped()
    if (this.#options.autoFinishOnStop !== false) search.finish()
    return Promise.resolve()
  }

  async dispose(): Promise<void> {
    this.disposed = true
    this.current = null
    return Promise.resolve()
  }
}

export function createFakeEngineFleet(options: FakeEngineOptions = {}): FakeEngineFleet {
  const clients: FakeClient[] = []
  return {
    factory: (id: string) => {
      const client = new FakeClient(id, options)
      clients.push(client)
      return Promise.resolve(client)
    },
    clients,
    searchFor(searchId: string): FakeSearchHandle | null {
      for (const client of clients) {
        for (const search of client.searches) {
          if (search.request.id === searchId && !search.finished) return search
        }
      }
      return null
    },
  }
}
