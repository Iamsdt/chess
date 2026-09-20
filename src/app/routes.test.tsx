import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/design'

import { routeTree } from './routes'
import { SCREENS, SCREEN_LIST } from './screens'

/** jsdom has no layout engine, so the few browser APIs the routed components reach for
 *  have to be stubbed. The gallery route mounts every Radix primitive at once. */
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      // Nothing is ever laid out in jsdom, so there is nothing to report.
    }
    unobserve(): void {
      // Nothing is ever laid out in jsdom, so there is nothing to report.
    }
    disconnect(): void {
      // Nothing is ever laid out in jsdom, so there is nothing to report.
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    // No viewport in jsdom.
  }
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {
    // The router restores scroll on navigation; jsdom has nothing to scroll.
  })
})

/** A fresh router per test so navigation in one case cannot leak into the next. */
async function renderRoute(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
  await waitFor(() => {
    expect(router.state.status).toBe('idle')
  })
  return router
}

const routableScreens = SCREEN_LIST.map((entry) => [entry.path, entry.title] as const)

describe('route table', () => {
  it.each(routableScreens)('serves %s as "%s"', async (path, title) => {
    await renderRoute(path)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible()
  })

  it('titles the browser tab after the screen', async () => {
    await renderRoute(SCREENS.mistakes.path)
    await waitFor(() => {
      expect(document.title).toBe('Mistake Bank · Chess King')
    })
  })

  it('answers an unrouted URL with the 404 inside the shell', async () => {
    await renderRoute('/does/not/exist')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'That page is not here' }),
    ).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  it('marks the sidebar entry that owns the current screen', async () => {
    await renderRoute(SCREENS.puzzle.path)
    expect(screen.getByRole('link', { name: /^Puzzles/ })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps the design-system gallery outside the shell', async () => {
    await renderRoute(SCREENS['kitchen-sink'].path)
    expect(await screen.findByRole('heading', { level: 1, name: 'Kitchen sink' })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
  })

  it('gives onboarding the whole window, as the prototype does', async () => {
    await renderRoute(SCREENS.onboarding.path)
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Chat with Sage' })).not.toBeInTheDocument()
  })
})
