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

import { OpeningsScreen } from './openings-screen'

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

function renderOpeningsScreen() {
  const rootRoute = createRootRoute()
  const openingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/openings',
    component: OpeningsScreen,
  })
  const drillRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/openings/drill',
    component: () => <div>Opening Drill Screen</div>,
  })

  const routeTree = rootRoute.addChildren([openingsRoute, drillRoute])
  const history = createMemoryHistory({ initialEntries: ['/openings'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('OpeningsScreen', () => {
  it('renders heading with accessible name "Openings" and due summary', async () => {
    renderOpeningsScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Openings' })
    expect(heading).toBeInTheDocument()

    expect(screen.getByText('7 lines due')).toBeInTheDocument()
    expect(screen.getByText('about 5 min')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Drill due lines/i })).toHaveAttribute(
      'href',
      '/openings/drill',
    )
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderOpeningsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Openings' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('renders repertoire cards for White and Black with mastery progress', async () => {
    renderOpeningsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Openings' })

    expect(screen.getByRole('heading', { level: 2, name: /As White/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Italian Game' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'London System' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 2, name: /As Black/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Caro-Kann Defence' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: "Queen's Gambit Declined" }),
    ).toBeInTheDocument()

    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('64%')).toBeInTheDocument()
    expect(screen.getByText('57%')).toBeInTheDocument()
    expect(screen.getByText('41%')).toBeInTheDocument()
  })

  it('renders the interactive Caro-Kann tree preview with stats', async () => {
    renderOpeningsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Openings' })

    expect(screen.getByRole('heading', { level: 2, name: 'Caro-Kann tree' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Check Caro-Kann tree with Sage' }),
    ).toBeInTheDocument()
    expect(screen.getByText('16')).toBeInTheDocument()
    expect(screen.getByText('58')).toBeInTheDocument()
    expect(screen.getByText('Advance · 8 lines')).toBeInTheDocument()
  })

  it('switches between My Repertoire and Explore tabs', async () => {
    renderOpeningsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Openings' })

    const exploreTab = screen.getByRole('tab', { name: 'Explore' })
    fireEvent.click(exploreTab)

    expect(screen.getByPlaceholderText('Search by name, ECO or moves')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'French Defence' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Sicilian Najdorf' })).toBeInTheDocument()

    const mineTab = screen.getByRole('tab', { name: 'My repertoire' })
    fireEvent.click(mineTab)

    expect(screen.getByRole('heading', { level: 3, name: 'Italian Game' })).toBeInTheDocument()
  })

  it('filters openings on Explore tab by search query, color, and style', async () => {
    renderOpeningsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Openings' })

    const exploreTab = screen.getByRole('tab', { name: 'Explore' })
    fireEvent.click(exploreTab)

    // Filter by color: White
    const whiteFilter = screen.getByRole('button', { name: 'White' })
    fireEvent.click(whiteFilter)

    expect(screen.getByRole('heading', { level: 3, name: 'Ruy Lopez' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Vienna Game' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { level: 3, name: 'French Defence' }),
    ).not.toBeInTheDocument()

    // Filter by style: Sharp (while White is active -> Vienna Game)
    const sharpFilter = screen.getByRole('button', { name: 'Sharp' })
    fireEvent.click(sharpFilter)

    expect(screen.getByRole('heading', { level: 3, name: 'Vienna Game' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Ruy Lopez' })).not.toBeInTheDocument()

    // Reset filters
    const allFilter = screen.getByRole('button', { name: 'All' })
    fireEvent.click(allFilter)
    const anyStyle = screen.getByRole('button', { name: 'Any style' })
    fireEvent.click(anyStyle)

    // Search query
    const searchInput = screen.getByPlaceholderText('Search by name, ECO or moves')
    fireEvent.change(searchInput, { target: { value: 'french' } })

    expect(screen.getByRole('heading', { level: 3, name: 'French Defence' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Sicilian Najdorf' }),
    ).not.toBeInTheDocument()
  })

  it('adds an opening to repertoire draft from Explore tab', async () => {
    renderOpeningsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Openings' })

    const exploreTab = screen.getByRole('tab', { name: 'Explore' })
    fireEvent.click(exploreTab)

    const addButtons = screen.getAllByRole('button', { name: 'Add to repertoire' })
    expect(addButtons.length).toBeGreaterThan(0)

    const firstAddBtn = addButtons[0]
    if (firstAddBtn) {
      fireEvent.click(firstAddBtn)
      expect(screen.getByRole('button', { name: 'Added as draft' })).toBeDisabled()
    }
  })
})
