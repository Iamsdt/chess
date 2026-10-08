import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { createGame, legalMoves } from '@/chess'
import { kvRepo } from '@/data'
import { ThemeProvider } from '@/design'
import type { Result } from '@/domain'

import { blindfoldAnswer, pickLine } from './blindfold'
import { checkingMoves, shuffledPositions } from './find-checks'
import {
  KNIGHT_ROUTE_BLOCKED,
  knightDistance,
  pickKnightRoute,
  shortestKnightPath,
} from './knight-route'
import { DrillPortsContext, type DrillPorts } from './ports'
import { brokenRecords, installBoardShims, realRecords, testPorts } from './test-support'
import { VisionScreen } from './vision-screen'

import type { DrillRecordsPort, VisionRecords } from './drill-records'

beforeAll(() => {
  installBoardShims()
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

beforeEach(async () => {
  await kvRepo.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

/** Half-way through the list every time: the first square is e1, the first line is index 3. */
const MIDDLE = () => 0.5

function renderVision(ports: DrillPorts = testPorts({ random: MIDDLE })) {
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
  const router = createRouter({
    routeTree: rootRoute.addChildren([visionRoute, puzzlesRoute]),
    history: createMemoryHistory({ initialEntries: ['/drills/vision'] }),
  })
  return render(
    <ThemeProvider>
      <DrillPortsContext value={ports}>
        <RouterProvider router={router} />
      </DrillPortsContext>
    </ThemeProvider>,
  )
}

function cell(container: HTMLElement, name: string): HTMLElement {
  const element = container.querySelector(`[data-square="${name}"]`)
  if (!(element instanceof HTMLElement)) throw new Error(`No square ${name} rendered`)
  return element
}

async function ready() {
  return screen.findByRole('heading', { level: 1, name: 'Board vision' })
}

function panel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Drill panel' })
}

async function startRound(label = /Start/) {
  fireEvent.click(await screen.findByRole('button', { name: label }))
}

describe('VisionScreen states', () => {
  it('shows a loading state until the scores arrive', async () => {
    const pending: DrillRecordsPort = {
      ...realRecords(),
      readVision: () => new Promise<Result<VisionRecords>>(() => undefined),
    }
    renderVision(testPorts({ records: pending }))
    expect(await screen.findByRole('status', { name: 'Loading your scores' })).toBeInTheDocument()
  })

  it('shows an error with a retry', async () => {
    let failing = true
    const flaky: DrillRecordsPort = {
      ...realRecords(),
      readVision: () => (failing ? brokenRecords().readVision() : realRecords().readVision()),
    }
    const user = userEvent.setup()
    renderVision(testPorts({ records: flaky }))
    expect(await screen.findByText('Your scores could not be opened')).toBeInTheDocument()

    failing = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('timer', { name: 'Time left' })).toBeInTheDocument()
  })

  it('invites a first score instead of inventing one', async () => {
    renderVision()
    await ready()
    expect(await screen.findByText(/No score yet/)).toBeInTheDocument()
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('1:00')
    expect(screen.queryByText('14')).toBeNull()
    expect(screen.queryByText(/19/)).toBeNull()
    // Every other drill is new.
    expect(screen.getAllByText('New · try it')).toHaveLength(3)
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderVision()
    await ready()
    await screen.findByText(/No score yet/)
    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})

describe('Name the square', () => {
  it('keeps the drill behind a start button', async () => {
    renderVision()
    await ready()
    expect(await screen.findByRole('button', { name: /Start the minute/ })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Type it/)).toBeNull()
  })

  it('scores a correct pick by file and rank, and ends the streak on a miss', async () => {
    renderVision()
    await ready()
    await startRound()

    // The first target is e1 with a half-way random source.
    fireEvent.click(screen.getByRole('button', { name: 'e' }))
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    const bar = panel()
    expect(within(bar).getByText('Square 2')).toBeInTheDocument()
    expect(within(bar).getAllByText('1')).not.toHaveLength(0)

    // The next target is e2; answer wrongly.
    fireEvent.click(screen.getByRole('button', { name: 'a' }))
    fireEvent.click(screen.getByRole('button', { name: '8' }))
    expect(within(bar).getByText('Square 3')).toBeInTheDocument()
    expect(within(bar).getByText('a8, not e2')).toBeInTheDocument()
    expect(within(bar).getByText('e1')).toBeInTheDocument()
  })

  it('accepts a typed square', async () => {
    renderVision()
    await ready()
    await startRound()

    fireEvent.change(screen.getByPlaceholderText(/Type it, e\.g\. e4/i), {
      target: { value: 'E1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(within(panel()).getByText('Square 2')).toBeInTheDocument()
  })

  it('counts down, then saves the score and shows the summary', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    const ports = testPorts({ random: MIDDLE })
    renderVision(ports)
    await ready()
    await startRound()

    fireEvent.click(screen.getByRole('button', { name: 'e' }))
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('1:00')

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('0:30')

    await act(() => {
      vi.advanceTimersByTime(30_400)
      return Promise.resolve()
    })
    expect(screen.getByText("Time's up")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Type it/)).toBeNull()

    await vi.waitFor(async () => {
      const saved = await ports.records.readVision()
      expect(saved.ok && saved.value.square).toMatchObject({ plays: 1, best: 1, lastScore: 1 })
    })
    expect(await screen.findByText(/a new best/)).toBeInTheDocument()
    expect(within(panel()).getByText(/in a minute/)).toBeInTheDocument()
  })

  it('does not call a lower score a record', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    const ports = testPorts({ random: MIDDLE })
    await ports.records.recordVision('square', 9)
    renderVision(ports)
    await ready()
    await startRound()
    await act(() => {
      vi.advanceTimersByTime(60_400)
      return Promise.resolve()
    })
    expect(await screen.findByText(/Your best is 9/)).toBeInTheDocument()
  })

  it('restarts the round from the header', async () => {
    renderVision()
    await ready()
    await startRound()
    fireEvent.click(screen.getByRole('button', { name: 'e' }))
    fireEvent.click(screen.getByRole('button', { name: '1' }))

    fireEvent.click(screen.getByRole('button', { name: /Restart/i }))
    expect(await screen.findByRole('button', { name: /Start the minute/ })).toBeInTheDocument()
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('1:00')
  })

  it('flips the board with the orientation toggle', async () => {
    const { container } = renderVision()
    await ready()
    await screen.findByText(/No score yet/)
    expect(container.querySelectorAll('[data-square]')[0]).toHaveAttribute('data-square', 'a8')
    fireEvent.click(screen.getByRole('button', { name: 'As Black' }))
    expect(container.querySelectorAll('[data-square]')[0]).toHaveAttribute('data-square', 'h1')
  })
})

describe('Persisted bests', () => {
  it('shows each drill’s stored best on its card and in the panel', async () => {
    const ports = testPorts({ random: MIDDLE })
    await ports.records.recordVision('square', 19)
    await ports.records.recordVision('checks', 9)
    await ports.records.recordVision('knight', 12)
    renderVision(ports)
    await ready()

    expect(await screen.findByText('Best: 9 checks')).toBeInTheDocument()
    expect(screen.getByText('Best: 12 routes')).toBeInTheDocument()
    expect(screen.getByText('New · try it')).toBeInTheDocument()
    expect(within(panel()).getByText('19')).toBeInTheDocument()
  })
})

describe('Find all checks', () => {
  /** Shuffles with the first-listed random value, which opens on the three-check position. */
  const FIRST = () => 0

  async function openChecks() {
    const { container } = renderVision(testPorts({ random: FIRST }))
    await ready()
    fireEvent.click(await screen.findByRole('button', { name: /Find all checks/ }))
    await startRound(/Start the round/)
    return container
  }

  it('switches to the drill and scores each check found', async () => {
    const container = await openChecks()
    expect(screen.getByRole('heading', { level: 1, name: 'Board vision' })).toHaveTextContent(
      'Find all checks',
    )
    const position = shuffledPositions(FIRST)[0]
    if (position === undefined) throw new Error('no position')
    const checks = checkingMoves(position.fen)
    const first = checks[0]
    if (first === undefined) throw new Error('no check')
    expect(checks.length).toBeGreaterThan(1)

    expect(
      screen.getByText(`0 of ${String(checks.length)} found`, { exact: false }),
    ).toBeInTheDocument()
    fireEvent.click(cell(container, first.from))
    fireEvent.click(cell(container, first.to))

    await waitFor(() => {
      expect(
        screen.getByText(`1 of ${String(checks.length)} found`, { exact: false }),
      ).toBeInTheDocument()
    })
    expect(within(panel()).getByText(first.san)).toBeInTheDocument()
  })

  it('does not score a move that is not a check', async () => {
    const container = await openChecks()
    const position = shuffledPositions(FIRST)[0]
    if (position === undefined) throw new Error('no position')
    const game = createGame(position.fen)
    if (!game.ok) throw new Error('bad position')
    const checks = checkingMoves(position.fen)
    const quiet = legalMoves(game.value).find(
      (move) => !checks.some((check) => check.uci === move.uci),
    )
    if (quiet === undefined) throw new Error('no quiet move')

    fireEvent.click(cell(container, quiet.from))
    fireEvent.click(cell(container, quiet.to))
    await waitFor(() => {
      expect(within(panel()).getByText(`${quiet.from}${quiet.to}`)).toBeInTheDocument()
    })
    expect(
      screen.getByText(`0 of ${String(checks.length)} found`, { exact: false }),
    ).toBeInTheDocument()
  })

  it('moves on when every check is found, and can skip', async () => {
    const container = await openChecks()
    const position = shuffledPositions(FIRST)[0]
    if (position === undefined) throw new Error('no position')
    for (const check of checkingMoves(position.fen)) {
      fireEvent.click(cell(container, check.from))
      fireEvent.click(cell(container, check.to))
    }
    expect(await screen.findByText('Position 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Skip this position/ }))
    expect(await screen.findByText('Position 3')).toBeInTheDocument()
  })
})

describe('Knight route', () => {
  async function openKnight() {
    const { container } = renderVision()
    await ready()
    fireEvent.click(await screen.findByRole('button', { name: /Knight route/ }))
    await startRound(/Start the round/)
    return container
  }

  it('scores the shortest route found by search', async () => {
    const container = await openKnight()
    const route = pickKnightRoute(MIDDLE, null)
    const path = shortestKnightPath(route.from, route.to, KNIGHT_ROUTE_BLOCKED)
    if (path === null) throw new Error('no path')

    expect(screen.getByText(`${route.from} to ${route.to}`)).toBeInTheDocument()
    for (const [index, square] of path.entries()) {
      if (index === 0) continue
      const previous = path[index - 1]
      fireEvent.click(cell(container, previous ?? route.from))
      fireEvent.click(cell(container, square))
    }
    await waitFor(() => {
      expect(
        within(panel()).getByText(`${route.from}→${route.to} in ${String(route.jumps)}`),
      ).toBeInTheDocument()
    })
  })

  it('tells the player when a longer route reaches the square, and scores nothing', async () => {
    const container = await openKnight()
    const route = pickKnightRoute(MIDDLE, null)
    const short = shortestKnightPath(route.from, route.to, KNIGHT_ROUTE_BLOCKED)
    if (short === null) throw new Error('no path')
    const walked: string[] = [route.from]
    const [firstStep] = short.slice(1)
    if (firstStep === undefined) throw new Error('no step')
    // Detour: out to the first square, back to the start, then along the short route.
    walked.push(firstStep, route.from, ...short.slice(1))
    for (let i = 1; i < walked.length; i += 1) {
      fireEvent.click(cell(container, walked[i - 1] ?? ''))
      fireEvent.click(cell(container, walked[i] ?? ''))
    }
    const extra = walked.length - 1
    await waitFor(() => {
      expect(
        within(panel()).getByText(
          `${route.from}→${route.to}: ${String(extra)}, not ${String(route.jumps)}`,
        ),
      ).toBeInTheDocument()
    })
    expect(within(panel()).getAllByText('0').length).toBeGreaterThan(0)
  })

  it('lets a jump be undone', async () => {
    const container = await openKnight()
    const route = pickKnightRoute(MIDDLE, null)
    const [first] = shortestKnightPath(route.from, route.to, KNIGHT_ROUTE_BLOCKED)?.slice(1) ?? []
    if (first === undefined) throw new Error('no step')
    expect(screen.getByRole('button', { name: /Undo last jump/ })).toBeDisabled()
    fireEvent.click(cell(container, route.from))
    fireEvent.click(cell(container, first))
    await waitFor(() => {
      expect(screen.getByText(/Jumps so far: 1/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Undo last jump/ }))
    expect(screen.getByText(/Jumps so far: 0/)).toBeInTheDocument()
  })

  it('agrees with the search on the fallback route’s length', () => {
    const route = pickKnightRoute(MIDDLE, null)
    expect(route.jumps).toBe(knightDistance(route.from, route.to, KNIGHT_ROUTE_BLOCKED))
  })
})

describe('Blindfold move', () => {
  async function openBlindfold() {
    renderVision()
    await ready()
    fireEvent.click(await screen.findByRole('button', { name: /Blindfold move/ }))
    await startRound(/Start the round/)
  }

  it('shows the moves, hides the board, then marks the answer', async () => {
    await openBlindfold()
    const line = pickLine(MIDDLE, null)
    const answer = blindfoldAnswer(line)
    expect(screen.getByText('Board hidden')).toBeInTheDocument()
    expect(screen.getByLabelText('The moves')).toHaveTextContent('1. e4 c5')

    fireEvent.click(screen.getByRole('button', { name: /Hide the moves/ }))
    expect(screen.queryByLabelText('The moves')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText(/Type it, e\.g\. f3/), {
      target: { value: answer ?? '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    expect(within(panel()).getByText(answer ?? '')).toBeInTheDocument()
    expect(screen.queryByText('Board hidden')).toBeNull()
    expect(screen.getByRole('button', { name: /Next line/ })).toBeInTheDocument()
  })

  it('shows the right square after a wrong answer', async () => {
    await openBlindfold()
    fireEvent.click(screen.getByRole('button', { name: /Hide the moves/ }))
    fireEvent.change(screen.getByPlaceholderText(/Type it, e\.g\. f3/), { target: { value: 'a1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(within(panel()).getByText('a1, not d4')).toBeInTheDocument()
  })
})
