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

import { LessonScreen } from './lesson-screen'

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

function renderLessonScreen() {
  const rootRoute = createRootRoute()
  const lessonRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/learn/lesson',
    component: LessonScreen,
  })
  const learnRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/learn',
    component: () => <div>Learn Map</div>,
  })
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: () => <div>Settings</div>,
  })
  const puzzlesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/puzzles',
    component: () => <div>Puzzles Hub</div>,
  })

  const routeTree = rootRoute.addChildren([lessonRoute, learnRoute, settingsRoute, puzzlesRoute])
  const history = createMemoryHistory({ initialEntries: ['/learn/lesson'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('LessonScreen', () => {
  it('renders heading with accessible name "Lesson" and step details', async () => {
    renderLessonScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Lesson' })
    expect(heading).toBeInTheDocument()

    expect(screen.getByText('Royal fork')).toBeInTheDocument()
    expect(screen.getByText(/Double attacks/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Step 3/i).length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Your move: find the knight jump that attacks king and queen/i,
      }),
    ).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderLessonScreen()
    await screen.findByRole('heading', { level: 1, name: 'Lesson' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('allows unlocking progressive hints from the hint ladder', async () => {
    renderLessonScreen()
    await screen.findByRole('heading', { level: 1, name: 'Lesson' })

    expect(screen.getByText(/1 of 3 used/i)).toBeInTheDocument()

    // Unlock Hint 2
    const showPieceBtn = screen.getByRole('button', { name: /Show the piece/i })
    fireEvent.click(showPieceBtn)

    expect(screen.getByText(/The knight on d5 is your hero/i)).toBeInTheDocument()
    expect(screen.getByText(/2 of 3 used/i)).toBeInTheDocument()

    // Unlock Hint 3
    const showMoveBtn = screen.getByRole('button', { name: /Show the move/i })
    fireEvent.click(showMoveBtn)

    expect(screen.getByText(/giving check and winning the queen/i)).toBeInTheDocument()
    expect(screen.getByText(/3 of 3 used/i)).toBeInTheDocument()
  })

  it('switches between feedback tabs and supports position reset', async () => {
    renderLessonScreen()
    await screen.findByRole('heading', { level: 1, name: 'Lesson' })

    // Switch to 'Not quite' tab
    const notQuiteTab = screen.getByRole('tab', { name: /Not quite/i })
    fireEvent.click(notQuiteTab)

    expect(screen.getByText(/Close\. Good eye for forks\./i)).toBeInTheDocument()

    // Click 'Try again' to reset
    const tryAgainBtn = screen.getByRole('button', { name: /Try again/i })
    fireEvent.click(tryAgainBtn)

    expect(screen.getByText(/That's the royal fork/i)).toBeInTheDocument()
  })

  it('opens and interacts with the lesson complete modal', async () => {
    renderLessonScreen()
    await screen.findByRole('heading', { level: 1, name: 'Lesson' })

    const previewDoneBtn = screen.getByRole('button', {
      name: /Preview the lesson-complete card/i,
    })
    fireEvent.click(previewDoneBtn)

    expect(
      screen.getByRole('heading', { level: 2, name: /You found the royal fork/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Seven steps in 6 minutes/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Practice 5 puzzles/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to course/i })).toBeInTheDocument()
  })

  it('supports asking Sage for alternative explanations', async () => {
    renderLessonScreen()
    await screen.findByRole('heading', { level: 1, name: 'Lesson' })

    const askSageBtn = screen.getByRole('button', {
      name: /Ask Sage to explain the royal fork in a different way/i,
    })
    fireEvent.click(askSageBtn)
  })
})
