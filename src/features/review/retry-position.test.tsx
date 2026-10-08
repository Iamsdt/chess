import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/design'
import { domainError, err, makeEngineEval, ok, type MoveRecord, type EngineScore } from '@/domain'

import { reviewGame } from './analyse'
import { RetryPosition } from './retry-position'
import { SCHOLARS, gameFrom, scripted } from './review-fixtures'

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
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  // Capture is meaningless without a real pointer; the board only needs it not to throw.
  Element.prototype.setPointerCapture = function setPointerCapture(): void {
    // See above.
  }
  Element.prototype.releasePointerCapture = function releasePointerCapture(): void {
    // See above.
  }
  Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
    return false
  }
})

/** Black's 3…Nf6, reviewed against an engine that preferred 3…Nge7. */
async function blunder(): Promise<MoveRecord> {
  const game = gameFrom(SCHOLARS, 'black')
  const review = await reviewGame(game, scripted(game, { 5: 'g8e7' }).evaluate)
  const move = review.ok ? review.value.moves[5] : undefined
  if (move === undefined) throw new Error('fixture review has no 3…Nf6')
  return move
}

function engineSaying(score: EngineScore | 'fails') {
  return {
    evaluate: vi.fn((fen: string) =>
      Promise.resolve(
        score === 'fails'
          ? err(domainError('engine', 'The engine stopped', { where: 'test' }))
          : ok(makeEngineEval({ fen: fen as never, score })),
      ),
    ),
  }
}

/** The dialog's own message; the board repeats it in a hidden live region for screen readers. */
async function said(text: string | RegExp): Promise<void> {
  await waitFor(() => {
    expect(within(screen.getByRole('dialog')).getByTestId('retry-message')).toHaveTextContent(text)
  })
}

async function open(engine: ReturnType<typeof engineSaying>) {
  const move = await blunder()
  const root = createRootRoute({
    component: () => (
      <RetryPosition
        move={move}
        orientation="black"
        open
        onClose={() => undefined}
        engine={engine}
      />
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([createRoute({ getParentRoute: () => root, path: '/play' })]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const view = render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
  await screen.findByRole('dialog')
  const square = (name: string): Element => {
    const found = document.querySelector(`[data-square="${name}"]`)
    if (found === null) throw new Error(`no square ${name}`)
    return found
  }
  return { view, square, user: userEvent.setup() }
}

describe('RetryPosition', () => {
  it('opens on the position before the mistake and asks for a better move', async () => {
    await open(engineSaying({ kind: 'cp', value: 0 }))
    await said(/Find a better move than Nf6/)
    expect(screen.getByText(/you played Nf6 here/)).toBeInTheDocument()
  })

  it('celebrates the engine’s move without asking the engine', async () => {
    const engine = engineSaying({ kind: 'cp', value: 0 })
    const { square, user } = await open(engine)
    await user.click(square('g8'))
    await user.click(square('e7'))
    await said(/Yes, Nge7 is what the engine chose/)
    expect(engine.evaluate).not.toHaveBeenCalled()
  })

  it('tells the user when they repeat the move from the game', async () => {
    const engine = engineSaying({ kind: 'cp', value: 0 })
    const { square, user } = await open(engine)
    await user.click(square('g8'))
    await user.click(square('f6'))
    await said(/the move you played in the game/)
    expect(engine.evaluate).not.toHaveBeenCalled()
  })

  it('asks the engine about any other move and accepts one that holds the position', async () => {
    const engine = engineSaying({ kind: 'cp', value: 0 })
    const { square, user } = await open(engine)
    await user.click(square('d8'))
    await user.click(square('e7'))
    await said(/That holds the position too/)
    expect(engine.evaluate).toHaveBeenCalledTimes(1)
  })

  it('rejects one that still loses, and lets the user try again', async () => {
    const { square, user } = await open(engineSaying({ kind: 'cp', value: 900 }))
    await user.click(square('d8'))
    await user.click(square('e7'))
    await said(/still gives away winning chances/)
    // The board is back as it was: the user can pick another piece.
    await user.click(square('g8'))
    await user.click(square('e7'))
    await said(/Yes, Nge7/)
  })

  it('says so when the engine cannot check the move', async () => {
    const { square, user } = await open(engineSaying('fails'))
    await user.click(square('d8'))
    await user.click(square('e7'))
    await said(/engine could not check that move/)
  })

  it('shows the answer on request, and starts over', async () => {
    const { user } = await open(engineSaying({ kind: 'cp', value: 0 }))
    await user.click(screen.getByRole('button', { name: /Show the answer/ }))
    await said('The engine preferred Nge7.')
    await user.click(screen.getByRole('button', { name: /Start over/ }))
    await said(/Find a better move than Nf6/)
  })
})
