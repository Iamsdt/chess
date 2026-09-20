import {
  domainError,
  type EngineInfo,
  type EngineLane,
  err,
  ok,
  type Result,
  toTimestamp,
} from '@/domain'

import {
  detectEngineEnvironment,
  type EngineCapabilities,
  type EngineEnvironment,
  type EngineResourcePlan,
  engineScriptUrl,
  planEngineResources,
} from './capabilities'
import { type SearchRequest, type SearchResult, type SearchUpdate } from './protocol'
import {
  emptyLaneTelemetry,
  type EngineLaneTelemetry,
  type EngineSearchCounters,
  type EngineTelemetry,
  type EngineTelemetryListener,
  type EngineWorkerState,
  type EngineWorkerTelemetry,
} from './telemetry'
import { type EngineClient, type EngineClientFactory } from './worker-client'

/**
 * The worker pool: named lanes, priorities, preemption, timeouts, idle shutdown.
 *
 * The rule the whole thing exists for: **a background review must never delay a
 * live move**. So a search carries a lane, `play` outranks `interactive` which
 * outranks `batch`, and when every engine is busy an arriving high-lane search
 * takes an engine off a lower-lane one — the displaced search goes back to the
 * front of its own lane and restarts as soon as an engine frees up.
 *
 * Nothing here knows what a `Worker` is: it drives `EngineClient`s from a
 * factory, which is how the lane rules are tested against a scripted engine
 * instead of a real one.
 */

const DEFAULT_IDLE_SHUTDOWN_MS = 30_000
const DEFAULT_UPDATE_INTERVAL_MS = 80
/** How long an engine may take to honour `stop` before we treat it as hung. */
const STOP_GRACE_MS = 2_000

/** Lower is more urgent. */
const LANE_PRIORITY: Readonly<Record<EngineLane, number>> = {
  play: 0,
  interactive: 1,
  batch: 2,
}

export interface EnginePoolOptions {
  /** How an engine is made. Defaults to a Comlink worker running Stockfish. */
  readonly spawn?: EngineClientFactory
  readonly environment?: EngineEnvironment
  /** Where `public/engine/` is served from; defaults to the Vite base URL. */
  readonly baseUrl?: string
  readonly idleShutdownMs?: number
  readonly updateIntervalMs?: number
  readonly now?: () => number
}

export interface PoolSubmission {
  /** Everything but the id, which the pool mints so ids stay unique per pool. */
  readonly request: Omit<SearchRequest, 'id'>
  readonly onUpdate?: (update: SearchUpdate) => void
  readonly signal?: AbortSignal
  /** Stop the search after this long and return what it has found so far. */
  readonly timeoutMs?: number
}

interface Job {
  readonly id: string
  readonly lane: EngineLane
  readonly request: SearchRequest
  readonly onUpdate: ((update: SearchUpdate) => void) | undefined
  readonly settle: (result: Result<SearchResult>) => void
  readonly enqueuedAt: number
  readonly timeoutMs: number | undefined
  readonly signal: AbortSignal | undefined
  onAbort: (() => void) | undefined
  settled: boolean
  /** Displaced by a higher lane and waiting to restart. */
  requeued: boolean
  /** The caller already has its answer (cancel, hard timeout); the engine is catching up. */
  abandoned: boolean
  slot: Slot | null
  stopTimer: ReturnType<typeof setTimeout> | undefined
  graceTimer: ReturnType<typeof setTimeout> | undefined
}

interface Slot {
  readonly id: string
  readonly index: number
  readonly threads: number
  client: EngineClient | null
  info: EngineInfo | null
  state: EngineWorkerState
  job: Job | null
  depth: number
  nps: number | null
  timeMs: number | null
  idleTimer: ReturnType<typeof setTimeout> | undefined
}

function toMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The engine failed for an unknown reason'
}

const noop = (): void => undefined

export class EnginePool {
  readonly #spawn: EngineClientFactory
  readonly #environment: EngineEnvironment
  readonly #plan: EngineResourcePlan
  readonly #scriptUrl: string
  readonly #idleShutdownMs: number
  readonly #updateIntervalMs: number
  readonly #now: () => number
  readonly #listeners = new Set<EngineTelemetryListener>()
  readonly #slots: Slot[] = []
  readonly #queue: Job[] = []

  #counter = 0
  #engineInfo: EngineInfo | null = null
  #shuttingDown = false
  #counters = { completed: 0, cancelled: 0, timedOut: 0, preempted: 0, failed: 0 }

  constructor(options: EnginePoolOptions = {}) {
    this.#environment = options.environment ?? detectEngineEnvironment()
    this.#plan = planEngineResources(this.#environment)
    this.#spawn =
      options.spawn ??
      (async (id: string) => {
        // Loaded on demand so that nothing which never analyses a position pays
        // for the worker module — or needs a `Worker` to exist at all, as in tests.
        const module = await import('./worker-client')
        return module.createWorkerEngineClient(id)
      })
    this.#scriptUrl = engineScriptUrl(this.#plan.build, options.baseUrl ?? import.meta.env.BASE_URL)
    this.#idleShutdownMs = options.idleShutdownMs ?? DEFAULT_IDLE_SHUTDOWN_MS
    this.#updateIntervalMs = options.updateIntervalMs ?? DEFAULT_UPDATE_INTERVAL_MS
    this.#now = options.now ?? (() => Date.now())
  }

  /** The plan, plus what the engine turned out to be once one has loaded. */
  capabilities(): EngineCapabilities {
    return { ...this.#environment, ...this.#plan, engine: this.#engineInfo }
  }

  /**
   * Start an engine before anything needs it.
   *
   * Worth doing on an idle screen: the WASM compile and the NNUE set-up are the
   * slow part, and after this the first search starts in single-digit ms.
   */
  async warmUp(): Promise<Result<EngineInfo>> {
    if (this.#shuttingDown) return err(domainError('unsupported', 'The engine pool is shut down'))
    const existing = this.#slots[0]
    const slot = existing ?? this.#createSlot()
    try {
      const { info } = await this.#initSlot(slot)
      if (slot.state === 'starting') this.#release(slot)
      return ok(info)
    } catch (cause) {
      this.#failSlot(slot, cause)
      return err(domainError('engine', toMessage(cause), { where: 'engine pool: warm-up', cause }))
    }
  }

  /** Queue a search. The promise settles once, with a value, never a throw. */
  async submit(submission: PoolSubmission): Promise<Result<SearchResult>> {
    if (this.#shuttingDown) return err(domainError('unsupported', 'The engine pool is shut down'))
    if (submission.signal?.aborted === true) {
      return err(domainError('cancelled', 'The search was cancelled before it started'))
    }

    this.#counter += 1
    const request: SearchRequest = { ...submission.request, id: `search-${String(this.#counter)}` }

    return new Promise<Result<SearchResult>>((resolve) => {
      const job: Job = {
        id: request.id,
        lane: request.lane,
        request,
        onUpdate: submission.onUpdate,
        settle: resolve,
        enqueuedAt: this.#now(),
        timeoutMs: submission.timeoutMs,
        signal: submission.signal,
        onAbort: undefined,
        settled: false,
        requeued: false,
        abandoned: false,
        slot: null,
        stopTimer: undefined,
        graceTimer: undefined,
      }
      if (submission.signal !== undefined) {
        const onAbort = (): void => {
          this.#cancel(job)
        }
        job.onAbort = onAbort
        submission.signal.addEventListener('abort', onAbort, { once: true })
      }
      this.#queue.push(job)
      this.#emit()
      this.#pump()
    })
  }

  telemetry(): EngineTelemetry {
    const lanes = emptyLaneTelemetry()
    const counts: Record<EngineLane, { queued: number; running: number }> = {
      play: { ...lanes.play },
      interactive: { ...lanes.interactive },
      batch: { ...lanes.batch },
    }
    for (const job of this.#queue) counts[job.lane].queued += 1
    for (const slot of this.#slots) {
      const job = slot.job
      if (job !== null) counts[job.lane].running += 1
    }

    const workers: EngineWorkerTelemetry[] = this.#slots.map((slot) => ({
      id: slot.id,
      index: slot.index,
      state: slot.state,
      threads: slot.info?.threads ?? slot.threads,
      lane: slot.job?.lane ?? null,
      depth: slot.depth,
      nps: slot.nps,
      timeMs: slot.timeMs,
    }))

    const laneTelemetry: Record<EngineLane, EngineLaneTelemetry> = {
      play: counts.play,
      interactive: counts.interactive,
      batch: counts.batch,
    }
    const searches: EngineSearchCounters = { ...this.#counters }

    return {
      capabilities: this.capabilities(),
      workers,
      lanes: laneTelemetry,
      searches,
      updatedAt: toTimestamp(Date.now()),
    }
  }

  subscribeTelemetry(listener: EngineTelemetryListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /** Cancel everything and free every engine. The pool is unusable afterwards. */
  async shutdown(): Promise<void> {
    this.#shuttingDown = true
    for (const job of [...this.#queue]) {
      this.#settle(job, err(domainError('cancelled', 'The engine pool is shutting down')))
    }
    this.#queue.length = 0
    const slots = [...this.#slots]
    this.#slots.length = 0
    await Promise.all(
      slots.map(async (slot) => {
        if (slot.idleTimer !== undefined) clearTimeout(slot.idleTimer)
        const job = slot.job
        if (job !== null) {
          this.#settle(job, err(domainError('cancelled', 'The engine pool is shutting down')))
        }
        try {
          await slot.client?.dispose()
        } catch {
          // Disposing a worker that already died is not a failure worth reporting.
        }
      }),
    )
    this.#emit()
  }

  #createSlot(): Slot {
    const index = this.#slots.length
    const slot: Slot = {
      id: `engine-${String(index)}`,
      index,
      // Only the first engine gets the full thread budget; later ones are for
      // background work and must not be able to crowd out the foreground.
      threads: index === 0 ? this.#plan.threads : this.#plan.batchThreads,
      client: null,
      info: null,
      state: 'starting',
      job: null,
      depth: 0,
      nps: null,
      timeMs: null,
      idleTimer: undefined,
    }
    this.#slots.push(slot)
    return slot
  }

  async #initSlot(slot: Slot): Promise<{ client: EngineClient; info: EngineInfo }> {
    const ready = slot.client
    const known = slot.info
    if (ready !== null && known !== null) return { client: ready, info: known }
    const existing = ready
    slot.state = 'starting'
    this.#emit()
    const client = existing ?? (await this.#spawn(slot.id))
    slot.client = client
    const info = await client.init({
      build: this.#plan.build,
      scriptUrl: this.#scriptUrl,
      threads: slot.threads,
      hashMb: this.#plan.hashMb,
      updateIntervalMs: this.#updateIntervalMs,
    })
    slot.info = info
    this.#engineInfo ??= info
    return { client, info }
  }

  #failSlot(slot: Slot, cause: unknown): void {
    slot.state = 'failed'
    slot.job = null
    if (slot.idleTimer !== undefined) clearTimeout(slot.idleTimer)
    const client = slot.client
    slot.client = null
    slot.info = null
    void client?.dispose().catch(noop)
    const at = this.#slots.indexOf(slot)
    if (at >= 0) this.#slots.splice(at, 1)
    console.warn(`engine pool: ${slot.id} failed — ${toMessage(cause)}`)
    this.#emit()
  }

  #nextQueued(): Job | null {
    let best: Job | null = null
    for (const job of this.#queue) {
      if (job.settled && !job.requeued) continue
      if (best === null) {
        best = job
        continue
      }
      const byLane = LANE_PRIORITY[job.lane] - LANE_PRIORITY[best.lane]
      if (byLane < 0 || (byLane === 0 && job.enqueuedAt < best.enqueuedAt)) best = job
    }
    return best
  }

  #dequeue(job: Job): void {
    const at = this.#queue.indexOf(job)
    if (at >= 0) this.#queue.splice(at, 1)
  }

  #idleSlotFor(lane: EngineLane): Slot | null {
    const idle = this.#slots.filter((slot) => slot.state === 'idle' && slot.client !== null)
    if (idle.length === 0) return null
    // Slot 0 has the most threads, so foreground lanes take it and background work
    // takes the last one it can get.
    const chosen = lane === 'batch' ? idle[idle.length - 1] : idle[0]
    return chosen ?? null
  }

  #preemptableSlot(lane: EngineLane): Slot | null {
    const priority = LANE_PRIORITY[lane]
    let victim: Slot | null = null
    let victimPriority = priority
    for (const slot of this.#slots) {
      const job = slot.job
      if (slot.state !== 'searching' || job === null || job.settled || job.requeued) continue
      const jobPriority = LANE_PRIORITY[job.lane]
      if (jobPriority <= priority) continue
      if (victim === null || jobPriority > victimPriority) {
        victim = slot
        victimPriority = jobPriority
      }
    }
    return victim
  }

  #preempt(slot: Slot): void {
    const job = slot.job
    if (job === null || job.settled) return
    job.requeued = true
    // Back in the queue with its original timestamp, so it is first in its lane
    // when an engine frees up rather than behind whatever arrived meanwhile.
    this.#queue.push(job)
    void slot.client?.stop().catch(noop)
    this.#emit()
  }

  #pump(): void {
    if (this.#shuttingDown) return
    for (;;) {
      const job = this.#nextQueued()
      if (job === null) return

      const idle = this.#idleSlotFor(job.lane)
      if (idle !== null) {
        this.#dequeue(job)
        void this.#runOn(idle, job)
        continue
      }

      if (this.#slots.length < this.#plan.maxWorkers) {
        const slot = this.#createSlot()
        this.#dequeue(job)
        void this.#runOn(slot, job)
        continue
      }

      const victim = this.#preemptableSlot(job.lane)
      if (victim === null) return
      // The displaced search settles asynchronously; releasing its engine pumps
      // again, and this job is still the most urgent thing in the queue.
      this.#preempt(victim)
      return
    }
  }

  /**
   * Why this is a method and not two lines in `#runOn`: clearing the flag there
   * would let the compiler assume it stays clear, and the whole point is that a
   * higher lane can set it again while the search is in flight.
   */
  #beginRun(job: Job, slot: Slot): void {
    job.slot = slot
    job.requeued = false
  }

  async #runOn(slot: Slot, job: Job): Promise<void> {
    if (slot.idleTimer !== undefined) {
      clearTimeout(slot.idleTimer)
      slot.idleTimer = undefined
    }
    slot.job = job
    // Claim the engine before the first `await`: the scheduler runs to completion
    // synchronously, and an engine that still looks idle gets handed out twice.
    slot.state = slot.client === null ? 'starting' : 'searching'
    slot.depth = 0
    slot.nps = null
    slot.timeMs = null
    this.#beginRun(job, slot)
    this.#emit()

    try {
      const { client } = await this.#initSlot(slot)
      // Cancelled while the engine was still compiling: never start the search.
      if (job.settled) {
        this.#release(slot)
        return
      }
      slot.state = 'searching'
      this.#armTimeout(job)
      this.#emit()

      const result = await client.search(job.request, (update) => {
        slot.depth = update.depth
        slot.nps = update.nps ?? null
        slot.timeMs = update.timeMs ?? null
        if (!job.settled && !job.requeued) job.onUpdate?.(update)
      })
      this.#clearTimers(job)

      if (job.requeued) {
        this.#counters.preempted += 1
      } else if (!job.abandoned) {
        this.#counters.completed += 1
        this.#settle(job, ok(result))
      }
      this.#release(slot)
    } catch (cause) {
      this.#clearTimers(job)
      this.#counters.failed += 1
      this.#failSlot(slot, cause)
      if (!job.settled && !job.requeued) {
        this.#settle(
          job,
          err(domainError('engine', toMessage(cause), { where: `engine pool: ${slot.id}`, cause })),
        )
      }
      this.#pump()
    }
  }

  /**
   * A timeout stops the search and keeps what it found — a shallower answer beats
   * no answer. Only an engine that ignores `stop` is a failure.
   */
  #armTimeout(job: Job): void {
    const timeoutMs = job.timeoutMs
    if (timeoutMs === undefined) return
    job.stopTimer = setTimeout(() => {
      job.stopTimer = undefined
      const slot = job.slot
      if (slot === null || job.settled) return
      this.#counters.timedOut += 1
      void slot.client?.stop().catch(noop)
      job.graceTimer = setTimeout(() => {
        job.graceTimer = undefined
        if (job.settled) return
        job.abandoned = true
        this.#settle(job, err(domainError('timeout', 'The engine did not stop when asked')))
        this.#failSlot(slot, new Error('the engine ignored `stop`'))
        this.#pump()
      }, STOP_GRACE_MS)
    }, timeoutMs)
  }

  #clearTimers(job: Job): void {
    if (job.stopTimer !== undefined) clearTimeout(job.stopTimer)
    if (job.graceTimer !== undefined) clearTimeout(job.graceTimer)
    job.stopTimer = undefined
    job.graceTimer = undefined
  }

  /**
   * Cancellation answers the caller at once and tells the engine to stop, which
   * is what keeps a cancelled analysis from burning a core for another second.
   */
  #cancel(job: Job): void {
    if (job.settled) return
    this.#counters.cancelled += 1
    const slot = job.slot
    if (slot !== null && slot.job === job) {
      job.abandoned = true
      this.#settle(job, err(domainError('cancelled', 'The search was cancelled')))
      void slot.client?.stop().catch(noop)
      return
    }
    this.#dequeue(job)
    this.#settle(job, err(domainError('cancelled', 'The search was cancelled')))
    this.#pump()
  }

  #settle(job: Job, result: Result<SearchResult>): void {
    if (job.settled) return
    job.settled = true
    this.#clearTimers(job)
    const onAbort = job.onAbort
    if (onAbort !== undefined && job.signal !== undefined) {
      job.signal.removeEventListener('abort', onAbort)
      job.onAbort = undefined
    }
    job.settle(result)
    this.#emit()
  }

  #release(slot: Slot): void {
    slot.job = null
    slot.state = 'idle'
    if (slot.idleTimer !== undefined) clearTimeout(slot.idleTimer)
    // Idle shutdown: an engine sitting on a hash table and four pthreads is not
    // free, and the next warm-up costs far less than the memory does.
    slot.idleTimer = setTimeout(() => {
      slot.idleTimer = undefined
      if (slot.state !== 'idle' || slot.job !== null) return
      const at = this.#slots.indexOf(slot)
      if (at >= 0) this.#slots.splice(at, 1)
      const client = slot.client
      slot.client = null
      slot.info = null
      void client?.dispose().catch(noop)
      this.#emit()
    }, this.#idleShutdownMs)
    this.#emit()
    this.#pump()
  }

  #emit(): void {
    if (this.#listeners.size === 0) return
    const snapshot = this.telemetry()
    for (const listener of this.#listeners) listener(snapshot)
  }
}
