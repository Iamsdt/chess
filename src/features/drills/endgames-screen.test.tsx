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

import { EndgamesScreen } from './endgames-screen'

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

function renderEndgamesScreen() {
  const rootRoute = createRootRoute()
  const endgamesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/drills/endgames',
    component: EndgamesScreen,
  })
  const learnRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/learn',
    component: () => <div>Learn Screen</div>,
  })
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: () => <div>Settings Screen</div>,
  })

  const routeTree = rootRoute.addChildren([endgamesRoute, learnRoute, settingsRoute])
  const history = createMemoryHistory({ initialEntries: ['/drills/endgames'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('EndgamesScreen', () => {
  it('renders heading with accessible name "Endgame drills" and player bars', async () => {
    renderEndgamesScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Endgame drills' })
    expect(heading).toBeInTheDocument()

    expect(screen.getByText(/Stockfish/i)).toBeInTheDocument()
    expect(screen.getByText(/defends/i)).toBeInTheDocument()
    expect(screen.getByText(/4 of 7 mastered/i)).toBeInTheDocument()
    expect(screen.getByText('SK')).toBeInTheDocument()
    expect(screen.getByText(/Your move · the box is holding/i)).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderEndgamesScreen()
    await screen.findByRole('heading', { level: 1, name: 'Endgame drills' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('lists drills categorized into basic mates, pawn, and rook endings', async () => {
    renderEndgamesScreen()
    await screen.findByRole('heading', { level: 1, name: 'Endgame drills' })

    expect(screen.getByText('Basic mates')).toBeInTheDocument()
    expect(screen.getByText('Pawn endgames')).toBeInTheDocument()
    expect(screen.getByText('Rook endgames')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /K\+Q vs K/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /K\+R vs K/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Opposition/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lucena/i })).toBeInTheDocument()
  })

  it('allows switching drills to update board and technique guide', async () => {
    renderEndgamesScreen()
    await screen.findByRole('heading', { level: 1, name: 'Endgame drills' })

    // Default drill is K+R vs K
    expect(screen.getByText(/Technique: the box/i)).toBeInTheDocument()

    // Switch to Opposition
    const oppositionBtn = screen.getByRole('button', { name: /Opposition/i })
    fireEvent.click(oppositionBtn)

    expect(screen.getByText(/The direct opposition/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Promote your pawn using direct king opposition/i,
      }),
    ).toBeInTheDocument()
  })

  it('supports flipping the board orientation', async () => {
    renderEndgamesScreen()
    await screen.findByRole('heading', { level: 1, name: 'Endgame drills' })

    const flipBtn = screen.getByRole('button', { name: /flip/i })
    fireEvent.click(flipBtn)
  })

  it('provides drill controls for take back, hint, and restart', async () => {
    renderEndgamesScreen()
    await screen.findByRole('heading', { level: 1, name: 'Endgame drills' })

    const hintBtn = screen.getByRole('button', { name: /Hint/i })
    fireEvent.click(hintBtn)

    const takeBackBtn = screen.getByRole('button', { name: /Take back/i })
    fireEvent.click(takeBackBtn)

    const restartBtn = screen.getByRole('button', { name: /Restart drill/i })
    fireEvent.click(restartBtn)
  })

  it('allows asking Sage about the endgame technique', async () => {
    renderEndgamesScreen()
    await screen.findByRole('heading', { level: 1, name: 'Endgame drills' })

    const askSageBtn = screen.getByRole('button', { name: /Ask Sage about the box/i })
    fireEvent.click(askSageBtn)
  })
})
