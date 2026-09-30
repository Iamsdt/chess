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

import { ProgressScreen } from './progress-screen'

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

describe('ProgressScreen', () => {
  it('renders heading with accessible name "Growth"', async () => {
    renderProgressScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Growth' })
    expect(heading).toBeInTheDocument()

    expect(screen.getByText('Only you vs you. No leaderboards, ever.')).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderProgressScreen()
    await screen.findByRole('heading', { level: 1, name: 'Growth' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('renders garden hero with streak, sapling stage, and bloom progress', async () => {
    renderProgressScreen()
    await screen.findByRole('heading', { level: 1, name: 'Growth' })

    expect(screen.getByText('12-day streak')).toBeInTheDocument()
    expect(screen.getByText('Your chess garden · Level 4')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Sapling, and nearly in bloom' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Garden stages' })).toBeInTheDocument()
    expect(screen.getAllByText('12 of 15')).toHaveLength(2)
    expect(screen.getByRole('progressbar', { name: 'Practice days to Bloom' })).toBeInTheDocument()

    const waterBtn = screen.getByRole('link', { name: /Water it today/i })
    expect(waterBtn).toHaveAttribute('href', '/')

    const howItGrowsBtn = screen.getByRole('button', { name: /How it grows/i })
    expect(howItGrowsBtn).toBeInTheDocument()
    fireEvent.click(howItGrowsBtn)
  })

  it('switches time range between 30 days, 90 days, and All time', async () => {
    renderProgressScreen()
    await screen.findByRole('heading', { level: 1, name: 'Growth' })

    expect(
      screen.getByRole('heading', { level: 2, name: 'You vs you, 30 days ago' }),
    ).toBeInTheDocument()
    expect(screen.getByText('20 Aug → 19 Sep')).toBeInTheDocument()
    expect(screen.getByText('+64 from 1418')).toBeInTheDocument()

    const btn90 = screen.getByRole('button', { name: '90 days' })
    fireEvent.click(btn90)
    expect(
      screen.getByRole('heading', { level: 2, name: 'You vs you, 90 days ago' }),
    ).toBeInTheDocument()
    expect(screen.getByText('21 Jun → 19 Sep')).toBeInTheDocument()
    expect(screen.getByText('+142 from 1340')).toBeInTheDocument()

    const btnAll = screen.getByRole('button', { name: 'All time' })
    fireEvent.click(btnAll)
    expect(
      screen.getByRole('heading', { level: 2, name: 'You vs you, from the start' }),
    ).toBeInTheDocument()
    expect(screen.getByText('All-time journey')).toBeInTheDocument()
    expect(screen.getByText('+282 from 1200')).toBeInTheDocument()
  })

  it('renders rating charts for puzzles and sparring', async () => {
    renderProgressScreen()
    await screen.findByRole('heading', { level: 1, name: 'Growth' })

    expect(
      screen.getByRole('img', { name: 'Puzzle rating rose from 1418 to 1482 over 30 days' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Sparring rating rose from 1124 to 1180 over 30 days' }),
    ).toBeInTheDocument()
  })

  it('renders skill map radar, getting stronger links, and focus areas with Sage trigger', async () => {
    renderProgressScreen()
    await screen.findByRole('heading', { level: 1, name: 'Growth' })

    expect(screen.getByRole('heading', { level: 2, name: 'Skill map' })).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: 'Skill radar. Tactics 78, Openings 72, Endgames 42, Calculation 60, Time use 50, Board vision 66. Every skill grew except Endgames, which is flat.',
      }),
    ).toBeInTheDocument()

    expect(screen.getByText('+2 · flat')).toBeInTheDocument()

    // Strengths
    expect(screen.getByRole('heading', { level: 3, name: /Getting stronger/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Repertoire' })).toHaveAttribute('href', '/openings')

    // Weaknesses
    expect(
      screen.getByRole('heading', { level: 3, name: /Needs a little love/i }),
    ).toBeInTheDocument()
    const trainLinks = screen.getAllByRole('link', { name: /Train this/i })
    expect(trainLinks).toHaveLength(3)
    expect(trainLinks[0]).toHaveAttribute('href', '/drills/endgames')
    expect(trainLinks[1]).toHaveAttribute('href', '/play')
    expect(trainLinks[2]).toHaveAttribute('href', '/mistakes')

    const sageBtn = screen.getByRole('button', { name: 'Ask Sage why Endgames is flat' })
    expect(sageBtn).toBeInTheDocument()
    fireEvent.click(sageBtn)
  })

  it('renders 16-week practice heatmap and activity stats', async () => {
    renderProgressScreen()
    await screen.findByRole('heading', { level: 1, name: 'Growth' })

    expect(
      screen.getByRole('heading', { level: 2, name: 'Practice, last 16 weeks' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Practice heatmap for the last 16 weeks' }),
    ).toBeInTheDocument()

    expect(screen.getByText('Evenings, around 8pm')).toBeInTheDocument()
    expect(screen.getByText('14 min')).toBeInTheDocument()
    expect(screen.getByText('Thursdays')).toBeInTheDocument()
    expect(screen.getByText('17 of 19 days')).toBeInTheDocument()
  })

  it('renders milestones with badges and progress indicators', async () => {
    renderProgressScreen()
    await screen.findByRole('heading', { level: 1, name: 'Growth' })

    expect(screen.getByRole('heading', { level: 2, name: 'Milestones' })).toBeInTheDocument()

    // Completed
    expect(screen.getByText('A week without blunders')).toBeInTheDocument()
    expect(screen.getByText('Earned 14 Sep')).toBeInTheDocument()
    expect(screen.getByText('Beat Stockfish 1200')).toBeInTheDocument()
    expect(screen.getByText('Earned 9 Sep')).toBeInTheDocument()
    expect(screen.getByText('First mistake mastered')).toBeInTheDocument()
    expect(screen.getByText('Earned 28 Aug')).toBeInTheDocument()

    // In progress
    expect(screen.getByText('Build the bridge')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Build the bridge progress' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()

    expect(screen.getByText('Puzzle rating 1500')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Puzzle rating 1500 progress' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1482 of 1500')).toBeInTheDocument()

    expect(screen.getByText('First bloom')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'First bloom progress' })).toBeInTheDocument()
  })
})
