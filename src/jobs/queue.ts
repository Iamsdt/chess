import {
  assertValid,
  isJobActive,
  JOB_STATES,
  JobPayloadSchema,
  toTimestamp,
  type DomainError,
  type Job,
  type JobId,
  type JobPriority,
  type JobState,
  type JobType,
  type Timestamp,
} from '@/domain'

import {
  backoffDelayMs,
  classifyFailure,
  DEFAULT_BACKOFF,
  DEFAULT_MAX_ATTEMPTS,
  toJobError,
  type BackoffPolicy,
} from './backoff'

import type { EnqueueOptions, JobHandler, JobObserver, JobProgress, JobsApi } from './contract'
import type { JobBroadcast } from './messages'
import type { IdleBudget, JobLock, JobsEnvironment, RunConditions } from './seams'

/**
 * S11 · the durable background job queue.
 *
 * The shape of it, in one paragraph: rows live in IndexedDB (S05's `jobsRepo`), so
 * a job outlives the page that queued it. A tab wakes on `requestIdleCallback`,
 * spends at most a few milliseconds deciding what to run, and stops that slice the
 * moment `isInputPending()` says the user is doing something. Before it runs a job
 * it takes a **Web Lock named after the job type**, which is what stops a second
 * tab picking up the same work. While the job runs it broadcasts progress on a
 * **BroadcastChannel**, so every tab's `observe()` sees the same bar move. A handler
 * that throws is retried on an exponential backoff until its attempts run out, at
 * which point the job is **quarantined** rather than retried for ever. The tab
 * stands down entirely while it is hidden or the device is saving power.
 */

const DEFAULT_MAX_CONCURRENT = 1
/** §5: nothing heavier than ~5 ms on the main thread — this is the queue's own share. */
const DEFAULT_SLICE_MS = 5
/** How long an idle callback may be starved before it runs anyway. */
const DEFAULT_IDLE_TIMEOUT_MS = 500
/** Re-check after this long when the only work left is locked by another tab. */
const BLOCKED_RETRY_MS = 1_000
/**
 * How long to wait before picking up where a slice left off.
 *
 * Why not "immediately at the next idle moment": a slice that ended because the
 * user is typing would be re-entered as soon as the callback fires, and on a
 * platform whose idle callback is a timeout that is a busy loop. One frame is long
 * enough for input to be dealt with and short enough to be invisible.
 */
const YIELD_MS = 16
const THROUGHPUT_WINDOW_MS = 60_000
const LOCK_PREFIX = 'chess-king:job:'

const PRIORITY_RANK: Record<JobPriority, number> = { high: 0, normal: 1, low: 2 }

export type PauseReason = 'hidden' | 'battery-saver' | 'manual'

export interface JobQueueOptions {
  readonly maxConcurrent?: number
  readonly maxAttempts?: number
  readonly backoff?: BackoffPolicy
  /** The main-thread budget for one scheduling slice. */
  readonly sliceMs?: number
  readonly idleTimeoutMs?: number
  /** Identifies this tab in `lockOwner` and in every broadcast. */
  readonly ownerId?: string
  readonly lockPrefix?: string
}

export interface InFlightJob {
  readonly id: JobId
  readonly type: JobType
  readonly startedAt: Timestamp
  /** 0–1, mirroring `JobProgress`. */
  readonly progress: number
}

/**
 * What `/dev/jobs` shows about the scheduler itself.
 *
 * Why a snapshot rather than a subscription, matching S07's engine telemetry: the
 * panel repaints on a timer and only ever wants "what is true now".
 */
export interface JobsRuntimeStats {
  readonly owner: string
  readonly started: boolean
  readonly paused: boolean
  readonly pauseReasons: readonly PauseReason[]
  readonly handlers: readonly JobType[]
  readonly inFlight: readonly InFlightJob[]
  /** Job types this tab currently holds the Web Lock for. */
  readonly heldLocks: readonly JobType[]
  readonly completed: number
  readonly failed: number
  readonly throughputPerMinute: number
  /**
   * Wall time of the last scheduling slice, and of the worst one so far.
   *
   * This is the queue deciding what to run — a lock, a couple of indexed reads and a
   * row update — not the handlers' work, which belongs in a worker. It includes the
   * storage round-trips, which do not block the main thread, so it reads slightly
   * high; it is the number the slice budget is enforced against.
   */
  readonly lastSliceMs: number
  readonly maxSliceMs: number
}

/** The app-facing queue: the fixed `JobsApi` seam plus what the devtools panel needs. */
export interface JobQueue extends JobsApi {
  start(): void
  stop(): Promise<void>
  pause(): void
  resume(): void
  stats(): JobsRuntimeStats
  /** Put a quarantined or failed job back in the queue with a fresh attempt budget. */
  retry(id: JobId): Promise<void>
  /** Housekeeping: drop finished rows older than `before`. Quarantined rows stay. */
  prune(before: Timestamp): Promise<number>
}

/**
 * Thrown by `enqueue` when the row cannot be written.
 *
 * Why an exception here when the quality bar wants errors as values: `enqueue`
 * returns `Promise<JobId>` in the seam four sprints already call, so there is no
 * failure channel to put a `DomainError` in. It carries the `DomainError` as data.
 */
export class JobQueueError extends Error {
  override readonly name = 'JobQueueError'
  readonly detail: DomainError

  constructor(detail: DomainError) {
    super(detail.message)
    this.detail = detail
  }
}

/** Why the two shapes differ: the DB stores 0–100, the seam promises 0–1 or null. */
function toProgress(job: Job): JobProgress {
  const progress = job.state === 'queued' && job.startedAt === null ? null : job.progress / 100
  const base = { id: job.id, state: job.state, progress }
  return job.progressLabel === undefined ? base : { ...base, label: job.progressLabel }
}

function outranks(candidate: Job, incumbent: Job): boolean {
  const byPriority = PRIORITY_RANK[candidate.priority] - PRIORITY_RANK[incumbent.priority]
  return byPriority === 0 ? candidate.createdAt < incumbent.createdAt : byPriority < 0
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** A promise that only ever rejects, and only when `signal` aborts. */
function aborted(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    if (signal.aborted) {
      reject(new JobAbortedError('Job aborted'))
      return
    }
    signal.addEventListener(
      'abort',
      () => {
        reject(new JobAbortedError('Job aborted'))
      },
      { once: true },
    )
  })
}

/**
 * The abort the queue itself raises.
 *
 * Why a class of our own rather than a `DOMException`: the name is what
 * `classifyFailure` reads, and this one exists in every runtime the queue runs in.
 */
class JobAbortedError extends Error {
  override readonly name = 'AbortError'
}

interface RunningJob {
  job: Job
  readonly controller: AbortController
  readonly startedAt: Timestamp
  percent: number
  /** Set when `stop()` aborted it, so it is re-queued rather than recorded as cancelled. */
  interrupted: boolean
}

class DurableJobQueue implements JobQueue {
  readonly #env: JobsEnvironment
  readonly #owner: string
  readonly #lockPrefix: string
  readonly #maxConcurrent: number
  readonly #maxAttempts: number
  readonly #backoff: BackoffPolicy
  readonly #sliceMs: number
  readonly #idleTimeoutMs: number

  readonly #handlers = new Map<JobType, JobHandler>()
  readonly #observers = new Map<JobId, Set<JobObserver>>()
  readonly #inFlight = new Map<JobId, RunningJob>()
  readonly #locks = new Map<JobType, JobLock>()
  readonly #running = new Set<Promise<void>>()
  readonly #completions: number[] = []

  #started = false
  #manualPause = false
  #conditions: RunConditions = { hidden: false, batterySaver: false }
  #cancelIdle: (() => void) | null = null
  #cancelDelay: (() => void) | null = null
  #unsubscribeChannel: (() => void) | null = null
  #unsubscribePower: (() => void) | null = null
  #completed = 0
  #failed = 0
  #lastSliceMs = 0
  #maxSliceMs = 0

  constructor(env: JobsEnvironment, options: JobQueueOptions = {}) {
    this.#env = env
    this.#owner = options.ownerId ?? `tab_${env.newJobId()}`
    this.#lockPrefix = options.lockPrefix ?? LOCK_PREFIX
    this.#maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT
    this.#maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    this.#backoff = options.backoff ?? DEFAULT_BACKOFF
    this.#sliceMs = options.sliceMs ?? DEFAULT_SLICE_MS
    this.#idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
  }

  /* ── Lifecycle ───────────────────────────────────────────────────────────── */

  /**
   * Wake the queue.
   *
   * Why it is called from `enqueue`, `registerHandler`, `observe` and `cancel`
   * rather than from an app bootstrap: S11 owns no file in `src/app`, and a queue
   * with no handlers registered has nothing it could legally run anyway. The first
   * feature to register its handler after a reload is what restarts its own work.
   */
  start(): void {
    if (this.#started) return
    this.#started = true
    this.#conditions = this.#env.power.read()
    this.#unsubscribePower = this.#env.power.subscribe((conditions) => {
      this.#conditions = conditions
      this.#wake()
    })
    this.#unsubscribeChannel = this.#env.channel.subscribe((message) => {
      this.#onBroadcast(message)
    })
    void this.#recover().catch((error: unknown) => {
      console.error('jobs: could not recover interrupted jobs', error)
    })
  }

  async stop(): Promise<void> {
    if (!this.#started) return
    this.#started = false
    this.#cancelScheduled()
    this.#unsubscribeChannel?.()
    this.#unsubscribeChannel = null
    this.#unsubscribePower?.()
    this.#unsubscribePower = null
    for (const running of [...this.#inFlight.values()]) {
      running.interrupted = true
      running.controller.abort()
    }
    await Promise.allSettled([...this.#running])
  }

  pause(): void {
    this.#manualPause = true
    this.#cancelScheduled()
  }

  resume(): void {
    this.#manualPause = false
    this.#wake()
  }

  /* ── The seam ────────────────────────────────────────────────────────────── */

  async enqueue(type: JobType, payload: unknown, options: EnqueueOptions = {}): Promise<JobId> {
    this.start()
    const validated = assertValid(JobPayloadSchema, payload, `jobs.enqueue(${type})`)
    const dedupeKey = options.dedupeKey ?? null
    if (dedupeKey !== null) {
      const existing = await this.#env.repo.findActiveByDedupeKey(type, dedupeKey)
      if (existing !== undefined) return existing.id
    }

    const at = this.#env.now()
    const job: Job = {
      id: this.#env.newJobId(),
      type,
      payload: validated,
      state: 'queued',
      priority: options.priority ?? 'normal',
      attempts: 0,
      maxAttempts: this.#maxAttempts,
      progress: 0,
      lastError: null,
      createdAt: at,
      updatedAt: at,
      startedAt: null,
      finishedAt: null,
      nextRunAt: null,
      dedupeKey,
      lockOwner: null,
    }
    const written = await this.#env.repo.add(job)
    if (!written.ok) throw new JobQueueError(written.error)

    this.#env.channel.post({ kind: 'wake', origin: this.#owner, type })
    this.#wake()
    return written.value.id
  }

  observe(id: JobId, observer: JobObserver): () => void {
    this.start()
    const observers = this.#observers.get(id) ?? new Set<JobObserver>()
    observers.add(observer)
    this.#observers.set(id, observers)
    let live = true
    void this.#emitCurrent(id, observer, () => live)
    return () => {
      live = false
      observers.delete(observer)
      if (observers.size === 0) this.#observers.delete(id)
    }
  }

  async cancel(id: JobId): Promise<void> {
    this.start()
    const running = this.#inFlight.get(id)
    if (running !== undefined) {
      running.controller.abort()
      return
    }
    const job = await this.#env.repo.get(id)
    if (job === undefined || !isJobActive(job)) return
    if (job.state === 'running') {
      // Another tab holds it; only that tab can abort its handler.
      this.#env.channel.post({ kind: 'cancel', origin: this.#owner, id })
      return
    }
    await this.#apply(id, { state: 'cancelled', finishedAt: this.#env.now(), lockOwner: null })
  }

  registerHandler(type: JobType, handler: JobHandler): void {
    this.#handlers.set(type, handler)
    this.start()
    this.#wake()
  }

  async list(state?: JobState): Promise<Job[]> {
    if (state !== undefined) return this.#env.repo.listByState(state)
    const all: Job[] = []
    for (const each of JOB_STATES) {
      all.push(...(await this.#env.repo.listByState(each)))
    }
    return all.sort((left, right) => right.createdAt - left.createdAt)
  }

  /* ── Devtools ────────────────────────────────────────────────────────────── */

  async retry(id: JobId): Promise<void> {
    const job = await this.#env.repo.get(id)
    if (job === undefined || isJobActive(job)) return
    this.start()
    await this.#apply(id, {
      state: 'queued',
      attempts: 0,
      progress: 0,
      lastError: null,
      startedAt: null,
      finishedAt: null,
      nextRunAt: null,
      lockOwner: null,
    })
    this.#env.channel.post({ kind: 'wake', origin: this.#owner, type: job.type })
    this.#wake()
  }

  async prune(before: Timestamp): Promise<number> {
    const result = await this.#env.repo.pruneFinished(before)
    return result.ok ? result.value : 0
  }

  stats(): JobsRuntimeStats {
    const cutoff = this.#env.monotonic() - THROUGHPUT_WINDOW_MS
    while (this.#completions.length > 0 && (this.#completions[0] ?? 0) < cutoff) {
      this.#completions.shift()
    }
    return {
      owner: this.#owner,
      started: this.#started,
      paused: this.#isPaused(),
      pauseReasons: this.#pauseReasons(),
      handlers: [...this.#handlers.keys()],
      inFlight: [...this.#inFlight.values()].map((running) => ({
        id: running.job.id,
        type: running.job.type,
        startedAt: running.startedAt,
        progress: running.percent / 100,
      })),
      heldLocks: [...this.#locks.keys()],
      completed: this.#completed,
      failed: this.#failed,
      throughputPerMinute: this.#completions.length,
      lastSliceMs: this.#lastSliceMs,
      maxSliceMs: this.#maxSliceMs,
    }
  }

  /* ── Scheduling ──────────────────────────────────────────────────────────── */

  #isPaused(): boolean {
    return this.#manualPause || this.#conditions.hidden || this.#conditions.batterySaver
  }

  #pauseReasons(): PauseReason[] {
    const reasons: PauseReason[] = []
    if (this.#conditions.hidden) reasons.push('hidden')
    if (this.#conditions.batterySaver) reasons.push('battery-saver')
    if (this.#manualPause) reasons.push('manual')
    return reasons
  }

  #cancelScheduled(): void {
    this.#cancelIdle?.()
    this.#cancelIdle = null
    this.#cancelDelay?.()
    this.#cancelDelay = null
  }

  /** Idempotent: many callers say "there may be work"; only one idle callback results. */
  #wake(): void {
    if (!this.#started || this.#isPaused()) return
    if (this.#cancelIdle !== null) return
    this.#cancelIdle = this.#env.idle.schedule((budget) => {
      this.#cancelIdle = null
      void this.#tick(budget)
    }, this.#idleTimeoutMs)
  }

  #wakeIn(ms: number): void {
    if (!this.#started || this.#isPaused()) return
    this.#cancelDelay?.()
    this.#cancelDelay = this.#env.idle.delay(ms, () => {
      this.#cancelDelay = null
      this.#wake()
    })
  }

  /**
   * One scheduling slice: claim as much work as fits in the budget, then get out.
   *
   * The loop gives the slice back the instant the user touches the page, which is
   * the whole point of `isInputPending`. Starting a job is cheap — a lock, a row
   * update and a promise — the handler's own cost is its own problem, and by the
   * quality bar it belongs in a worker.
   */
  async #tick(budget: IdleBudget): Promise<void> {
    const sliceStart = this.#env.monotonic()
    const blockedByOtherTab = new Set<JobType>()
    try {
      while (this.#started && !this.#isPaused() && this.#inFlight.size < this.#maxConcurrent) {
        if (this.#env.isInputPending()) break
        if (this.#env.monotonic() - sliceStart >= this.#sliceMs) break
        if (budget.timeRemaining() <= 0) break
        const job = await this.#select(this.#env.now(), blockedByOtherTab)
        if (job === undefined) break
        const outcome = await this.#claim(job)
        if (outcome === 'locked') blockedByOtherTab.add(job.type)
      }
    } finally {
      const elapsed = this.#env.monotonic() - sliceStart
      this.#lastSliceMs = elapsed
      this.#maxSliceMs = Math.max(this.#maxSliceMs, elapsed)
    }
    await this.#scheduleNextWake(blockedByOtherTab)
  }

  /** A type is ours to run only if we have a handler and nobody is already on it. */
  #isRunnableType(type: JobType, blocked: ReadonlySet<JobType>): boolean {
    return this.#handlers.has(type) && !this.#locks.has(type) && !blocked.has(type)
  }

  /**
   * The next job this tab may start.
   *
   * `claimNext` is the fast path and the single source of the queue's ordering. The
   * scan below only exists for the case it cannot express — "the best job is one I
   * am already running, or another tab has locked" — and it repeats `claimNext`'s
   * own order so the two can never disagree about which job is next.
   */
  async #select(at: Timestamp, blocked: ReadonlySet<JobType>): Promise<Job | undefined> {
    const first = await this.#env.repo.claimNext(at)
    if (first === undefined) return undefined
    if (this.#isRunnableType(first.type, blocked)) return first

    const queued = await this.#env.repo.listByState('queued')
    let best: Job | undefined
    for (const job of queued) {
      if (!this.#isRunnableType(job.type, blocked)) continue
      if (job.nextRunAt !== null && job.nextRunAt > at) continue
      if (best === undefined || outranks(job, best)) best = job
    }
    return best
  }

  async #scheduleNextWake(blocked: ReadonlySet<JobType>): Promise<void> {
    if (!this.#started || this.#isPaused()) return
    const at = this.#env.now()
    const queued = await this.#env.repo.listByState('queued')
    let soonestMs: number | null = null
    let runnableNow = false
    for (const job of queued) {
      if (!this.#handlers.has(job.type)) continue
      if (job.nextRunAt !== null && job.nextRunAt > at) {
        const wait = job.nextRunAt - at
        soonestMs = soonestMs === null ? wait : Math.min(soonestMs, wait)
        continue
      }
      if (this.#isRunnableType(job.type, blocked) && this.#inFlight.size < this.#maxConcurrent) {
        runnableNow = true
      } else {
        soonestMs = soonestMs === null ? BLOCKED_RETRY_MS : Math.min(soonestMs, BLOCKED_RETRY_MS)
      }
    }
    if (runnableNow) {
      // The loop broke early — input, or the slice budget — so resume a frame later.
      this.#wakeIn(YIELD_MS)
      return
    }
    if (soonestMs !== null) this.#wakeIn(soonestMs)
  }

  /* ── Claiming and running ────────────────────────────────────────────────── */

  #lockName(type: JobType): string {
    return `${this.#lockPrefix}${type}`
  }

  /**
   * Take the type's Web Lock, then flip the row to `running`.
   *
   * The lock is what makes the read-then-write safe across tabs: only one tab can
   * be inside this method for a given job type at a time, so re-reading the row and
   * checking it is still `queued` is enough to rule out a double claim.
   */
  async #claim(job: Job): Promise<'started' | 'locked' | 'gone'> {
    const lock = await this.#env.locks.acquire(this.#lockName(job.type))
    if (lock === null) return 'locked'

    const fresh = await this.#env.repo.get(job.id)
    if (fresh?.state !== 'queued') {
      lock.release()
      return 'gone'
    }
    const startedAt = this.#env.now()
    const claimed = await this.#env.repo.update(job.id, {
      state: 'running',
      startedAt,
      progress: 0,
      lockOwner: this.#owner,
    })
    if (!claimed.ok) {
      lock.release()
      return 'gone'
    }

    this.#locks.set(job.type, lock)
    const running: RunningJob = {
      job: claimed.value,
      controller: new AbortController(),
      startedAt,
      percent: 0,
      interrupted: false,
    }
    this.#inFlight.set(job.id, running)
    this.#publish(claimed.value)

    const execution = this.#run(running)
    this.#running.add(execution)
    const forget = (): void => {
      this.#running.delete(execution)
    }
    void execution.then(forget, forget)
    return 'started'
  }

  async #run(running: RunningJob): Promise<void> {
    const handler = this.#handlers.get(running.job.type)
    try {
      if (handler === undefined) {
        // The handler was unregistered between selection and start; give the row back.
        await this.#apply(running.job.id, {
          state: 'queued',
          startedAt: null,
          lockOwner: null,
        })
        return
      }
      const work = handler(running.job.payload, {
        signal: running.controller.signal,
        report: (progress, label) => {
          this.#report(running, progress, label)
        },
      })
      // Racing the signal means a handler that ignores its abort cannot hold the
      // queue — or `stop()`, or the page's unload — open indefinitely.
      await Promise.race([work, aborted(running.controller.signal)])
      await this.#succeed(running)
    } catch (error: unknown) {
      await this.#settleFailure(running, error)
    } finally {
      this.#release(running)
    }
  }

  /**
   * Progress ticks are frequent and IndexedDB writes are not free, so the row and
   * the channel only see whole-percent changes. Local observers see every tick.
   */
  #report(running: RunningJob, progress: number, label?: string): void {
    const percent = Math.round(clamp01(progress) * 100)
    const changed = percent !== running.percent
    running.percent = percent
    const snapshot: JobProgress =
      label === undefined
        ? { id: running.job.id, state: 'running', progress: percent / 100 }
        : { id: running.job.id, state: 'running', progress: percent / 100, label }
    this.#notify(snapshot)
    if (!changed && label === undefined) return
    this.#env.channel.post({
      kind: 'progress',
      origin: this.#owner,
      id: running.job.id,
      type: running.job.type,
      state: 'running',
      progress: percent / 100,
      ...(label === undefined ? {} : { label }),
    })
    void this.#env.repo.setProgress(running.job.id, percent, label)
  }

  async #succeed(running: RunningJob): Promise<void> {
    this.#completed += 1
    this.#completions.push(this.#env.monotonic())
    await this.#apply(running.job.id, {
      state: 'succeeded',
      progress: 100,
      finishedAt: this.#env.now(),
      lastError: null,
      lockOwner: null,
    })
  }

  async #settleFailure(running: RunningJob, error: unknown): Promise<void> {
    if (running.interrupted) {
      // `stop()` pulled the rug out; this is not the job's fault and costs no attempt.
      await this.#apply(running.job.id, { state: 'queued', startedAt: null, lockOwner: null })
      return
    }
    const attempts = running.job.attempts + 1
    const at = this.#env.now()
    const disposition = classifyFailure(error, attempts, running.job.maxAttempts)
    if (disposition === 'cancelled') {
      await this.#apply(running.job.id, {
        state: 'cancelled',
        finishedAt: at,
        lockOwner: null,
      })
      return
    }

    const lastError = toJobError(error, at)
    if (disposition === 'retry') {
      const delay = backoffDelayMs(attempts, this.#backoff, this.#env.random)
      await this.#apply(running.job.id, {
        state: 'queued',
        attempts,
        lastError,
        startedAt: null,
        lockOwner: null,
        nextRunAt: this.#at(at + delay),
      })
      this.#wakeIn(delay)
      return
    }

    this.#failed += 1
    await this.#apply(running.job.id, {
      state: disposition === 'failed' ? 'failed' : 'quarantined',
      attempts,
      lastError,
      finishedAt: at,
      lockOwner: null,
    })
  }

  #release(running: RunningJob): void {
    this.#inFlight.delete(running.job.id)
    const lock = this.#locks.get(running.job.type)
    if (lock !== undefined) {
      this.#locks.delete(running.job.type)
      lock.release()
    }
    this.#wake()
  }

  /* ── Crash recovery ──────────────────────────────────────────────────────── */

  /**
   * Adopt jobs a dead tab left marked `running`.
   *
   * Web Locks are the liveness signal: a lock dies with the tab that held it, so a
   * type whose lock we can take has nobody working on it, whatever its rows claim.
   * The attempt counter goes up, because a job that reliably takes the tab down
   * with it must eventually be quarantined instead of crashing every future tab.
   */
  async #recover(): Promise<void> {
    const orphans = await this.#env.repo.listByState('running')
    const byType = new Map<JobType, Job[]>()
    for (const job of orphans) {
      const group = byType.get(job.type) ?? []
      group.push(job)
      byType.set(job.type, group)
    }

    for (const [type, group] of byType) {
      const lock = await this.#env.locks.acquire(this.#lockName(type))
      if (lock === null) continue
      try {
        for (const job of group) {
          const attempts = job.attempts + 1
          const at = this.#env.now()
          if (attempts >= job.maxAttempts) {
            await this.#apply(job.id, {
              state: 'quarantined',
              attempts,
              finishedAt: at,
              lockOwner: null,
              lastError: {
                message: 'Interrupted before it finished, too many times',
                code: 'interrupted',
                occurredAt: at,
              },
            })
            continue
          }
          await this.#apply(job.id, {
            state: 'queued',
            attempts,
            startedAt: null,
            lockOwner: null,
            nextRunAt: this.#at(at + backoffDelayMs(attempts, this.#backoff, this.#env.random)),
          })
        }
      } finally {
        lock.release()
      }
    }
    this.#wake()
  }

  /* ── Fan-out ─────────────────────────────────────────────────────────────── */

  #onBroadcast(message: JobBroadcast): void {
    if (message.origin === this.#owner) return
    switch (message.kind) {
      case 'cancel': {
        // Only the tab whose handler is running can honour it; the others do nothing.
        this.#inFlight.get(message.id)?.controller.abort()
        return
      }
      case 'progress': {
        this.#notify(
          message.label === undefined
            ? { id: message.id, state: message.state, progress: message.progress }
            : {
                id: message.id,
                state: message.state,
                progress: message.progress,
                label: message.label,
              },
        )
        // A job that just finished elsewhere freed its lock, so there may be work now.
        if (message.state !== 'running') this.#wake()
        return
      }
      case 'wake': {
        this.#wake()
        return
      }
    }
  }

  #notify(snapshot: JobProgress): void {
    const observers = this.#observers.get(snapshot.id)
    if (observers === undefined) return
    for (const observer of [...observers]) {
      try {
        observer(snapshot)
      } catch (error: unknown) {
        console.error('jobs: an observer threw', error)
      }
    }
  }

  #publish(job: Job): void {
    const snapshot = toProgress(job)
    this.#notify(snapshot)
    this.#env.channel.post({
      kind: 'progress',
      origin: this.#owner,
      id: job.id,
      type: job.type,
      state: snapshot.state,
      progress: snapshot.progress,
      ...(snapshot.label === undefined ? {} : { label: snapshot.label }),
    })
  }

  async #emitCurrent(id: JobId, observer: JobObserver, live: () => boolean): Promise<void> {
    const job = await this.#env.repo.get(id)
    if (job === undefined || !live()) return
    observer(toProgress(job))
  }

  async #apply(id: JobId, patch: Partial<Job>): Promise<Job | undefined> {
    const result = await this.#env.repo.update(id, patch)
    if (!result.ok) {
      console.error('jobs: could not update a job row', result.error.message)
      return undefined
    }
    this.#publish(result.value)
    return result.value
  }

  /** Why here: a backoff target is the only number this file turns into a `Timestamp`. */
  #at(value: number): Timestamp {
    return toTimestamp(Math.max(0, Math.round(value)))
  }
}

/** Why a factory: tests build a queue on a fake environment; the app has one singleton. */
export function createJobQueue(env: JobsEnvironment, options: JobQueueOptions = {}): JobQueue {
  return new DurableJobQueue(env, options)
}
