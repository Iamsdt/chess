import { jobsRepo, newJobId } from '@/data'
import { now, parseValid } from '@/domain'

import { JOBS_CHANNEL_NAME, JobBroadcastSchema, type JobBroadcast } from './messages'

import type {
  IdleBudget,
  IdleScheduler,
  JobChannel,
  JobLock,
  JobLockManager,
  JobsEnvironment,
  PowerSource,
  RunConditions,
} from './seams'

/**
 * The real host APIs, behind the seams in `seams.ts`.
 *
 * Every non-standard global here is read through a locally declared interface that
 * `Navigator` is structurally assignable to, so feature detection costs neither a
 * cast nor an `any`: if the browser lacks the API, the property is simply absent
 * and the fallback below takes over.
 */

/**
 * Widen a global whose `lib.dom` type claims it is always present.
 *
 * Why a function and not an annotation: the compiler narrows `const x: T | undefined = g`
 * straight back to `T` from the initializer, which makes every honest feature check
 * look redundant to it. A call boundary keeps the union.
 */
function maybe<T>(value: T): T | undefined {
  return value
}

/** Below this, and not charging, counts as "the user wants their battery back". */
const LOW_BATTERY_LEVEL = 0.2
/** What a browser without `requestIdleCallback` pretends a slice is worth. */
const FALLBACK_BUDGET_MS = 5

/* ── Web Locks ─────────────────────────────────────────────────────────────── */

/**
 * The locks in-process fallback: a plain map.
 *
 * Why module scope: two `JobQueue` instances in one tab (the dev panel plus the app,
 * say) must still exclude each other. It cannot exclude a *second tab* — without
 * Web Locks nothing can — so a browser this old loses the two-tab guarantee and
 * keeps everything else.
 */
const localLocks = new Set<string>()

function createLocalLockManager(): JobLockManager {
  return {
    acquire(name: string): Promise<JobLock | null> {
      if (localLocks.has(name)) return Promise.resolve(null)
      localLocks.add(name)
      let released = false
      return Promise.resolve({
        release() {
          if (released) return
          released = true
          localLocks.delete(name)
        },
      })
    },
  }
}

function createWebLockManager(manager: LockManager): JobLockManager {
  return {
    acquire(name: string): Promise<JobLock | null> {
      return new Promise<JobLock | null>((resolve) => {
        // The lock is held for exactly as long as the callback's promise is pending,
        // so `release` is the resolver of a promise we keep open ourselves. It lives on
        // an object because a `let` assigned inside an executor reads as `null` to the
        // compiler's flow analysis.
        const holder: { settle: (() => void) | null } = { settle: null }
        const held = new Promise<void>((settle) => {
          holder.settle = settle
        })
        void manager
          .request(name, { ifAvailable: true }, (lock): Promise<void> => {
            const grant = holder.settle
            if (lock === null || grant === null) {
              resolve(null)
              return Promise.resolve()
            }
            let released = false
            resolve({
              release() {
                if (released) return
                released = true
                grant()
              },
            })
            return held
          })
          .catch(() => {
            // A rejected request means we never held it; behave as "someone else has it".
            resolve(null)
          })
      })
    },
  }
}

/** Why the local annotation: `lib.dom` types `navigator.locks` as always present. */
function lockManagerOrNull(): LockManager | null {
  return maybe(globalThis.navigator)?.locks ?? null
}

export function createBrowserLockManager(): JobLockManager {
  const manager = lockManagerOrNull()
  return manager === null ? createLocalLockManager() : createWebLockManager(manager)
}

/** Why exported: the dev panel says out loud which of the two is in use. */
export function hasWebLocks(): boolean {
  return lockManagerOrNull() !== null
}

/* ── BroadcastChannel ──────────────────────────────────────────────────────── */

/**
 * A lazily opened channel: constructing it is a side effect, and importing
 * `@/jobs` must not have side effects.
 */
export function createBrowserChannel(name: string = JOBS_CHANNEL_NAME): JobChannel {
  const listeners = new Set<(message: JobBroadcast) => void>()
  let channel: BroadcastChannel | null = null
  let closed = false

  function handle(event: MessageEvent<unknown>): void {
    const parsed = parseValid(JobBroadcastSchema, event.data, 'jobs broadcast')
    if (!parsed.ok) return
    for (const listener of [...listeners]) listener(parsed.value)
  }

  function ensure(): BroadcastChannel | null {
    if (closed) return null
    if (channel !== null) return channel
    const Constructor = maybe(globalThis.BroadcastChannel)
    if (Constructor === undefined) return null
    const opened = new Constructor(name)
    opened.addEventListener('message', handle)
    channel = opened
    return opened
  }

  return {
    post(message) {
      ensure()?.postMessage(message)
    },
    subscribe(listener) {
      ensure()
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    close() {
      closed = true
      listeners.clear()
      if (channel === null) return
      channel.removeEventListener('message', handle)
      channel.close()
      channel = null
    },
  }
}

/** Why exported: `/dev/jobs` reports honestly when other tabs cannot be reached. */
export function hasBroadcastChannel(): boolean {
  return maybe(globalThis.BroadcastChannel) !== undefined
}

/* ── Idle scheduling ───────────────────────────────────────────────────────── */

export function createBrowserIdleScheduler(): IdleScheduler {
  const requestIdle = maybe(globalThis.requestIdleCallback)
  const cancelIdle = maybe(globalThis.cancelIdleCallback)

  return {
    schedule(task: (budget: IdleBudget) => void, timeoutMs: number): () => void {
      if (requestIdle === undefined || cancelIdle === undefined) {
        const handle = globalThis.setTimeout(() => {
          task({ timeRemaining: () => FALLBACK_BUDGET_MS })
        }, 0)
        return () => {
          globalThis.clearTimeout(handle)
        }
      }
      const handle = requestIdle(
        (deadline) => {
          task({ timeRemaining: () => deadline.timeRemaining() })
        },
        { timeout: timeoutMs },
      )
      return () => {
        cancelIdle(handle)
      }
    },
    delay(ms: number, task: () => void): () => void {
      const handle = globalThis.setTimeout(task, ms)
      return () => {
        globalThis.clearTimeout(handle)
      }
    },
  }
}

/* ── Input pressure ────────────────────────────────────────────────────────── */

interface SchedulingLike {
  readonly isInputPending?: (options?: { includeContinuous?: boolean }) => boolean
}

/**
 * Why `userAgent` is in here: a type whose properties are all optional is a "weak
 * type", and `Navigator` would not be assignable to it. One property `Navigator`
 * really has turns the shape into an ordinary structural match, which is what makes
 * reading a non-standard global cost neither a cast nor an `any`.
 */
interface SchedulingNavigator {
  readonly userAgent: string
  readonly scheduling?: SchedulingLike
}

/**
 * `navigator.scheduling.isInputPending()` where it exists, `false` where it does not.
 *
 * Why `false` and not `true` as the fallback: a browser without it still has the
 * idle callback (or the timeout fallback) keeping slices short, and answering
 * "input is pending" for ever would stop the queue dead.
 */
export function createBrowserInputProbe(): () => boolean {
  const scheduling = maybe<SchedulingNavigator>(globalThis.navigator)?.scheduling
  // Called through the object so the method keeps its receiver.
  return () => scheduling?.isInputPending?.() ?? false
}

/* ── Visibility and battery ────────────────────────────────────────────────── */

interface BatteryLike {
  readonly charging: boolean
  readonly level: number
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

interface PowerNavigator {
  readonly userAgent: string
  readonly getBattery?: () => Promise<BatteryLike>
  readonly connection?: { readonly saveData?: boolean }
}

export function createBrowserPowerSource(): PowerSource {
  const listeners = new Set<(conditions: RunConditions) => void>()
  let battery: BatteryLike | null = null
  let attached = false

  function compute(): RunConditions {
    const doc = maybe(globalThis.document)
    const nav = maybe<PowerNavigator>(globalThis.navigator)
    const saveData = nav?.connection?.saveData === true
    const lowBattery = battery !== null && !battery.charging && battery.level <= LOW_BATTERY_LEVEL
    return {
      hidden: doc?.visibilityState === 'hidden',
      batterySaver: saveData || lowBattery,
    }
  }

  function refresh(): void {
    const next = compute()
    for (const listener of [...listeners]) listener(next)
  }

  function attach(): void {
    if (attached) return
    attached = true
    const doc = maybe(globalThis.document)
    doc?.addEventListener('visibilitychange', refresh)
    const nav = maybe<PowerNavigator>(globalThis.navigator)
    const request = nav?.getBattery?.()
    if (request === undefined) return
    void request
      .then((value) => {
        battery = value
        value.addEventListener('chargingchange', refresh)
        value.addEventListener('levelchange', refresh)
        refresh()
      })
      .catch(() => {
        battery = null
      })
  }

  return {
    read: compute,
    subscribe(listener) {
      attach()
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/* ── The whole environment ─────────────────────────────────────────────────── */

/**
 * The app's environment: S05's repository plus the five host APIs above.
 *
 * Nothing here opens a database, a channel or an event listener — the queue does
 * that when it starts — so building it at module load stays free.
 */
export function createBrowserEnvironment(): JobsEnvironment {
  return {
    repo: jobsRepo,
    locks: createBrowserLockManager(),
    channel: createBrowserChannel(),
    idle: createBrowserIdleScheduler(),
    power: createBrowserPowerSource(),
    isInputPending: createBrowserInputProbe(),
    now,
    monotonic: () => performance.now(),
    newJobId,
    random: Math.random,
  }
}
