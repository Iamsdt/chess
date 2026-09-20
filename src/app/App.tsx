import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'

import { ThemeProvider, Toaster, TooltipProvider } from '@/design'

import { router } from './router'

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
          <RouterProvider router={router} />
        </TooltipProvider>
        <Toaster position="bottom-center" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
