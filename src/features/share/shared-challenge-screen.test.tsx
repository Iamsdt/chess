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

import { SharedChallengeScreen } from './shared-challenge-screen'

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

function renderSharedChallengeScreen() {
  const rootRoute = createRootRoute()
  const shareRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/share',
    component: SharedChallengeScreen,
  })
  const solveRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/puzzles/solve',
    component: () => <div>Puzzle Solver Screen</div>,
  })
  const analysisRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/analysis',
    component: () => <div>Analysis Screen</div>,
  })
  const liveRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/friends/live',
    component: () => <div>Live Game Screen</div>,
  })
  const onboardingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/onboarding',
    component: () => <div>Onboarding Screen</div>,
  })

  const routeTree = rootRoute.addChildren([
    shareRoute,
    solveRoute,
    analysisRoute,
    liveRoute,
    onboardingRoute,
  ])
  const history = createMemoryHistory({ initialEntries: ['/share'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('SharedChallengeScreen', () => {
  it('renders heading with accessible name "Shared challenge" and puzzle card', async () => {
    renderSharedChallengeScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Shared challenge' })
    expect(heading).toBeInTheDocument()

    expect(screen.getByText('Rafi challenged you')).toBeInTheDocument()
    expect(screen.getByText('White to play and win')).toBeInTheDocument()
    expect(screen.getByText('Beat 1:12')).toBeInTheDocument()
    expect(screen.getByText('4 moves deep')).toBeInTheDocument()
    expect(screen.getByText('Theme hidden')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Solve it/i })).toHaveAttribute(
      'href',
      '/puzzles/solve',
    )
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderSharedChallengeScreen()
    await screen.findByRole('heading', { level: 1, name: 'Shared challenge' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('switches to Position tab and renders shared question', async () => {
    renderSharedChallengeScreen()
    await screen.findByRole('heading', { level: 1, name: 'Shared challenge' })

    const positionTab = screen.getByRole('tab', { name: 'Position' })
    fireEvent.click(positionTab)

    expect(screen.getByText('Mina shared a position')).toBeInTheDocument()
    expect(screen.getByText('"Trade on e7, or keep the bishop?"')).toBeInTheDocument()

    const sageBtn = screen.getByRole('button', { name: /Think it through with Sage/i })
    expect(sageBtn).toBeInTheDocument()
    fireEvent.click(sageBtn)
  })

  it('switches to Annotated game tab and renders Tomás Italian notes', async () => {
    renderSharedChallengeScreen()
    await screen.findByRole('heading', { level: 1, name: 'Shared challenge' })

    const gameTab = screen.getByRole('tab', { name: 'Annotated game' })
    fireEvent.click(gameTab)

    expect(screen.getByText('Tomás shared an annotated game')).toBeInTheDocument()
    expect(screen.getByText('My first win with the slow Italian')).toBeInTheDocument()
    expect(screen.getByText('7.a4')).toBeInTheDocument()
    expect(screen.getByText('8.Nbd2')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Step through the game/i })).toHaveAttribute(
      'href',
      '/analysis',
    )
  })

  it('switches to Correspondence move tab and links to live game', async () => {
    renderSharedChallengeScreen()
    await screen.findByRole('heading', { level: 1, name: 'Shared challenge' })

    const corrTab = screen.getByRole('tab', { name: 'Correspondence move' })
    fireEvent.click(corrTab)

    expect(screen.getByText(/Rafi played/i)).toBeInTheDocument()
    expect(screen.getByText('Your move. Then send the link back.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Make my move/i })).toHaveAttribute(
      'href',
      '/friends/live',
    )
  })

  it('renders footer with link to onboarding', async () => {
    renderSharedChallengeScreen()
    await screen.findByRole('heading', { level: 1, name: 'Shared challenge' })

    const onboardingLink = screen.getByRole('link', { name: /Set up in under a minute/i })
    expect(onboardingLink).toHaveAttribute('href', '/onboarding')
  })
})
