import { useRouterState } from '@tanstack/react-router'

import { screenByPath, type Screen } from './screens'

/** The screen behind the current URL, or `undefined` on a path the router does not serve. */
export function useCurrentScreen(): Screen | undefined {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return screenByPath(pathname)
}
