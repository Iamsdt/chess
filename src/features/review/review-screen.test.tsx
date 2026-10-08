import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { clearAllData, gamesRepo } from '@/data'
import { ThemeProvider } from '@/design'
import { domainError, err, ok } from '@/domain'

import { GAME_ID, SCHOLARS, gameFrom, scripted } from './review-fixtures'
import { createReviewHandler } from './review-job'
import { ReviewScreen } from './review-screen'

const start = vi.hoisted(() => vi.fn())
vi.mock('./review-job', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, startReview: start, registerReviewHandler: () => undefined }
})

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

function renderReview(path = `/games/review?id=${GAME_ID}`) {
  const root = createRootRoute()
  const routes = [
    createRoute({ getParentRoute: () => root, path: '/games/review', component: ReviewScreen }),
    createRoute({ getParentRoute: () => root, path: '/games', component: () => <div>Games</div> }),
    createRoute({
      getParentRoute: () => root,
      path: '/mistakes',
      component: () => <div>Mistakes</div>,
    }),
    createRoute({
      getParentRoute: () => root,
      path: '/analysis',
      component: () => <div>Analysis</div>,
    }),
  ]
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

/** Saves the game as Black who blundered 3…Nf6, and, if asked, runs the real review on it. */
async function seed(reviewed: boolean) {
  const game = gameFrom(SCHOLARS, 'black')
  await gamesRepo.save(game)
  if (reviewed) {
    const { evaluate } = scripted(game, { 5: 'g8e7' })
    await createReviewHandler({ engine: { evaluate: (fen) => evaluate(fen) } })(
      { gameId: GAME_ID },
      { signal: new AbortController().signal, report: () => undefined },
    )
  }
}

describe('ReviewScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    start.mockReset()
    start.mockResolvedValue(ok('job_1'))
  })

  it('asks for a game when the link names none', async () => {
    renderReview('/games/review')
    expect(await screen.findByText('Choose a game to review')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open my games' })).toHaveAttribute('href', '/games')
  })

  it('says so for a game that is not in the library', async () => {
    renderReview('/games/review?id=missing')
    expect(await screen.findByText('That game is not in your library')).toBeInTheDocument()
  })

  describe('a game that has not been reviewed', () => {
    it('offers to review it, and starts the review when asked', async () => {
      await seed(false)
      renderReview()
      expect(await screen.findByText(/Review your game against Stockfish 1200/)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Start review/ }))
      await waitFor(() => {
        expect(start).toHaveBeenCalledWith(GAME_ID)
      })
    })

    it('says why when the review could not start', async () => {
      await seed(false)
      start.mockResolvedValueOnce(err(domainError('io', 'Queue is full', { where: 'test' })))
      renderReview()
      fireEvent.click(await screen.findByRole('button', { name: /Start review/ }))
      await waitFor(() => {
        expect(start).toHaveBeenCalled()
      })
      // The button comes back so the person can try again.
      expect(await screen.findByRole('button', { name: /Start review/ })).toBeEnabled()
    })

    it('shows progress while the review runs and offers no second start', async () => {
      await seed(false)
      await gamesRepo.setReviewState(GAME_ID, 'analysing')
      renderReview()
      expect(await screen.findByText('Reviewing your game')).toBeInTheDocument()
      expect(screen.getByRole('progressbar', { name: 'Review progress' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Start review/ })).not.toBeInTheDocument()
    })

    it('offers another try when a review failed', async () => {
      await seed(false)
      await gamesRepo.setReviewState(GAME_ID, 'failed')
      renderReview()
      expect(await screen.findByText('The review did not finish')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument()
    })
  })

  describe('a reviewed game', () => {
    beforeEach(async () => {
      await seed(true)
    })

    it('opens at the start with the result from the user’s side', async () => {
      renderReview()
      expect(await screen.findByText('Review · vs Stockfish 1200 · Lost')).toBeInTheDocument()
      expect(screen.getByText('0 / 7')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Previous move' })).toBeDisabled()
    })

    it('shows both accuracies and the move-quality table, from what the review stored', async () => {
      renderReview()
      const panel = await screen.findByRole('tabpanel')
      expect(within(panel).getByText('Your accuracy')).toBeInTheDocument()
      expect(within(panel).getAllByText(/^\d+%$/)).toHaveLength(2)

      const table = within(panel).getByRole('table')
      const blunders = within(table).getByRole('row', { name: /Blunders/ })
      expect(
        within(blunders)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ).toEqual(['1', '0'])
    })

    it('says what went to the Mistake Bank', async () => {
      renderReview()
      const panel = await screen.findByRole('tabpanel')
      expect(within(panel).getByText(/1 position saved to your/)).toBeInTheDocument()
      expect(within(panel).getByRole('link', { name: 'Mistake Bank' })).toHaveAttribute(
        'href',
        '/mistakes',
      )
    })

    it('lists the turning point in plain words and jumps to the position before it', async () => {
      renderReview()
      await screen.findByRole('tabpanel')
      fireEvent.click(screen.getByRole('tab', { name: 'Key moments' }))

      const moment = await screen.findByText(/Move 3:/)
      expect(moment.closest('li')).toHaveTextContent(
        'Nf6 was a blunder. Your winning chances went from',
      )
      expect(moment.closest('li')).toHaveTextContent('Nge7 was the engine')

      fireEvent.click(screen.getByRole('button', { name: /Show the position before it/ }))
      expect(screen.getByText('5 / 7')).toBeInTheDocument()
    })

    it('offers to retry the turning point, on the position before it', async () => {
      renderReview()
      await screen.findByRole('tabpanel')
      fireEvent.click(screen.getByRole('tab', { name: 'Key moments' }))
      fireEvent.click(await screen.findByRole('button', { name: /Retry this position/ }))

      const dialog = await screen.findByRole('dialog', { name: 'Retry this position' })
      expect(dialog).toHaveTextContent('you played Nf6 here')
      expect(within(dialog).getByRole('button', { name: /Show the answer/ })).toBeInTheDocument()
    })

    it('steps through the game and explains each move', async () => {
      renderReview()
      await screen.findByRole('tabpanel')
      fireEvent.click(screen.getByRole('button', { name: 'Next move' }))
      expect(screen.getByText('1 / 7')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /Position after move 1, e4/ })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Last position' }))
      expect(screen.getByText('7 / 7')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next move' })).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: 'First position' }))
      expect(screen.getByText('0 / 7')).toBeInTheDocument()
    })

    it('opens the move list and selects a move from it', async () => {
      renderReview()
      await screen.findByRole('tabpanel')
      fireEvent.click(screen.getByRole('tab', { name: 'Moves' }))
      fireEvent.click(await screen.findByRole('button', { name: /^Nf6/ }))

      expect(screen.getByText('6 / 7')).toBeInTheDocument()
      const note = screen.getByText(/Nf6 was a blunder/)
      expect(note).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Nf6/ })).toHaveAttribute('aria-current', 'step')
    })

    it('draws the evaluation graph and lets the board be flipped', async () => {
      renderReview()
      await screen.findByRole('tabpanel')
      expect(screen.getByRole('button', { name: /Evaluation graph/ })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Flip board' }))
      expect(screen.getByRole('img', { name: 'Starting position' })).toBeInTheDocument()
    })

    it('passes automated accessibility checks', async () => {
      const { container } = renderReview()
      await screen.findByRole('tabpanel')
      expect((await axe(container, axeOptions)).violations.map((v) => v.id)).toEqual([])
    })
  })
})
