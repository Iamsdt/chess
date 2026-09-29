import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { ThemeProvider } from '@/design'

import { ReviewScreen } from './review-screen'

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

function renderReviewScreen() {
  const rootRoute = createRootRoute()
  const reviewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/games/review',
    component: ReviewScreen,
  })
  const gamesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/games',
    component: () => <div>Games Library</div>,
  })
  const analysisRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/analysis',
    component: () => <div>Analysis Board</div>,
  })

  const routeTree = rootRoute.addChildren([reviewRoute, gamesRoute, analysisRoute])
  const history = createMemoryHistory({ initialEntries: ['/games/review'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('ReviewScreen', () => {
  it('renders the game review heading and player info', async () => {
    renderReviewScreen()

    const heading = await screen.findByRole('heading', { name: 'Game review' })
    expect(heading).toBeInTheDocument()

    expect(screen.getAllByText(/Stockfish/i).length).toBeGreaterThan(0)
    expect(screen.getByText('84')).toBeInTheDocument()
    expect(screen.getByText('77')).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderReviewScreen()
    await screen.findByRole('heading', { name: 'Game review' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('switches between Summary, Key moments, and Moves tabs', async () => {
    renderReviewScreen()
    await screen.findByRole('heading', { name: 'Game review' })

    // Default tab is Summary
    expect(screen.getByText(/accuracy · \+6 vs your average/i)).toBeInTheDocument()

    // Switch to Key moments tab
    const keyTab = screen.getByRole('tab', { name: /Key moments/i })
    fireEvent.click(keyTab)
    expect(screen.getAllByText(/15\.d4!/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/14\.Nxe5/).length).toBeGreaterThan(0)

    // Switch to Moves tab
    const movesTab = screen.getByRole('tab', { name: /Moves/i })
    fireEvent.click(movesTab)
    expect(screen.getByText(/1–0 · Stockfish 1200 resigned/i)).toBeInTheDocument()
  })

  it('allows selecting key moments to inspect move explanation', async () => {
    renderReviewScreen()
    await screen.findByRole('heading', { name: 'Game review' })

    // Go to Key moments tab
    const keyTab = screen.getByRole('tab', { name: /Key moments/i })
    fireEvent.click(keyTab)

    // Click on first View board button
    const viewButtons = screen.getAllByRole('button', { name: /View board/i })
    expect(viewButtons.length).toBeGreaterThan(0)
    fireEvent.click(viewButtons[0]!)

    // Verify explanation is present
    expect(screen.getByText(/The idea you missed: b7 was loose/i)).toBeInTheDocument()
  })

  it('supports move navigation stepping controls', async () => {
    renderReviewScreen()
    await screen.findByRole('heading', { name: 'Game review' })

    const nextBtn = screen.getByRole('button', { name: 'Next move' })
    const prevBtn = screen.getByRole('button', { name: 'Previous move' })
    const firstBtn = screen.getByRole('button', { name: 'First move' })
    const lastBtn = screen.getByRole('button', { name: 'Last move' })

    fireEvent.click(nextBtn)
    fireEvent.click(prevBtn)
    fireEvent.click(firstBtn)
    fireEvent.click(lastBtn)
  })

  it('allows flipping board orientation and copying PGN', async () => {
    renderReviewScreen()
    await screen.findByRole('heading', { name: 'Game review' })

    const flipBtn = screen.getByRole('button', { name: /flip/i })
    fireEvent.click(flipBtn)

    const copyBtn = screen.getByRole('button', { name: 'Copy PGN' })
    fireEvent.click(copyBtn)
  })
})
