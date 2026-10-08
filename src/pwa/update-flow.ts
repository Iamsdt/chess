/**
 * The update lifecycle as a small state machine, separate from the browser APIs that drive
 * it, so "does a first install nag the player?" and "does the page reload only when asked?"
 * are tests rather than things to check by hand.
 */

export type UpdatePhase =
  | 'unsupported'
  /** Nothing to report. */
  | 'idle'
  /** First install finished: the app now works offline. Not an update. */
  | 'offline-ready'
  /** A newer worker is downloading its files. */
  | 'installing'
  /** A newer worker is waiting for the player to accept it. */
  | 'ready'
  /** The player accepted; waiting for the new worker to take control. */
  | 'applying'

export interface UpdateState {
  readonly phase: UpdatePhase
  /** Set exactly when the page should reload now. */
  readonly reload: boolean
}

export type UpdateEvent =
  | { readonly type: 'unsupported' }
  | { readonly type: 'update-found' }
  /** `hadController`: the page was already controlled, so this is an update, not a first install. */
  | { readonly type: 'worker-installed'; readonly hadController: boolean }
  | { readonly type: 'apply' }
  | { readonly type: 'controller-changed' }
  | { readonly type: 'dismiss' }

export const INITIAL_UPDATE_STATE: UpdateState = { phase: 'idle', reload: false }

export function reduceUpdate(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.type) {
    case 'unsupported':
      return { phase: 'unsupported', reload: false }
    case 'update-found':
      // Never downgrade "ready" to "installing" because the browser re-checked.
      return state.phase === 'ready' || state.phase === 'applying'
        ? state
        : { phase: 'installing', reload: false }
    case 'worker-installed':
      if (state.phase === 'applying') return state
      return { phase: event.hadController ? 'ready' : 'offline-ready', reload: false }
    case 'apply':
      return state.phase === 'ready' ? { phase: 'applying', reload: false } : state
    case 'controller-changed':
      // The first install claims clients too; only an accepted update may reload the page.
      return state.phase === 'applying' ? { phase: 'idle', reload: true } : state
    case 'dismiss':
      return state.phase === 'offline-ready' ? { phase: 'idle', reload: false } : state
  }
}
