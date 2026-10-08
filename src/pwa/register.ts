import { SKIP_WAITING_MESSAGE } from './sw-routing'
import {
  INITIAL_UPDATE_STATE,
  reduceUpdate,
  type UpdateEvent,
  type UpdateState,
} from './update-flow'

/**
 * Registers the service worker and publishes its update state as a tiny external store
 * (`subscribe` / `getUpdateState`) that `useUpdateState` reads.
 */

const CHECK_INTERVAL_MS = 60 * 60 * 1000

let state: UpdateState = INITIAL_UPDATE_STATE
let registration: ServiceWorkerRegistration | null = null
let started = false
const listeners = new Set<() => void>()

function dispatch(event: UpdateEvent): void {
  const next = reduceUpdate(state, event)
  if (next === state) return
  state = next
  for (const listener of listeners) listener()
  if (next.reload) window.location.reload()
}

export const dispatchUpdateEvent = dispatch

export function subscribeUpdateState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getUpdateState = (): UpdateState => state

/** Asks the waiting worker to take over; the page reloads once it does. */
export function applyUpdate(): void {
  const waiting = registration?.waiting
  if (!waiting) return
  dispatch({ type: 'apply' })
  waiting.postMessage({ type: SKIP_WAITING_MESSAGE })
}

const watched = new WeakSet<ServiceWorker>()

function watch(worker: ServiceWorker): void {
  // `register()` and `updatefound` can both hand over the same installing worker.
  if (watched.has(worker)) return
  watched.add(worker)
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed') {
      dispatch({
        type: 'worker-installed',
        hadController: navigator.serviceWorker.controller !== null,
      })
    }
  })
}

/** Production only: a dev-time worker would serve stale modules and fight Vite's HMR. */
export function registerServiceWorker(): void {
  if (started) return
  started = true
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    dispatch({ type: 'unsupported' })
    return
  }

  const { serviceWorker } = navigator
  serviceWorker.addEventListener('controllerchange', () => {
    dispatch({ type: 'controller-changed' })
  })

  const register = async (): Promise<void> => {
    const next = await serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      updateViaCache: 'none',
    })
    registration = next
    if (next.waiting && serviceWorker.controller) {
      dispatch({ type: 'worker-installed', hadController: true })
    }
    if (next.installing) watch(next.installing)
    next.addEventListener('updatefound', () => {
      dispatch({ type: 'update-found' })
      if (next.installing) watch(next.installing)
    })

    const check = (): void => {
      next.update().catch(() => undefined)
    }
    window.setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  }

  const start = (): void => {
    register().catch(() => {
      // Registration can fail in private windows; the app works without it.
      dispatch({ type: 'unsupported' })
    })
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}
