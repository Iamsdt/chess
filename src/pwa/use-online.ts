import { useSyncExternalStore } from 'react'

/**
 * Whether the browser believes it has a network.
 *
 * `navigator.onLine` only proves the *absence* of a connection (true can still mean a dead
 * captive portal), so treat `false` as certain and `true` as "worth trying". Online-only
 * features should still handle a failed request.
 */
function subscribe(listener: () => void): () => void {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

const getSnapshot = (): boolean => navigator.onLine
const getServerSnapshot = (): boolean => true

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
