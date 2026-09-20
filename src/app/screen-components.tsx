import { lazyRouteComponent } from '@tanstack/react-router'

import { importLazy } from './lazy-import'

import type { ScreenId } from './screens'
import type { FunctionComponent } from 'react'

/**
 * Where a screen's real component comes from, when it has one.
 *
 * Routing is S04's and every feature is its own sprint's, so this table is the seam
 * between them: a feature sprint fills in its own folder and never edits the route table.
 * Screens absent from this map fall back to the "not built yet" placeholder.
 *
 * Every entry is lazy, so a route's code is fetched when it is first visited rather than
 * added to the first download — which is what keeps the §5 budget honest as features land.
 */
export const SCREEN_COMPONENTS: Partial<Record<ScreenId, FunctionComponent>> = {
  'play-setup': lazyRouteComponent(
    () => importLazy(() => import('@/features/play')),
    'PlaySetupScreen',
  ),
  'play-game': lazyRouteComponent(
    () => importLazy(() => import('@/features/play')),
    'PlayGameScreen',
  ),
  puzzles: lazyRouteComponent(
    () => importLazy(() => import('@/features/puzzles')),
    'PuzzlesHubScreen',
  ),
  puzzle: lazyRouteComponent(
    () => importLazy(() => import('@/features/puzzles')),
    'PuzzleSolverScreen',
  ),
  'puzzle-rush': lazyRouteComponent(
    () => importLazy(() => import('@/features/puzzles')),
    'PuzzleRushScreen',
  ),
  'session-summary': lazyRouteComponent(
    () => importLazy(() => import('@/features/puzzles')),
    'SessionSummaryScreen',
  ),
  analysis: lazyRouteComponent(
    () => importLazy(() => import('@/features/analysis')),
    'AnalysisScreen',
  ),
  games: lazyRouteComponent(
    () => importLazy(() => import('@/features/library')),
    'GamesLibraryScreen',
  ),
}
