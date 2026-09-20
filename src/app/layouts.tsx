import { Outlet } from '@tanstack/react-router'
import { lazy, Suspense, useEffect } from 'react'

import { importLazy } from './lazy-import'
import { NotFoundPage } from './pages/not-found-page'
import { PlaceholderPage } from './pages/placeholder-page'
import { NOT_FOUND_SCREEN, SCREENS } from './screens'
import { AppShell } from './shell'
import { useCurrentScreen } from './use-current-screen'
import { useDocumentTitle } from './use-document-title'

/**
 * Sage is a panel, not the page: pulling `@/coach` and its schemas into the first download
 * cost ~25 KB gzip before anything had asked for a conversation. Loading it on demand keeps
 * the initial route inside the §5 budget, and the panel opens fast enough that the fallback
 * is rarely seen.
 */
const importCoachSlot = () => importLazy(() => import('./shell/coach-slot'))

const CoachSlot = lazy(async () => {
  const module = await importCoachSlot()
  return { default: module.CoachSlot }
})

/** Fetch the panel while the browser is idle, so opening Sage never waits on a network
 *  round trip. Failure is silent on purpose: `lazy` will simply fetch it on demand. */
function usePrefetchCoach() {
  useEffect(() => {
    // A short timeout rather than `requestIdleCallback`: Safari only shipped the latter in
    // 17, and this is a prefetch — being a beat late costs nothing.
    const handle = window.setTimeout(() => {
      void importCoachSlot().catch(() => undefined)
    }, 200)
    return () => {
      window.clearTimeout(handle)
    }
  }, [])
}

/** Above every frame: owns nothing visual, just the tab title and the outermost outlet. */
export function RootDocument() {
  const screen = useCurrentScreen()
  useDocumentTitle(screen?.title)
  return <Outlet />
}

/** Everything inside the shell layout route: sidebar or bottom bar, page, Sage panel. */
export function ShellLayout() {
  const screen = useCurrentScreen()
  usePrefetchCoach()
  const resolved = screen ?? NOT_FOUND_SCREEN
  return (
    <AppShell
      screen={resolved}
      chat={
        <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
          <CoachSlot screen={resolved} />
        </Suspense>
      }
    >
      <Outlet />
    </AppShell>
  )
}

/** A URL nobody routed. Framed by the shell so a wrong link is a detour, not a dead end. */
export function ShellNotFound() {
  return (
    <AppShell screen={NOT_FOUND_SCREEN}>
      <NotFoundPage />
    </AppShell>
  )
}

/** Onboarding has no shell in the prototype: the first run owns the whole window. */
export function OnboardingScreen() {
  return (
    <main className="min-h-dvh overflow-auto">
      <PlaceholderPage screen={SCREENS.onboarding} />
    </main>
  )
}
