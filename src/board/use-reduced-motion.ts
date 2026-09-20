import { useCallback, useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function mediaQuery(): MediaQueryList | null {
  if (typeof globalThis.matchMedia !== 'function') return null
  try {
    return globalThis.matchMedia(QUERY)
  } catch {
    // Some embedded webviews reject unknown queries; treat it as "no preference".
    return null
  }
}

/**
 * Whether the user has asked the system for less motion.
 *
 * Why the board reads it in JS rather than leaving it to a CSS media query: the
 * slide animation is driven imperatively (a FLIP transform written straight to
 * the element), so the preference has to be a value the code can branch on, not
 * just a rule the stylesheet can override.
 */
export function useReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const query = mediaQuery()
    if (!query) return () => undefined
    query.addEventListener('change', onChange)
    return () => {
      query.removeEventListener('change', onChange)
    }
  }, [])

  return useSyncExternalStore(
    subscribe,
    () => mediaQuery()?.matches ?? false,
    () => false,
  )
}
