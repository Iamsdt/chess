import { createRouter } from '@tanstack/react-router'

import { RouteErrorPage } from './pages/route-error-page'
import { RoutePending } from './pages/route-pending'
import { routeTree } from './routes'

/** The single router instance. Created at module scope so `<Link>` types resolve against
 *  it everywhere through the `Register` augmentation below. */
export const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteErrorPage,
  defaultPendingComponent: RoutePending,
  // Warm a route as soon as the pointer or keyboard commits to it; the lazy dev route is
  // the only chunk this actually fetches today, and it keeps the palette feeling instant.
  defaultPreload: 'intent',
  // The page scrolls inside `<main>`, not the window, so the router has to be told where
  // to look — otherwise a long screen hands its scroll position to the next one.
  scrollRestoration: true,
  scrollToTopSelectors: ['main'],
})

declare module '@tanstack/router-core' {
  interface Register {
    router: typeof router
  }
}
