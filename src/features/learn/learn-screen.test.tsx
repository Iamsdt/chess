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

import { LearnScreen } from './learn-screen'

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

function renderLearnScreen() {
  const rootRoute = createRootRoute()
  const learnRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/learn',
    component: LearnScreen,
  })
  const lessonRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/learn/lesson',
    component: () => <div>Interactive Lesson</div>,
  })
  const openingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/openings',
    component: () => <div>Openings Repertoire</div>,
  })
  const endgamesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/drills/endgames',
    component: () => <div>Endgame Drills</div>,
  })

  const routeTree = rootRoute.addChildren([learnRoute, lessonRoute, openingsRoute, endgamesRoute])
  const history = createMemoryHistory({ initialEntries: ['/learn'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('LearnScreen', () => {
  it('renders heading with accessible name "Learn" and track overview', async () => {
    renderLearnScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Learn' })
    expect(heading).toBeInTheDocument()

    expect(screen.getByRole('tab', { name: /Tactics Foundations/i })).toBeInTheDocument()
    expect(screen.getByText('Checkmate Patterns')).toBeInTheDocument()
    expect(screen.getByText('Opening Principles')).toBeInTheDocument()
    expect(screen.getByText('Endgame Essentials')).toBeInTheDocument()
    expect(screen.getByText('Strategy Basics')).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderLearnScreen()
    await screen.findByRole('heading', { level: 1, name: 'Learn' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('allows switching tracks to update the path header', async () => {
    renderLearnScreen()
    await screen.findByRole('heading', { level: 1, name: 'Learn' })

    const checkmateTrack = screen.getByRole('tab', { name: /Checkmate Patterns/i })
    fireEvent.click(checkmateTrack)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Checkmate Patterns' }),
    ).toBeInTheDocument()
  })

  it('renders the active lesson hero card and interactive links', async () => {
    renderLearnScreen()
    await screen.findByRole('heading', { level: 1, name: 'Learn' })

    expect(screen.getByRole('heading', { level: 4, name: 'Royal fork' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Continue: Royal fork/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Lesson position: White to move' })).toBeInTheDocument()
  })

  it('renders practice rooms and navigates to drills and openings', async () => {
    renderLearnScreen()
    await screen.findByRole('heading', { level: 1, name: 'Learn' })

    expect(screen.getByRole('heading', { level: 2, name: 'Practice rooms' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Openings/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Endgames/i })).toBeInTheDocument()
  })

  it('allows managing content packs and importing packs', async () => {
    renderLearnScreen()
    await screen.findByRole('heading', { level: 1, name: 'Learn' })

    expect(screen.getByText('Chess King Core')).toBeInTheDocument()
    expect(screen.getByText('Mating Nets 101')).toBeInTheDocument()

    const removeBtn = screen.getByRole('button', { name: 'Remove Mating Nets 101' })
    fireEvent.click(removeBtn)

    expect(screen.queryByText('Mating Nets 101')).not.toBeInTheDocument()

    const importBtn = screen.getByRole('button', { name: /Import/i })
    fireEvent.click(importBtn)
  })

  it('supports asking Sage for guidance', async () => {
    renderLearnScreen()
    await screen.findByRole('heading', { level: 1, name: 'Learn' })

    const askSageLessonBtn = screen.getByRole('button', { name: 'Ask Sage about royal fork' })
    fireEvent.click(askSageLessonBtn)

    const askSageOrderBtn = screen.getByRole('button', {
      name: 'Ask Sage to suggest a lesson order',
    })
    fireEvent.click(askSageOrderBtn)
  })
})
