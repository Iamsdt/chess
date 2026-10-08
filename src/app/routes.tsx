import { createRootRoute, createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { RootDocument, ShellLayout, ShellNotFound } from './layouts'
import { importLazy } from './lazy-import'
import { ComingSoonPage } from './pages/coming-soon-page'
import { PlaceholderPage } from './pages/placeholder-page'
import { RouteErrorPage } from './pages/route-error-page'
import { SCREEN_COMPONENTS } from './screen-components'
import { SCREENS, type Screen, type ScreenId } from './screens'

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

/** The component a screen renders: "coming soon" if held back, its feature's, or the
 *  "not built yet" placeholder. */
function componentFor(id: ScreenId) {
  const screen: Screen = SCREENS[id]
  if (screen.comingSoon === true) {
    return function ScreenComingSoon() {
      return <ComingSoonPage screen={screen} />
    }
  }
  function ScreenPlaceholder() {
    return <PlaceholderPage screen={screen} />
  }
  // A feature sprint claims its screen in `SCREEN_COMPONENTS`; until then the placeholder
  // stands in, so the route table never waits on a feature to exist.
  return SCREEN_COMPONENTS[id] ?? ScreenPlaceholder
}

/**
 * One placeholder route per prototype screen. The path is passed alongside the id, and
 * typed as that screen's own path, so this file reads as the route table while the
 * compiler keeps it in step with `SCREENS` and `<Link to>` stays checked.
 */
function screenRoute<Id extends ScreenId>(id: Id, path: (typeof SCREENS)[Id]['path']) {
  return createRoute({ getParentRoute: () => shellRoute, path, component: componentFor(id) })
}

/** `/learn/lesson?id=…` — which lesson to open. Anything else in the query is ignored. */
function lessonSearch(search: Record<string, unknown>): { id?: string } {
  return typeof search.id === 'string' && search.id !== '' ? { id: search.id } : {}
}

/** `/games/review?id=…` — which game to review. */
function reviewSearch(search: Record<string, unknown>): { id?: string } {
  return typeof search.id === 'string' && search.id !== '' ? { id: search.id } : {}
}

const reviewRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: SCREENS.review.path,
  component: componentFor('review'),
  validateSearch: reviewSearch,
})

const lessonRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: SCREENS.lesson.path,
  component: componentFor('lesson'),
  validateSearch: lessonSearch,
})

const shellRoutes = [
  screenRoute('today', '/'),
  screenRoute('play-setup', '/play'),
  screenRoute('play-game', '/play/game'),
  screenRoute('puzzles', '/puzzles'),
  screenRoute('puzzle', '/puzzles/solve'),
  screenRoute('puzzle-rush', '/puzzles/rush'),
  screenRoute('session-summary', '/puzzles/summary'),
  screenRoute('learn', '/learn'),
  lessonRoute,
  screenRoute('endgames', '/drills/endgames'),
  screenRoute('vision', '/drills/vision'),
  screenRoute('mistakes', '/mistakes'),
  screenRoute('games', '/games'),
  reviewRoute,
  screenRoute('analysis', '/analysis'),
  screenRoute('openings', '/openings'),
  screenRoute('opening-drill', '/openings/drill'),
  screenRoute('friends', '/friends'),
  screenRoute('live', '/friends/live'),
  screenRoute('share', '/share'),
  screenRoute('progress', '/progress'),
  screenRoute('settings', '/settings'),
] as const

/** Onboarding has no shell in the prototype: the first run owns the whole window. */
const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: SCREENS.onboarding.path,
  component: componentFor('onboarding'),
})

/** The S02 design-system gallery. Loaded on demand: it renders every component twice and
 *  has no business in the bundle a player downloads. */
const kitchenSinkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/kitchen-sink',
  component: lazyRouteComponent(() => importLazy(() => import('@/design/dev')), 'KitchenSink'),
})

/** S11's queue inspector. Bare and lazy for the same reasons as the kitchen sink. */
const jobsDevRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/jobs',
  component: lazyRouteComponent(() => importLazy(() => import('@/jobs/dev-panel')), 'JobsDevPanel'),
})

/** Sage feature preview: every planned feature with a button that demos it on the mock. */
const sageLabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/sage',
  component: lazyRouteComponent(() => importLazy(() => import('@/coach/dev')), 'SageLab'),
})

export const routeTree = rootRoute.addChildren([
  shellRoute.addChildren(shellRoutes),
  onboardingRoute,
  kitchenSinkRoute,
  jobsDevRoute,
  sageLabRoute,
])
