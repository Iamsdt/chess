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

import { OpeningDrillScreen } from './opening-drill-screen'

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

function renderOpeningDrillScreen() {
  const rootRoute = createRootRoute()
  const drillRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/openings/drill',
    component: OpeningDrillScreen,
  })
  const openingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/openings',
    component: () => <div>Openings Hub</div>,
  })
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: () => <div>Settings Screen</div>,
  })

  const routeTree = rootRoute.addChildren([drillRoute, openingsRoute, settingsRoute])
  const history = createMemoryHistory({ initialEntries: ['/openings/drill'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('OpeningDrillScreen', () => {
  it('renders heading with accessible name "Opening drill" and variation details', async () => {
    renderOpeningDrillScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Opening drill' })
    expect(heading).toBeInTheDocument()

    expect(screen.getByText(/Caro-Kann/i)).toBeInTheDocument()
    expect(screen.getByText(/Advance Variation/i)).toBeInTheDocument()
    expect(screen.getByText(/line 3 of 8/i)).toBeInTheDocument()
    expect(screen.getByText('Spaced review')).toBeInTheDocument()
    expect(screen.getByText('7 due today')).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderOpeningDrillScreen()
    await screen.findByRole('heading', { level: 1, name: 'Opening drill' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('renders player and opponent indicators, board, and line progress', async () => {
    renderOpeningDrillScreen()
    await screen.findByRole('heading', { level: 1, name: 'Opening drill' })

    expect(screen.getByText(/White/i)).toBeInTheDocument()
    expect(screen.getByText(/plays the book/i)).toBeInTheDocument()
    expect(screen.getByText('No clock')).toBeInTheDocument()

    expect(screen.getByText('SK')).toBeInTheDocument()
    expect(screen.getByText('· Black')).toBeInTheDocument()
    expect(screen.getByText('3…c5')).toBeInTheDocument()
    expect(screen.getByText('1.e4')).toBeInTheDocument()
    expect(screen.getByText('2.d4')).toBeInTheDocument()
    expect(screen.getAllByText('3.e5').length).toBeGreaterThanOrEqual(1)
  })

  it('renders feedback box and allows asking Sage', async () => {
    renderOpeningDrillScreen()
    await screen.findByRole('heading', { level: 1, name: 'Opening drill' })

    const statusElements = screen.getAllByRole('status')
    expect(statusElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/You played 3…c5/i)).toBeInTheDocument()
    expect(
      screen.getByText(/That's playable, but your repertoire move is 3…Bf5/i),
    ).toBeInTheDocument()

    const askSageBtn = screen.getByRole('button', { name: /Why …Bf5 here\?/i })
    expect(askSageBtn).toBeInTheDocument()
    fireEvent.click(askSageBtn)
  })

  it('renders Advance lines mastery list and allows selecting a line', async () => {
    renderOpeningDrillScreen()
    await screen.findByRole('heading', { level: 1, name: 'Opening drill' })

    expect(screen.getByText(/Advance lines · mastery/i)).toBeInTheDocument()
    expect(screen.getByText('4.Nc3 e6 5.g4 Bg6')).toBeInTheDocument()
    expect(screen.getByText('4.Nf3 e6 5.Be2 c5')).toBeInTheDocument()
    expect(screen.getByText('4.g4 Bd7')).toBeInTheDocument()

    // Click line 1
    const line1 = screen.getByText('4.Nc3 e6 5.g4 Bg6')
    fireEvent.click(line1)

    // Click line 3
    const line3 = screen.getByText('4.Nf3 e6 5.Be2 c5')
    fireEvent.click(line3)
  })

  it('handles reset, skip, and keep actions', async () => {
    renderOpeningDrillScreen()
    await screen.findByRole('heading', { level: 1, name: 'Opening drill' })

    const resetBtn = screen.getByRole('button', { name: /Try the move again/i })
    fireEvent.click(resetBtn)
    expect(screen.getByText(/Your move · play it from memory/i)).toBeInTheDocument()

    const skipBtn = screen.getByRole('button', { name: /Skip line/i })
    fireEvent.click(skipBtn)

    const keepBtn = screen.getByRole('button', { name: /Keep …c5 too/i })
    fireEvent.click(keepBtn)
  })

  it('renders links to Repertoire and Settings', async () => {
    renderOpeningDrillScreen()
    await screen.findByRole('heading', { level: 1, name: 'Opening drill' })

    expect(screen.getByRole('link', { name: /Repertoire/i })).toHaveAttribute('href', '/openings')
    expect(screen.getByRole('link', { name: 'Board and piece settings' })).toBeInTheDocument()
  })
})
