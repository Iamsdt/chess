import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { ThemeProvider } from '@/design'

import { MistakesScreen } from './mistakes-screen'

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

const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

function renderMistakesScreen() {
  const rootRoute = createRootRoute()
  const mistakesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/mistakes',
    component: MistakesScreen,
  })
  const solveRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/puzzles/solve',
    component: () => <div>Solver</div>,
  })

  const routeTree = rootRoute.addChildren([mistakesRoute, solveRoute])
  const history = createMemoryHistory({ initialEntries: ['/mistakes'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('MistakesScreen', () => {
  it('renders heading with accessible name "Mistake Bank"', async () => {
    renderMistakesScreen()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mistake Bank' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Ideas you missed, coming back/i)).toBeInTheDocument()
  })

  it('renders the Due Today hero card and schedule strip', async () => {
    renderMistakesScreen()
    expect(await screen.findByRole('heading', { level: 2, name: /due today/i })).toBeInTheDocument()
    expect(screen.getByText('Coming up')).toBeInTheDocument()
    expect(screen.getAllByText('Tomorrow').length).toBeGreaterThan(0)
    expect(screen.getAllByText('In 3 days').length).toBeGreaterThan(0)
    expect(screen.getByText('This week')).toBeInTheDocument()
  })

  it('renders the mastery pipeline from missed to mastered', async () => {
    renderMistakesScreen()
    expect(
      await screen.findByRole('heading', { level: 2, name: /From missed to mastered/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Not tried yet')).toBeInTheDocument()
    expect(screen.getByText('Back in 1 to 3 days')).toBeInTheDocument()
    expect(screen.getByText('Back in 7 to 21 days')).toBeInTheDocument()
    expect(screen.getByText('Recalled 3 times in a row')).toBeInTheDocument()
  })

  it('renders theme chips and filters positions', async () => {
    renderMistakesScreen()
    expect(await screen.findByRole('button', { name: /Forks · 14/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pins · 9/i })).toBeInTheDocument()

    // Filter by Pins
    fireEvent.click(screen.getByRole('button', { name: /Pins · 9/i }))
    expect(screen.getByText(/vs Stockfish 1000 · move 4 · you're Black/i)).toBeInTheDocument()
  })

  it('toggles explanation reveal on card', async () => {
    renderMistakesScreen()
    const revealButtons = await screen.findAllByRole('button', {
      name: /Reveal the better idea/i,
    })
    expect(revealButtons.length).toBeGreaterThan(0)

    // Initially shows prompt
    expect(screen.getAllByText(/Reveal after you try/i).length).toBeGreaterThan(0)

    // Click to reveal
    fireEvent.click(revealButtons[0]!)
    expect(
      await screen.findByText(/Your queen and king were a knight-jump apart/i),
    ).toBeInTheDocument()
  })

  it('passes accessibility audit', async () => {
    const { container } = renderMistakesScreen()
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Mistake Bank' })).toBeInTheDocument()
    })
    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})
