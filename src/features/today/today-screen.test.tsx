import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import {
  attemptsRepo,
  clearAllData,
  KV_KEYS,
  kvRepo,
  mistakesRepo,
  profileRepo,
  puzzlesRepo,
  sessionsRepo,
  srsCardsRepo,
} from '@/data'
import { ThemeProvider } from '@/design'
import {
  createProfile,
  makeMistakeEntry,
  makePuzzle,
  makePuzzleAttempt,
  makeSrsCard,
  toMistakeId,
  toPuzzleId,
  toSrsCardId,
  toAttemptId,
  toLocalDate,
  toSessionId,
  toTimestamp,
} from '@/domain'
import { advanceStreak } from '@/features/habit'

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
  const dummyPlay = createRoute({
    getParentRoute: () => rootRoute,
    path: '/play',
    component: () => <div>Play</div>,
  })
  const dummyGames = createRoute({
    getParentRoute: () => rootRoute,
    path: '/games',
    component: () => <div>Games</div>,
  })
  const dummySettings = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: () => <div>Settings</div>,
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
    dummyPlay,
    dummyGames,
    dummySettings,
  ])

  const history = createMemoryHistory({ initialEntries: ['/'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

const DAY = 86_400_000

const todayString = () => new Date().toISOString().slice(0, 10)

async function addSession(
  kind: 'daily-puzzle' | 'adaptive-puzzles' | 'sparring',
  minutes: number,
  id: string,
) {
  const now = Date.now()
  await sessionsRepo.start({
    id: toSessionId(id),
    kind,
    state: 'completed',
    day: toLocalDate(todayString()),
    startedAt: toTimestamp(now - 600_000),
    updatedAt: toTimestamp(now),
    endedAt: toTimestamp(now),
    durationMs: minutes * 60_000,
    itemsAttempted: 3,
    itemsCorrect: 3,
    resumeState: {},
  })
}

async function seedProfile() {
  await profileRepo.save({
    ...createProfile({ displayName: 'Ada', skillLevel: 'club', timeZone: 'UTC' }),
    puzzleRating: 1460,
  })
}

async function seedWeek() {
  await seedProfile()
  const now = Date.now()
  await addSession('adaptive-puzzles', 6, 's-today')
  await kvRepo.set(
    KV_KEYS.streak,
    advanceStreak(undefined, {
      today: toLocalDate(todayString()),
      ms: 6 * 60_000,
      goalMs: 15 * 60_000,
      at: toTimestamp(now),
    }),
  )
  for (const [i, days] of [20, 10, 1].entries()) {
    await attemptsRepo.add(
      makePuzzleAttempt({
        id: toAttemptId(`a-${String(i)}`),
        sessionId: toSessionId('s-today'),
        endedAt: toTimestamp(now - days * DAY),
        ratingBefore: 1400 + i * 20,
        ratingAfter: 1420 + i * 20,
      }),
    )
  }
}

/** Twelve attempts across three themes: fork 4/4, pin 2/4, mate in 2 0/4 first time. */
async function seedThemes() {
  const themes = [
    ['fork', 4],
    ['pin', 2],
    ['mateIn2', 0],
  ] as const
  await puzzlesRepo.bulkUpsert(
    themes.map(([theme]) => makePuzzle({ id: toPuzzleId(`p-${theme}`), theme })),
  )
  const now = Date.now()
  let n = 0
  for (const [theme, firstTries] of themes) {
    for (let i = 0; i < 4; i += 1) {
      n += 1
      await attemptsRepo.add(
        makePuzzleAttempt({
          id: toAttemptId(`t-${String(n)}`),
          puzzleId: toPuzzleId(`p-${theme}`),
          sessionId: undefined,
          endedAt: toTimestamp(now - n * 3_600_000),
          firstTry: i < firstTries,
        }),
      )
    }
  }
}

async function seedDueMistake() {
  await mistakesRepo.add(
    makeMistakeEntry({ id: toMistakeId('m1'), originLabel: 'vs Stockfish 1200' }),
  )
  await srsCardsRepo.put(
    makeSrsCard({
      id: toSrsCardId('c1'),
      subject: { kind: 'mistake', mistakeId: toMistakeId('m1') },
      state: 'review',
      due: toTimestamp(Date.now() - DAY),
    }),
  )
}

describe('TodayScreen', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('renders heading with accessible name "Today"', async () => {
    renderTodayScreen()
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
  })

  it('gives a brand-new person a calm, honest first day', async () => {
    renderTodayScreen()
    const heading = await screen.findByRole('heading', { level: 1, name: 'Today' })
    expect(heading).toHaveTextContent(/^Good (morning|afternoon|evening)$/)

    expect(screen.getByRole('heading', { level: 2, name: "Today's path" })).toBeInTheDocument()
    expect(screen.getByText('Daily puzzle')).toBeInTheDocument()
    expect(screen.getByText('Solve a few puzzles')).toBeInTheDocument()
    expect(screen.getByText(/0 of 3/)).toBeInTheDocument()
    expect(screen.getByText(/0 of 15 min today/)).toBeInTheDocument()

    expect(screen.getByText('Start your streak today')).toBeInTheDocument()
    expect(screen.getByText(/Solve a few rated puzzles/)).toBeInTheDocument()
    expect(screen.getByText(/Nothing saved yet/)).toBeInTheDocument()
    expect(screen.getByText(/shows up here/)).toBeInTheDocument()

    // Nothing from the prototype may leak into a real person's first day.
    for (const invented of [
      'Shudipto',
      '1482',
      'Rafi',
      'Double attacks',
      'solved in 8s',
      'Sage noticed',
    ]) {
      expect(screen.queryByText(new RegExp(invented))).not.toBeInTheDocument()
    }
  })

  it('ticks a step off when that practice happened today, and moves on to the next', async () => {
    await seedProfile()
    await addSession('daily-puzzle', 2, 's-daily')
    renderTodayScreen()

    expect(await screen.findByText(/1 of 3/)).toBeInTheDocument()
    const path = screen.getByRole('list', { name: '', hidden: true })
    expect(path).toBeDefined()
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start · 5 min/ })).toHaveAttribute('href', '/puzzles')
  })

  it('finishes the day when every step is done, and offers a game for anyone with time', async () => {
    await seedProfile()
    await addSession('daily-puzzle', 2, 's-daily')
    await addSession('adaptive-puzzles', 5, 's-puzzles')
    await addSession('sparring', 8, 's-game')
    renderTodayScreen()

    expect(await screen.findByText(/3 of 3/)).toBeInTheDocument()
    expect(screen.getByText(/That's today's path/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Play' })).toHaveAttribute('href', '/play')
  })

  it('puts a due mistake on the board as the next step', async () => {
    await seedProfile()
    await addSession('daily-puzzle', 2, 's-daily')
    await addSession('adaptive-puzzles', 5, 's-puzzles')
    await addSession('sparring', 8, 's-game')
    await seedDueMistake()
    renderTodayScreen()

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Give a mistake a second chance' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Mistake review: White to play/ })).toBeInTheDocument()
    expect(screen.getByText('vs Stockfish 1200')).toBeInTheDocument()
    expect(screen.getByText(/1 due · 1 saved/)).toBeInTheDocument()
  })

  it('aims practice at the weakest theme and says so in the patterns', async () => {
    await seedProfile()
    await seedThemes()
    renderTodayScreen()

    expect(await screen.findByText('Sharpen mate in 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Mate in 2 is your toughest theme' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Fork is working' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Practise mate in 2' })).toHaveAttribute(
      'href',
      '/puzzles',
    )
  })

  it('reads the name, rating, streak, week and goal from what is stored', async () => {
    await seedWeek()
    renderTodayScreen()

    expect(await screen.findByText('1 day streak')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Ada$/)
    expect(screen.getByText('1460')).toBeInTheDocument()
    expect(screen.getByText('+60')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /last 30 days, up 60/ })).toBeInTheDocument()
    expect(screen.getByText(/6 of 15 min today/)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'This week' })).toHaveTextContent(/practised/)
  })

  it('passes basic accessibility audit, empty and full', async () => {
    const empty = renderTodayScreen()
    await screen.findByRole('heading', { level: 1, name: 'Today' })
    expect((await axe(empty.container, axeOptions)).violations.map((v) => v.id)).toEqual([])
    empty.unmount()

    await seedWeek()
    await seedThemes()
    await seedDueMistake()
    const full = renderTodayScreen()
    await screen.findByText('1 day streak')
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: /toughest theme/ })).toBeInTheDocument()
    })
    expect((await axe(full.container, axeOptions)).violations.map((v) => v.id)).toEqual([])
  })
})
