import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { ThemeProvider } from '@/design'

import { TodayScreen } from './today-screen'

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

function renderTodayScreen() {
  const rootRoute = createRootRoute()
  const todayRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: TodayScreen,
  })
  const dummyPuzzles = createRoute({
    getParentRoute: () => rootRoute,
    path: '/puzzles',
    component: () => <div>Puzzles</div>,
  })
  const dummyMistakes = createRoute({
    getParentRoute: () => rootRoute,
    path: '/mistakes',
    component: () => <div>Mistakes</div>,
  })
  const dummyFriends = createRoute({
    getParentRoute: () => rootRoute,
    path: '/friends/live',
    component: () => <div>Friends Live</div>,
  })
  const dummyLesson = createRoute({
    getParentRoute: () => rootRoute,
    path: '/learn/lesson',
    component: () => <div>Lesson</div>,
  })
  const dummyOpenings = createRoute({
    getParentRoute: () => rootRoute,
    path: '/openings',
    component: () => <div>Openings</div>,
  })
  const dummySolve = createRoute({
    getParentRoute: () => rootRoute,
    path: '/puzzles/solve',
    component: () => <div>Solve</div>,
  })

  const routeTree = rootRoute.addChildren([
    todayRoute,
    dummyPuzzles,
    dummyMistakes,
    dummyFriends,
    dummyLesson,
    dummyOpenings,
    dummySolve,
  ])

  const history = createMemoryHistory({ initialEntries: ['/'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('TodayScreen', () => {
  it('renders heading with accessible name "Today"', async () => {
    renderTodayScreen()
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
  })

  it('renders Today’s path section and steps', async () => {
    renderTodayScreen()
    expect(
      await screen.findByRole('heading', { level: 2, name: "Today's path" }),
    ).toBeInTheDocument()
    expect(screen.getByText('Daily puzzle')).toBeInTheDocument()
    expect(screen.getByText('Lesson · Double attacks II')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Give five mistakes a second chance' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start · 4 min/i })).toBeInTheDocument()
  })

  it('renders the chessboard preview for the active mistake', async () => {
    renderTodayScreen()
    expect(await screen.findByRole('img', { name: /Mistake review/i })).toBeInTheDocument()
    expect(screen.getByText(/What did the knight see\?/i)).toBeInTheDocument()
  })

  it('renders right column metrics (streak, rating, friend challenge, lesson)', async () => {
    renderTodayScreen()
    expect(await screen.findByText('Goal 5 of 7 days')).toBeInTheDocument()
    expect(screen.getByText('Puzzle rating')).toBeInTheDocument()
    expect(screen.getByText('1482')).toBeInTheDocument()
    expect(screen.getByText(/Rafi played …Qb6/i)).toBeInTheDocument()
    expect(screen.getByText('The royal fork')).toBeInTheDocument()
  })

  it('renders Sage noticed this week insights', async () => {
    renderTodayScreen()
    expect(
      await screen.findByRole('heading', { level: 2, name: /Sage noticed this week/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: /Knight forks started 4 of your 5 losses/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: /Your Italian Game is working/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: /You learn best around 8pm/i }),
    ).toBeInTheDocument()
  })

  it('renders this week’s training plan', async () => {
    renderTodayScreen()
    expect(
      await screen.findByRole('heading', { level: 2, name: "This week's plan" }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sat · today')).toBeInTheDocument()
    expect(screen.getByText('Mistake review')).toBeInTheDocument()
  })

  it('passes basic accessibility audit', async () => {
    const { container } = renderTodayScreen()
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    })
    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})
