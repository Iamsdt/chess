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

import { VisionScreen } from './vision-screen'

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

function renderVisionScreen() {
  const rootRoute = createRootRoute()
  const visionRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/drills/vision',
    component: VisionScreen,
  })
  const puzzlesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/puzzles',
    component: () => <div>Puzzles Hub</div>,
  })

  const routeTree = rootRoute.addChildren([visionRoute, puzzlesRoute])
  const history = createMemoryHistory({ initialEntries: ['/drills/vision'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('VisionScreen', () => {
  it('renders heading with accessible name "Board vision" and score indicators', async () => {
    renderVisionScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Board vision' })
    expect(heading).toBeInTheDocument()

    expect(screen.getByText('Name the square')).toBeInTheDocument()
    expect(screen.getByRole('timer', { name: 'Time left' })).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getAllByText('6').length).toBeGreaterThan(0)
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderVisionScreen()
    await screen.findByRole('heading', { level: 1, name: 'Board vision' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('allows picking square by file and rank buttons', async () => {
    renderVisionScreen()
    await screen.findByRole('heading', { level: 1, name: 'Board vision' })

    // Click 'g' file button
    const fileG = screen.getByRole('button', { name: 'g' })
    fireEvent.click(fileG)

    // Click '5' rank button to complete 'g5' (correct answer)
    const rank5 = screen.getByRole('button', { name: '5' })
    fireEvent.click(rank5)

    // Score should increment from 14 to 15
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('supports direct typing of the target square', async () => {
    renderVisionScreen()
    await screen.findByRole('heading', { level: 1, name: 'Board vision' })

    const input = screen.getByPlaceholderText(/Type it, e\.g\. e4/i)
    fireEvent.change(input, { target: { value: 'g5' } })

    const checkBtn = screen.getByRole('button', { name: 'Check' })
    fireEvent.click(checkBtn)

    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('allows toggling board orientation and restarting the drill', async () => {
    renderVisionScreen()
    await screen.findByRole('heading', { level: 1, name: 'Board vision' })

    const asBlackBtn = screen.getByRole('button', { name: 'As Black' })
    fireEvent.click(asBlackBtn)

    const asWhiteBtn = screen.getByRole('button', { name: 'As White' })
    fireEvent.click(asWhiteBtn)

    const restartBtn = screen.getByRole('button', { name: /Restart/i })
    fireEvent.click(restartBtn)

    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('0:60')
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('renders more vision drill cards', async () => {
    renderVisionScreen()
    await screen.findByRole('heading', { level: 1, name: 'Board vision' })

    expect(
      screen.getByRole('heading', { level: 2, name: 'More vision drills' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Find all checks')).toBeInTheDocument()
    expect(screen.getByText('Knight route')).toBeInTheDocument()
    expect(screen.getByText('Blindfold move')).toBeInTheDocument()

    const checksCard = screen.getByRole('button', { name: /Find all checks/i })
    fireEvent.click(checksCard)
  })
})
