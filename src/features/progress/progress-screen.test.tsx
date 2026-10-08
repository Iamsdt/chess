import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import {
  attemptsRepo,
  clearAllData,
  gamesRepo,
  kvRepo,
  profileRepo,
  puzzlesRepo,
  sessionsRepo,
} from '@/data'
import { ThemeProvider } from '@/design'
import {
  createProfile,
  makeGame,
  makeGameMeta,
  makePuzzle,
  makePuzzleAttempt,
  toAttemptId,
  toGameId,
  toLocalDate,
  toPuzzleId,
  toSessionId,
  toTimestamp,
} from '@/domain'

import { LineChart, ProgressScreen } from './progress-screen'
import { chartGeometry } from './progress-stats'
import { buildStatsSnapshot } from './stats-job'
import { STATS_SNAPSHOT_KEY } from './stats-snapshot'

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

function renderProgressScreen() {
  const rootRoute = createRootRoute()
  const progressRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/progress',
    component: ProgressScreen,
  })
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div>Today Screen</div>,
  })
  const puzzlesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/puzzles',
    component: () => <div>Puzzles Hub Screen</div>,
  })
  const openingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/openings',
    component: () => <div>Openings Screen</div>,
  })
  const visionRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/drills/vision',
    component: () => <div>Vision Drill Screen</div>,
  })
  const endgamesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/drills/endgames',
    component: () => <div>Endgames Drill Screen</div>,
  })
  const playRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/play',
    component: () => <div>Play Setup Screen</div>,
  })
  const mistakesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/mistakes',
    component: () => <div>Mistakes Screen</div>,
  })

  const routeTree = rootRoute.addChildren([
    progressRoute,
    homeRoute,
    puzzlesRoute,
    openingsRoute,
    visionRoute,
    endgamesRoute,
    playRoute,
    mistakesRoute,
  ])
  const history = createMemoryHistory({ initialEntries: ['/progress'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

const DAY = 86_400_000

async function seed() {
  await profileRepo.save({
    ...createProfile({
      displayName: 'Ada',
      skillLevel: 'club',
      timeZone: 'UTC',
      onboardingCompleted: true,
    }),
    puzzleRating: 1482,
  })

  const themes = ['fork', 'pin', 'mateIn2']
  await puzzlesRepo.bulkUpsert(
    themes.map((theme) => makePuzzle({ id: toPuzzleId(`p-${theme}`), theme })),
  )

  const now = Date.now()
  const startOfToday = now - (now % DAY)
  let n = 0
  for (const [index, theme] of themes.entries()) {
    for (let i = 0; i < 4; i += 1) {
      n += 1
      // Noon UTC, two puzzles a day for six days, so the run is the same whatever the clock says.
      const at = toTimestamp(startOfToday - (Math.floor((n - 1) / 2) + 1) * DAY + 12 * 3_600_000)
      await attemptsRepo.add(
        makePuzzleAttempt({
          id: toAttemptId(`attempt-${String(n)}`),
          puzzleId: toPuzzleId(`p-${theme}`),
          sessionId: undefined,
          startedAt: at,
          endedAt: at,
          durationMs: 120_000,
          firstTry: i < 3 - index,
          ratingBefore: 1400 + n * 5,
          ratingAfter: 1405 + n * 5,
        }),
      )
    }
  }

  const today = new Date(now).toISOString().slice(0, 10)
  await sessionsRepo.start({
    id: toSessionId('session-today'),
    kind: 'adaptive-puzzles',
    state: 'completed',
    day: toLocalDate(today),
    startedAt: toTimestamp(now - 3_600_000),
    updatedAt: toTimestamp(now),
    endedAt: toTimestamp(now),
    durationMs: 20 * 60_000,
    itemsAttempted: 12,
    itemsCorrect: 9,
    resumeState: {},
  })

  await gamesRepo.save(
    makeGame({
      meta: makeGameMeta({
        id: toGameId('g-progress'),
        startedAt: toTimestamp(now - 2 * DAY),
        accuracy: { white: 82, black: 60 },
      }),
      moves: [],
    }),
  )
}

describe('ProgressScreen', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('renders heading with accessible name "Growth"', async () => {
    renderProgressScreen()
    expect(await screen.findByRole('heading', { level: 1, name: 'Growth' })).toBeInTheDocument()
    expect(screen.getByText('Only you vs you. No leaderboards, ever.')).toBeInTheDocument()
  })

  it('passes automated accessibility checks, empty and filled', async () => {
    const empty = renderProgressScreen()
    await screen.findByRole('heading', { level: 2, name: /A seed, waiting/ })
    expect((await axe(empty.container, axeOptions)).violations.map((v) => v.id)).toEqual([])
    empty.unmount()

    await seed()
    const filled = renderProgressScreen()
    await screen.findByRole('img', { name: /Puzzle rating from/ })
    expect((await axe(filled.container, axeOptions)).violations.map((v) => v.id)).toEqual([])
  })

  it('ties the garden to the streak and the daily goal', async () => {
    await seed()
    renderProgressScreen()
    expect(await screen.findByText('7-day streak')).toBeInTheDocument()
    expect(screen.getByTestId('garden-water')).toHaveTextContent(/water|Watered|keeps it growing/i)
  })

  it('says what it is waiting for instead of showing made-up numbers', async () => {
    renderProgressScreen()
    expect(
      await screen.findByRole('heading', { level: 2, name: 'A seed, waiting for its first day' }),
    ).toBeInTheDocument()

    expect(screen.getByText('0-day streak')).toBeInTheDocument()
    expect(screen.getByText('Your chess garden · Level 1')).toBeInTheDocument()
    expect(screen.getByText(/Solve a few rated puzzles/)).toBeInTheDocument()
    expect(screen.getByText(/Review a game and its accuracy/)).toBeInTheDocument()
    expect(screen.getByText(/Practise a few puzzles in three different themes/)).toBeInTheDocument()
    expect(screen.queryByText('1482')).not.toBeInTheDocument()
    expect(screen.queryByText('Shudipto')).not.toBeInTheDocument()
  })

  it('draws the garden, metrics and charts from the stored rows', async () => {
    await seed()
    renderProgressScreen()

    expect(await screen.findByText('7-day streak')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Garden stages' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Practice days to Bloom' })).toBeInTheDocument()

    const puzzleCard = screen.getByText('Puzzle rating', { selector: '.label' }).closest('.card')
    expect(puzzleCard).not.toBeNull()
    expect(within(puzzleCard as HTMLElement).getByText('1482')).toBeInTheDocument()
    expect(within(puzzleCard as HTMLElement).getByText(/\+\d+ from 14\d\d/)).toBeInTheDocument()

    expect(
      screen.getByRole('img', { name: /Puzzle rating from 14\d\d to 14\d\d/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /Game accuracy from 82 to 82 percent/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('82.0%')).toBeInTheDocument()
  })

  it('builds the skill map from puzzle themes and offers somewhere to train', async () => {
    await seed()
    renderProgressScreen()

    expect(
      await screen.findByRole('img', { name: /^Theme mastery\./ }, { timeout: 4000 }),
    ).toHaveAccessibleName('Theme mastery. Fork 75, Mate in 2 25, Pin 50.')
    expect(screen.getByRole('heading', { level: 3, name: /Getting stronger/i })).toBeInTheDocument()
    const trainLinks = screen.getAllByRole('link', { name: /Train this/i })
    expect(trainLinks[0]).toHaveAttribute('href', '/puzzles')
    expect(screen.getByRole('button', { name: /Ask Sage about Mate in 2/ })).toBeInTheDocument()
  })

  it('switches time range and re-labels the comparison', async () => {
    renderProgressScreen()
    await screen.findByRole('heading', { level: 1, name: 'Growth' })

    expect(
      await screen.findByRole('heading', { level: 2, name: 'You vs you, 30 days ago' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '90 days' }))
    expect(
      screen.getByRole('heading', { level: 2, name: 'You vs you, 90 days ago' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'All time' }))
    expect(
      screen.getByRole('heading', { level: 2, name: 'You vs you, from the start' }),
    ).toBeInTheDocument()
    expect(screen.getByText('All-time journey')).toBeInTheDocument()
  })

  it('lists earned and upcoming milestones with real progress', async () => {
    await seed()
    renderProgressScreen()

    expect(await screen.findByText('10 puzzles solved')).toBeInTheDocument()
    expect(screen.getByText('7 days practised')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '50 puzzles solved progress' })).toHaveAttribute(
      'aria-valuenow',
      '12',
    )
    expect(screen.getByText('Puzzle rating 1500')).toBeInTheDocument()
  })

  it('paints today on the heatmap', async () => {
    await seed()
    renderProgressScreen()
    await screen.findByText('7-day streak')
    expect(
      screen.getByRole('img', { name: /Practice heatmap.*7 days practised/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Average session').nextSibling).toHaveTextContent('20 min')
  })
})

describe('ProgressScreen table alternatives', () => {
  beforeEach(async () => {
    await clearAllData()
    await seed()
  })

  it('gives every chart a data table with the same figures', async () => {
    const view = renderProgressScreen()
    await screen.findByRole('img', { name: /Puzzle rating from/ })
    await screen.findByRole('img', { name: /^Theme mastery\./ }, { timeout: 4000 })
    for (const summary of screen.getAllByText('View as table')) fireEvent.click(summary)

    const rating = screen.getByRole('table', { name: 'Puzzle rating by day' })
    expect(
      within(rating)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Day', 'Rating'])
    expect(within(rating).getAllByRole('row').length).toBeGreaterThan(1)

    const accuracy = screen.getByRole('table', { name: 'Game accuracy by day' })
    expect(within(accuracy).getByText('82', { exact: true })).toBeInTheDocument()

    const skills = screen.getByRole('table', { name: 'Theme mastery' })
    expect(within(skills).getByText('Fork')).toBeInTheDocument()

    const heat = screen.getByRole('table', { name: 'Practice per day over the last 16 weeks' })
    expect(within(heat).getAllByRole('row').length).toBeGreaterThan(1)

    expect((await axe(view.container, axeOptions)).violations.map((v) => v.id)).toEqual([])
  })

  it('opens the table from a keyboard-reachable disclosure', async () => {
    renderProgressScreen()
    await screen.findByRole('img', { name: /Puzzle rating from/ })
    await screen.findByRole('img', { name: /^Theme mastery\./ }, { timeout: 4000 })
    const summaries = screen.getAllByText('View as table')
    expect(summaries.length).toBe(4)
    for (const summary of summaries) expect(summary.tagName).toBe('SUMMARY')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const [first = document.body] = summaries
    fireEvent.click(first)
    expect(screen.getByRole('table', { name: 'Puzzle rating by day' })).toBeInTheDocument()
    fireEvent.click(first)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('reads the precomputed rows when they match, and live rows otherwise', async () => {
    const snapshot = await buildStatsSnapshot()
    const marked = {
      ...snapshot,
      models: {
        ...snapshot.models,
        '30d': {
          ...snapshot.models['30d'],
          garden: { ...snapshot.models['30d'].garden, level: 99 },
        },
      },
    }
    await kvRepo.set(STATS_SNAPSHOT_KEY, marked)
    const first = renderProgressScreen()
    expect(await screen.findByText('Your chess garden · Level 99')).toBeInTheDocument()
    first.unmount()

    await kvRepo.set(STATS_SNAPSHOT_KEY, { ...marked, signature: 'stale' })
    renderProgressScreen()
    expect(await screen.findByText(/Your chess garden · Level [1-5]$/)).toBeInTheDocument()
    expect(screen.queryByText('Your chess garden · Level 99')).not.toBeInTheDocument()
  })
})

describe('chart performance', () => {
  const points = Array.from({ length: 400 }, (_, i) => ({
    at: 1_700_000_000_000 + i * DAY,
    value: 1400 + Math.round(Math.sin(i / 20) * 80),
  }))

  /** Best of several runs: one slow run is the machine, not the code. */
  function fastest(run: () => void): number {
    let best = Infinity
    for (let i = 0; i < 15; i += 1) {
      const start = performance.now()
      run()
      best = Math.min(best, performance.now() - start)
    }
    return best
  }

  it('computes a chart from a year of stored points in under 16 ms', () => {
    const window = { from: points[0]?.at ?? 0, to: points.at(-1)?.at ?? 0 }
    expect(
      fastest(() => {
        chartGeometry(points, window)
      }),
    ).toBeLessThan(16)
  })

  it('renders the chart and its table from that geometry in under 16 ms', () => {
    const window = { from: points[0]?.at ?? 0, to: points.at(-1)?.at ?? 0 }
    // 90 days is the widest range with a daily series; "all time" is the same shape.
    const recent = points.slice(-90)
    const chart = chartGeometry(recent, { from: recent[0]?.at ?? 0, to: window.to })
    const views: { unmount: () => void }[] = []
    const elapsed = fastest(() => {
      views.push(
        render(
          <LineChart
            title="Puzzle rating"
            caption="All time"
            badge={undefined}
            chart={chart}
            colour="var(--q-best)"
            from={window.from}
            to={window.to}
            summary="Puzzle rating"
            empty="none"
            valueLabel="Rating"
          />,
        ),
      )
    })
    for (const view of views) view.unmount()
    expect(elapsed).toBeLessThan(16)
  })
})
