import {
  assertValid,
  type EngineInfo,
  EngineInfoSchema,
  type EngineLine,
  EngineLineSchema,
  type EngineScore,
  parseValid,
} from '@/domain'

import { formatGoCommand, formatSetOption, searchOptions, type UciOptionSetting } from './options'
import {
  type EngineInitConfig,
  hasSearchLimit,
  type SearchRequest,
  type SearchResult,
  SearchResultSchema,
  type SearchUpdate,
} from './protocol'
import { parseUciLine, type UciInfo, type UciOption } from './uci'

/**
 * One UCI conversation: handshake, options, one search at a time, `stop`.
 *
 * Why a transport interface instead of a `Worker`: the driver holds all the
 * protocol rules — when a score is trustworthy, when a snapshot may be posted,
 * what a `bestmove` settles — and none of them need a real engine to test. The
 * worker supplies a transport over the Stockfish build; the tests supply a
 * scripted one.
 */

/** A line-oriented duplex channel to an engine. */
export interface UciTransport {
  /** Send one UCI command, without the newline. */
  send(command: string): void
  /** Subscribe to engine output, one line per call. Returns an unsubscribe. */
  subscribe(handler: (line: string) => void): () => void
  /** Kill the engine. The driver never sends `quit`; it terminates. */
  terminate(): void
}

export interface UciDriverOptions {
  /** Snapshot cadence in ms; `0` posts every line. */
  readonly updateIntervalMs?: number
  /** How long the `uci` handshake may take, including the WASM compile. */
  readonly handshakeTimeoutMs?: number
  readonly now?: () => number
}

const DEFAULT_UPDATE_INTERVAL_MS = 80
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 30_000

interface Pending<T> {
  readonly resolve: (value: T) => void
  readonly reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout> | undefined
}

interface HandshakeState extends Pending<{ name: string; options: UciOption[] }> {
  name: string
  readonly options: UciOption[]
}

interface SearchState extends Pending<SearchResult> {
  readonly request: SearchRequest
  readonly onUpdate: (update: SearchUpdate) => void
  readonly lines: Map<number, EngineLine>
  depth: number
  nodes: number | undefined
  nps: number | undefined
  timeMs: number | undefined
  score: EngineScore | null
  stopRequested: boolean
  lastPostAt: number
  trailing: ReturnType<typeof setTimeout> | undefined
}

/** Why a class: a UCI session is state, and hiding it behind `#` keeps it honest. */
export class UciDriver {
  readonly #transport: UciTransport
  readonly #unsubscribe: () => void
  readonly #updateIntervalMs: number
  readonly #handshakeTimeoutMs: number
  readonly #now: () => number
  readonly #applied = new Map<string, string>()

  #handshake: HandshakeState | undefined
  #ready: Pending<void> | undefined
  #search: SearchState | undefined
  #disposed = false

  constructor(transport: UciTransport, options: UciDriverOptions = {}) {
    this.#transport = transport
    this.#updateIntervalMs = options.updateIntervalMs ?? DEFAULT_UPDATE_INTERVAL_MS
    this.#handshakeTimeoutMs = options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS
    this.#now = options.now ?? (() => performance.now())
    this.#unsubscribe = transport.subscribe((line) => {
      this.#onLine(line)
    })
  }

  /**
   * Handshake, size the engine and report what actually loaded.
   *
   * `multiThreaded` is read from the engine's own `option name Threads … max`
   * rather than from our capability guess: the single-threaded build advertises a
   * maximum of 1, so this is the one place that cannot be wrong about which
   * binary is running.
   */
  async initialise(config: EngineInitConfig): Promise<EngineInfo> {
    const handshake = await this.#runHandshake()
    const threadsOption = handshake.options.find((option) => option.name === 'Threads')
    const maxThreads = threadsOption?.max ?? 1
    const threads = Math.max(1, Math.min(config.threads, maxThreads))

    await this.#applyOptions([
      { name: 'Threads', value: String(threads) },
      { name: 'Hash', value: String(config.hashMb) },
    ])
    // Once, not per search: keeping the hash between positions is what makes a
    // game review faster than the same positions analysed cold.
    this.#transport.send('ucinewgame')
    await this.isReady()

    return assertValid(
      EngineInfoSchema,
      { name: handshake.name, multiThreaded: maxThreads > 1, threads, hashMb: config.hashMb },
      'engine worker: uci handshake',
    )
  }

  /** Resolves when the engine has drained every command sent before it. */
  async isReady(): Promise<void> {
    if (this.#disposed) throw new Error('UciDriver: the engine has been disposed')
    if (this.#ready !== undefined) throw new Error('UciDriver: isready is already pending')
    return new Promise<void>((resolve, reject) => {
      this.#ready = { resolve, reject, timer: undefined }
      this.#transport.send('isready')
    })
  }

  /**
   * Run one search to `bestmove`.
   *
   * Rejects if a search is already running: serialising is the pool's job, and a
   * second `go` would put the engine in a state no reply can untangle.
   */
  async search(
    request: SearchRequest,
    onUpdate: (update: SearchUpdate) => void,
  ): Promise<SearchResult> {
    if (this.#disposed) throw new Error('UciDriver: the engine has been disposed')
    if (this.#search !== undefined) throw new Error('UciDriver: a search is already running')
    if (!hasSearchLimit(request))
      throw new Error('UciDriver: a search needs depth, movetime or nodes')

    await this.#applyOptions(searchOptions(request))

    return new Promise<SearchResult>((resolve, reject) => {
      this.#search = {
        request,
        onUpdate,
        resolve,
        reject,
        timer: undefined,
        lines: new Map(),
        depth: 0,
        nodes: undefined,
        nps: undefined,
        timeMs: undefined,
        score: null,
        stopRequested: false,
        lastPostAt: Number.NEGATIVE_INFINITY,
        trailing: undefined,
      }
      this.#transport.send(`position fen ${request.fen}`)
      this.#transport.send(formatGoCommand(request))
    })
  }

  /**
   * Ask the engine to stop searching now.
   *
   * The search promise still settles through `bestmove`, with whatever depth was
   * reached — a stopped search is a shorter answer, not a failed one.
   */
  stop(): void {
    const search = this.#search
    if (search === undefined || search.stopRequested) return
    search.stopRequested = true
    this.#transport.send('stop')
  }

  /** Terminate the engine and fail anything still waiting on it. */
  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    const error = new Error('UciDriver: the engine was disposed mid-command')
    this.#failPending(error)
    this.#unsubscribe()
    this.#transport.terminate()
  }

  async #runHandshake(): Promise<{ name: string; options: UciOption[] }> {
    if (this.#disposed) throw new Error('UciDriver: the engine has been disposed')
    return new Promise<{ name: string; options: UciOption[] }>((resolve, reject) => {
      const state: HandshakeState = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.#handshake = undefined
          reject(new Error('UciDriver: the engine did not answer `uci` in time'))
        }, this.#handshakeTimeoutMs),
        name: 'Stockfish',
        options: [],
      }
      this.#handshake = state
      this.#transport.send('uci')
    })
  }

  /** Why the diff: re-sending an unchanged option makes Stockfish rebuild state. */
  async #applyOptions(settings: readonly UciOptionSetting[]): Promise<void> {
    let changed = false
    for (const setting of settings) {
      if (this.#applied.get(setting.name) === setting.value) continue
      this.#applied.set(setting.name, setting.value)
      this.#transport.send(formatSetOption(setting))
      changed = true
    }
    if (changed) await this.isReady()
  }

  #failPending(error: Error): void {
    const handshake = this.#handshake
    if (handshake !== undefined) {
      this.#handshake = undefined
      if (handshake.timer !== undefined) clearTimeout(handshake.timer)
      handshake.reject(error)
    }
    const ready = this.#ready
    if (ready !== undefined) {
      this.#ready = undefined
      ready.reject(error)
    }
    const search = this.#search
    if (search !== undefined) {
      this.#search = undefined
      if (search.trailing !== undefined) clearTimeout(search.trailing)
      search.reject(error)
    }
  }

  #onLine(line: string): void {
    const message = parseUciLine(line)
    switch (message.kind) {
      case 'id': {
        const handshake = this.#handshake
        if (handshake !== undefined && message.field === 'name') handshake.name = message.value
        return
      }
      case 'option': {
        this.#handshake?.options.push(message.option)
        return
      }
      case 'uciok': {
        const handshake = this.#handshake
        if (handshake === undefined) return
        this.#handshake = undefined
        if (handshake.timer !== undefined) clearTimeout(handshake.timer)
        handshake.resolve({ name: handshake.name, options: handshake.options })
        return
      }
      case 'readyok': {
        const ready = this.#ready
        if (ready === undefined) return
        this.#ready = undefined
        ready.resolve()
        return
      }
      case 'info':
        this.#onInfo(message.info)
        return
      case 'bestmove':
        this.#onBestMove(message.move, message.ponder)
        return
      case 'info-string':
      case 'unknown':
        return
    }
  }

  #onInfo(info: UciInfo): void {
    const search = this.#search
    if (search === undefined) return

    if (info.nodes !== undefined) search.nodes = info.nodes
    if (info.nps !== undefined) search.nps = info.nps
    if (info.timeMs !== undefined) search.timeMs = info.timeMs
    if (info.depth !== undefined) search.depth = Math.max(search.depth, info.depth)
    // A bare score with no PV is how the engine reports a finished game.
    if (info.score !== undefined && info.bound === undefined) search.score = info.score

    const line = this.#toEngineLine(info)
    if (line === null) {
      if (info.nps !== undefined || info.nodes !== undefined) this.#postUpdate(false)
      return
    }
    search.lines.set(line.multipv, line)
    this.#postUpdate(false)
  }

  /**
   * Turn an `info` record into a line, or `null` when it is not one.
   *
   * A record without a PV is progress reporting, and a `lowerbound`/`upperbound`
   * score is a fail-high the engine has not confirmed yet — showing either as a
   * line is how eval bars end up flickering through scores that never existed.
   */
  #toEngineLine(info: UciInfo): EngineLine | null {
    const search = this.#search
    if (search === undefined) return null
    if (info.pv === undefined || info.pv.length === 0) return null
    if (info.score === undefined || info.bound !== undefined) return null

    const candidate = {
      multipv: info.multipv ?? 1,
      depth: info.depth ?? search.depth,
      score: info.score,
      pv: info.pv,
      ...(info.selDepth === undefined ? {} : { selDepth: info.selDepth }),
      ...(info.nodes === undefined ? {} : { nodes: info.nodes }),
      ...(info.nps === undefined ? {} : { nps: info.nps }),
      ...(info.timeMs === undefined ? {} : { timeMs: info.timeMs }),
      ...(info.wdl === undefined ? {} : { wdl: info.wdl }),
    }

    const parsed = parseValid(EngineLineSchema, candidate, 'engine worker: info line')
    if (!parsed.ok) {
      // A line the schema rejects is a parser bug, not user data: drop it rather
      // than fail a search the UI is already showing.
      console.warn(parsed.error.message, parsed.error.details)
      return null
    }
    return parsed.value
  }

  #snapshot(search: SearchState): SearchUpdate {
    return {
      id: search.request.id,
      depth: search.depth,
      lines: [...search.lines.values()].sort((a, b) => a.multipv - b.multipv),
      ...(search.nodes === undefined ? {} : { nodes: search.nodes }),
      ...(search.nps === undefined ? {} : { nps: search.nps }),
      ...(search.timeMs === undefined ? {} : { timeMs: search.timeMs }),
    }
  }

  /** Coalesce: the engine can emit hundreds of lines a second, the UI wants ~12. */
  #postUpdate(force: boolean): void {
    const search = this.#search
    if (search === undefined) return

    const now = this.#now()
    const due = now - search.lastPostAt >= this.#updateIntervalMs
    if (!force && !due) {
      search.trailing ??= setTimeout(() => {
        search.trailing = undefined
        this.#postUpdate(true)
      }, this.#updateIntervalMs)
      return
    }

    if (search.trailing !== undefined) {
      clearTimeout(search.trailing)
      search.trailing = undefined
    }
    search.lastPostAt = now
    search.onUpdate(this.#snapshot(search))
  }

  #onBestMove(move: string | null, ponder: string | null): void {
    const search = this.#search
    if (search === undefined) return
    this.#search = undefined
    if (search.trailing !== undefined) clearTimeout(search.trailing)

    const lines = [...search.lines.values()].sort((a, b) => a.multipv - b.multipv)
    const best = lines[0]
    const result = {
      id: search.request.id,
      depth: search.depth,
      lines,
      bestMove: move,
      ponder,
      score: best?.score ?? search.score,
      stoppedEarly: search.stopRequested,
      ...(search.nodes === undefined ? {} : { nodes: search.nodes }),
      ...(search.nps === undefined ? {} : { nps: search.nps }),
      ...(search.timeMs === undefined ? {} : { timeMs: search.timeMs }),
    }

    const parsed = parseValid(SearchResultSchema, result, 'engine worker: bestmove')
    if (!parsed.ok) {
      search.reject(new Error(parsed.error.message))
      return
    }
    search.resolve(parsed.value)
  }
}
