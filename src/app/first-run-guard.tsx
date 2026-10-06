import { useEffect } from 'react'

import { useHasProfile } from '@/data'

import { router as appRouter } from './router'

/** Set once the person has been shown setup, so skipping it is respected from then on. */
export const SETUP_PROMPTED_KEY = 'ck-setup-prompted'

/** Screens that must open as linked, even on a first visit: a shared challenge is the point
 *  of the link, and the dev tools are for developers. */
const EXEMPT_PREFIXES = ['/onboarding', '/share', '/dev'] as const

function alreadyPrompted(): boolean {
  try {
    return localStorage.getItem(SETUP_PROMPTED_KEY) === '1'
  } catch {
    // Storage blocked: prompt at most once per page load instead of on every render.
    return false
  }
}

function markPrompted(): void {
  try {
    localStorage.setItem(SETUP_PROMPTED_KEY, '1')
  } catch {
    // See above; the effect below only runs once per load anyway.
  }
}

/**
 * Sends a brand-new browser to first-run setup, once.
 *
 * "New" means there is no profile row. Once is a promise to the user: if they leave setup
 * without finishing, the app opens normally from then on and Settings can replay it.
 * Loaded on demand, because it reads the database and the first download should not.
 */
export function FirstRunGuard({ router = appRouter }: { readonly router?: typeof appRouter }) {
  const hasProfile = useHasProfile()

  useEffect(() => {
    if (hasProfile !== false || alreadyPrompted()) return
    const path = router.state.location.pathname
    if (EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) return
    markPrompted()
    void router.navigate({ to: '/onboarding', replace: true })
  }, [hasProfile, router])

  return null
}
