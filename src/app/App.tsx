import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import { ThemeProvider, Toaster, TooltipProvider } from '@/design'

import { AppearanceSync } from './appearance-sync'
import { router } from './router'
import { DesktopOnlyGate } from './shell/desktop-only-gate'

const FirstRunGuard = lazy(async () => ({
  default: (await import('./first-run-guard')).FirstRunGuard,
}))

/** One client for the whole app. Worker calls (engine, import, analysis) are the async
 *  boundary this exists for; feature sprints add the queries. */
const queryClient = new QueryClient({
  defaultOptions: {
    // Local work — IndexedDB and workers — is cheap to repeat but never changes behind
    // our back, so refetching on window focus is pure noise here.
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
})

/** The application root: appearance, async cache, routing and the toast outlet. */
export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <DesktopOnlyGate>
            <AppearanceSync />
            <Suspense fallback={null}>
              <FirstRunGuard />
            </Suspense>
            <RouterProvider router={router} />
          </DesktopOnlyGate>
        </TooltipProvider>
        <Toaster position="bottom-center" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
