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

import { LiveGameScreen } from './live-game-screen'

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

function renderLiveGameScreen() {
  const rootRoute = createRootRoute()
  const liveRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/friends/live',
    component: LiveGameScreen,
  })
  const friendsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/friends',
    component: () => <div>Friends Hub</div>,
  })
  const reviewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/games/review',
    component: () => <div>Game Review</div>,
  })
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: () => <div>Settings Screen</div>,
  })

  const routeTree = rootRoute.addChildren([liveRoute, friendsRoute, reviewRoute, settingsRoute])
  const history = createMemoryHistory({ initialEntries: ['/friends/live'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('LiveGameScreen', () => {
  it('renders heading with accessible name "Live game" and player names', async () => {
    renderLiveGameScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Live game' })
    expect(heading).toBeInTheDocument()

    expect(screen.getByText('You vs Rafi')).toBeInTheDocument()
    expect(screen.getByText('10 + 5')).toBeInTheDocument()
    expect(screen.getByText(/Connected · 42 ms/i)).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderLiveGameScreen()
    await screen.findByRole('heading', { level: 1, name: 'Live game' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('renders opponent card, player card, and clocks', async () => {
    renderLiveGameScreen()
    await screen.findByRole('heading', { level: 1, name: 'Live game' })

    expect(screen.getByText('RA')).toBeInTheDocument()
    expect(screen.getByText('Rafi')).toBeInTheDocument()
    expect(screen.getByText('7:48')).toBeInTheDocument()

    expect(screen.getByText('SK')).toBeInTheDocument()
    expect(screen.getByText('8:31')).toBeInTheDocument()
    expect(screen.getByText('Your move')).toBeInTheDocument()
  })

  it('renders moves list and Sicilian Najdorf theory heading', async () => {
    renderLiveGameScreen()
    await screen.findByRole('heading', { level: 1, name: 'Live game' })

    expect(screen.getByText('Sicilian Najdorf')).toBeInTheDocument()
    expect(screen.getByText(/Poisoned Pawn · B97/i)).toBeInTheDocument()
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('e4')).toBeInTheDocument()
    expect(screen.getByText('c5')).toBeInTheDocument()
    expect(screen.getByText('Qb6')).toBeInTheDocument()
  })

  it('handles sending quick reactions and flipping board', async () => {
    renderLiveGameScreen()
    await screen.findByRole('heading', { level: 1, name: 'Live game' })

    const oopsBtn = screen.getByRole('button', { name: 'Oops' })
    fireEvent.click(oopsBtn)
    expect(screen.getAllByText('Oops').length).toBe(2)

    const flipBtn = screen.getByRole('button', { name: 'Flip board' })
    fireEvent.click(flipBtn)
  })

  it('handles draw offer and opens resign dialog', async () => {
    renderLiveGameScreen()
    await screen.findByRole('heading', { level: 1, name: 'Live game' })

    const drawBtn = screen.getByRole('button', { name: /Draw/i })
    fireEvent.click(drawBtn)

    const resignBtn = screen.getByRole('button', { name: /Resign/i })
    fireEvent.click(resignBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Resign against Rafi?' }),
    ).toBeInTheDocument()

    const keepPlayingBtn = screen.getByRole('button', { name: 'Keep playing' })
    fireEvent.click(keepPlayingBtn)
  })
})
