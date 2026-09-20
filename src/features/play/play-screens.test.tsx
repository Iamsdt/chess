import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { gamesRepo, newGameId, settingsRepo } from '@/data'
import { ThemeProvider } from '@/design'
import { makeEngineEval, ok, START_FEN, toJobId, toTimestamp, toUci } from '@/domain'
import type { EngineEval, EngineLine, Result } from '@/domain'

import { createPlayState, playReducer } from './machine'
import { createSavedGame } from './persistence'
import { PlayGameScreen } from './play-game-screen'
import { PlaySetupScreen } from './play-setup-screen'
import { PlayPortsContext } from './ports'

import type { PlayConfig } from './machine'
import type { PlayPorts } from './ports'

/**
 * The two screens, rendered against real repositories and a fake engine.
 *
 * The router is a miniature of the app's, carrying only the three paths these
 * screens link to. That keeps the test about the screens instead of the shell,
 * while still exercising the `<Link>`s rather than stubbing them out.
 */

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      // Nothing is ever laid out in jsdom, so there is nothing to report.
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
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {
    // The router restores scroll on navigation; jsdom has nothing to scroll.
  })
})

/** colour-contrast needs real pixels to sample; jsdom has none. */
const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

const ports: PlayPorts = {
  engine: {
    bestMove: (fen) =>
      Promise.resolve(
        ok({
          move: toUci('e7e5'),
          ponder: null,
          line: null,
          eval: makeEngineEval({ fen, score: { kind: 'cp', value: 15 } }),
        }),
      ),
    analyse: (): AsyncGenerator<readonly EngineLine[], Result<EngineEval>, void> =>
      (async function* stream(): AsyncGenerator<readonly EngineLine[], Result<EngineEval>, void> {
        await Promise.resolve()
        yield []
        return ok(makeEngineEval())
      })(),
  },
  queue: { enqueueGameReview: vi.fn(() => Promise.resolve(ok(toJobId('job_1')))) },
  random: () => 0.99,
}

function renderAt(path: '/play' | '/play/game') {
  const rootRoute = createRootRoute()
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/play', component: PlaySetupScreen }),
    createRoute({ getParentRoute: () => rootRoute, path: '/play/game', component: PlayGameScreen }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/games',
      component: function Games() {
        return <h1>My games</h1>
      },
    }),
  ])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  return render(
    <ThemeProvider>
      <PlayPortsContext value={ports}>
        <RouterProvider router={router} />
      </PlayPortsContext>
    </ThemeProvider>,
  )
}

beforeEach(async () => {
  await gamesRepo.clear()
  await settingsRepo.clear()
})

describe('the setup screen', () => {
  it('renders one h1 and the summary of the chosen game', async () => {
    renderAt('/play')
    await setupFormReady()
    expect(screen.getByRole('heading', { level: 1, name: 'New game' })).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: /vs Stockfish 1200/ })).toBeVisible()
  })

  // jsdom has no slider behaviour of its own, so the value is set the way the
  // browser would set it and the rest of the screen is what is under test.
  it('moves the rating and the summary together', async () => {
    renderAt('/play')
    const slider = await setupFormReady()
    fireEvent.change(slider, { target: { value: '1750' } })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /vs Stockfish 1750/ })).toBeVisible()
    })
    expect(screen.getByText('A stretch')).toBeVisible()
  })

  it('offers the FEN field only when a pasted position is chosen', async () => {
    const user = userEvent.setup()
    renderAt('/play')
    await setupFormReady()

    expect(screen.queryByLabelText('FEN')).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Paste a FEN/ }))
    const field = await screen.findByLabelText('FEN')

    await user.type(field, 'not a position')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Start game/ })).toBeDisabled()
    })
  })

  it('has no axe violations', async () => {
    const { container } = renderAt('/play')
    await setupFormReady()
    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})

function config(overrides: Partial<PlayConfig> = {}): PlayConfig {
  return {
    youPlay: 'white',
    yourName: 'You',
    yourRating: 1200,
    opponentRating: 1200,
    personality: 'solid',
    timeControl: { kind: 'untimed' },
    initialFen: START_FEN,
    trainingWheels: false,
    showEvaluation: false,
    allowTakebacks: true,
    ...overrides,
  }
}

/** The form replaces a loading line once settings have been read, so every setup
 *  test waits for the control rather than for the heading. */
async function setupFormReady() {
  return screen.findByRole('slider', { name: 'Opponent rating' })
}

async function seed(): Promise<void> {
  const state = playReducer(
    createPlayState(config(), newGameId(), toTimestamp(1_700_000_000_000)),
    { type: 'start', at: toTimestamp(1_700_000_000_000) },
  )
  await createSavedGame(state)
}

describe('the game screen', () => {
  it('invites a new game when there is nothing in progress', async () => {
    renderAt('/play/game')
    expect(await screen.findByText('No game in progress')).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 1, name: 'Sparring' })).toHaveLength(1)
  })

  it('shows the board, both clocks-less players and the move list of a saved game', async () => {
    await seed()
    renderAt('/play/game')

    expect(await screen.findByRole('grid', { name: 'Sparring board' })).toBeVisible()
    expect(screen.getByText('Stockfish 1200')).toBeVisible()
    expect(screen.getByText(/No moves yet/)).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('ends the game on resign and queues the review', async () => {
    const user = userEvent.setup()
    await seed()
    renderAt('/play/game')
    await screen.findByRole('grid', { name: 'Sparring board' })

    await user.click(screen.getByRole('button', { name: /Resign/ }))
    await user.click(await screen.findByRole('button', { name: 'Resign and review' }))

    expect(await screen.findByRole('heading', { name: 'Stockfish won' })).toBeVisible()
    expect(ports.queue.enqueueGameReview).toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    await seed()
    const { container } = renderAt('/play/game')
    await screen.findByRole('grid', { name: 'Sparring board' })
    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})
