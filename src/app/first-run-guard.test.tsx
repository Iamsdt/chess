import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearAllData, profileRepo } from '@/data'
import { ThemeProvider } from '@/design'
import { createProfile } from '@/domain'

import { FirstRunGuard, SETUP_PROMPTED_KEY } from './first-run-guard'

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      // Nothing is ever laid out in jsdom.
    }
    unobserve(): void {
      // See above.
    }
    disconnect(): void {
      // See above.
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    // No viewport in jsdom.
  }
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

/** A small router with the paths the guard cares about, so each test controls where it starts. */
function renderGuard(startPath: string) {
  const root = createRootRoute()
  const paths = ['/', '/puzzles', '/share', '/onboarding']
  const routeTree = root.addChildren(
    paths.map((path) =>
      createRoute({ getParentRoute: () => root, path, component: () => <div>{path}</div> }),
    ),
  )
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [startPath] }),
  })
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
      <FirstRunGuard router={router as never} />
    </ThemeProvider>,
  )
  return router
}

/** The guard decides after a database read, so give it time before saying "it did nothing". */
async function stays(router: ReturnType<typeof renderGuard>, path: string) {
  await new Promise((resolve) => setTimeout(resolve, 200))
  expect(router.state.location.pathname).toBe(path)
}

describe('FirstRunGuard', () => {
  beforeEach(async () => {
    await clearAllData()
    localStorage.clear()
  })

  it('sends a browser with no profile to onboarding, once', async () => {
    const router = renderGuard('/')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/onboarding')
    })
    expect(localStorage.getItem(SETUP_PROMPTED_KEY)).toBe('1')
  })

  it('leaves someone alone who has already been shown setup and left', async () => {
    localStorage.setItem(SETUP_PROMPTED_KEY, '1')
    const router = renderGuard('/puzzles')
    await stays(router, '/puzzles')
  })

  it('does nothing once there is a profile', async () => {
    await profileRepo.save(
      createProfile({ displayName: 'Ada', skillLevel: 'club', timeZone: 'UTC' }),
    )
    const router = renderGuard('/puzzles')
    await stays(router, '/puzzles')
    expect(localStorage.getItem(SETUP_PROMPTED_KEY)).toBeNull()
  })

  it('opens a shared challenge as linked instead of hijacking it', async () => {
    const router = renderGuard('/share')
    await stays(router, '/share')
  })
})
