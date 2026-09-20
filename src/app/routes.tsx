import { createRootRoute, createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { OnboardingScreen, RootDocument, ShellLayout, ShellNotFound } from './layouts'
import { PlaceholderPage } from './pages/placeholder-page'
import { RouteErrorPage } from './pages/route-error-page'
import { SCREENS, type ScreenId } from './screens'

const rootRoute = createRootRoute({
  component: RootDocument,
  // The shell itself is what would have failed here, so this one renders without it.
  errorComponent: RouteErrorPage,
  notFoundComponent: ShellNotFound,
})

/** Pathless layout route: everything inside it gets the sidebar, bottom bar and Sage. */
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: ShellLayout,
})

/**
 * One placeholder route per prototype screen. The path is passed alongside the id, and
 * typed as that screen's own path, so this file reads as the route table while the
 * compiler keeps it in step with `SCREENS` and `<Link to>` stays checked.
 */
function screenRoute<Id extends ScreenId>(id: Id, path: (typeof SCREENS)[Id]['path']) {
  const screen = SCREENS[id]
  function ScreenPlaceholder() {
    return <PlaceholderPage screen={screen} />
  }
  return createRoute({ getParentRoute: () => shellRoute, path, component: ScreenPlaceholder })
}

const shellRoutes = [
  screenRoute('today', '/'),
  screenRoute('play-setup', '/play'),
  screenRoute('play-game', '/play/game'),
  screenRoute('puzzles', '/puzzles'),
  screenRoute('puzzle', '/puzzles/solve'),
  screenRoute('puzzle-rush', '/puzzles/rush'),
  screenRoute('session-summary', '/puzzles/summary'),
  screenRoute('learn', '/learn'),
  screenRoute('lesson', '/learn/lesson'),
  screenRoute('endgames', '/drills/endgames'),
  screenRoute('vision', '/drills/vision'),
  screenRoute('mistakes', '/mistakes'),
  screenRoute('games', '/games'),
  screenRoute('review', '/games/review'),
  screenRoute('analysis', '/analysis'),
  screenRoute('openings', '/openings'),
  screenRoute('opening-drill', '/openings/drill'),
  screenRoute('friends', '/friends'),
  screenRoute('live', '/friends/live'),
  screenRoute('share', '/share'),
  screenRoute('progress', '/progress'),
  screenRoute('settings', '/settings'),
] as const

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: OnboardingScreen,
})

/** The S02 design-system gallery. Loaded on demand: it renders every component twice and
 *  has no business in the bundle a player downloads. */
const kitchenSinkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/kitchen-sink',
  component: lazyRouteComponent(() => import('@/design/dev'), 'KitchenSink'),
})

export const routeTree = rootRoute.addChildren([
  shellRoute.addChildren(shellRoutes),
  onboardingRoute,
  kitchenSinkRoute,
])
