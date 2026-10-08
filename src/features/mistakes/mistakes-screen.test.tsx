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

import { kvRepo, mistakesRepo, srsCardsRepo } from '@/data'
import { ThemeProvider } from '@/design'
import { toTimestamp } from '@/domain'
import { lineMistake, newCard } from '@/features/srs/fixtures'

import { MistakesScreen } from './mistakes-screen'

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

const DAY = 86_400_000

function renderMistakesScreen() {
  const rootRoute = createRootRoute()
  const mistakesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/mistakes',
    component: MistakesScreen,
  })
  const routeTree = rootRoute.addChildren([mistakesRoute])
  const history = createMemoryHistory({ initialEntries: ['/mistakes'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

/** One mistake with its card; `dueDays` is relative to now, negative for overdue. */
async function seed(
  id: string,
  dueDays: number,
  options: { theme?: string; state?: 'new' | 'review'; origin?: string } = {},
): Promise<void> {
  const { theme = 'fork', state = 'new', origin = `vs Stockfish ${id}` } = options
  await mistakesRepo.add(lineMistake(id, { themes: [theme], originLabel: origin }))
  await srsCardsRepo.put(
    newCard(id, {
      state,
      reps: state === 'new' ? 0 : 3,
      stability: state === 'new' ? 0 : 6,
      lastReviewedAt: state === 'new' ? null : toTimestamp(Date.now() - 6 * DAY),
      due: toTimestamp(Date.now() + dueDays * DAY),
    }),
  )
}

beforeEach(async () => {
  await mistakesRepo.clear()
  await srsCardsRepo.clear()
  await kvRepo.clear()
})

describe('MistakesScreen', () => {
  it('shows a calm empty state before anything is banked', async () => {
    renderMistakesScreen()
    expect(await screen.findByText('Nothing in the bank yet')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Mistake Bank' })).toBeInTheDocument()
  })

  it('renders the due hero, schedule strip and pipeline from stored cards', async () => {
    await seed('a', -1)
    await seed('b', -2, { state: 'review' })
    await seed('c', 1, { state: 'review' })
    await seed('d', 3, { state: 'review' })
    renderMistakesScreen()

    expect(
      await screen.findByRole('heading', { level: 2, name: /2\s*due today/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/1 new, 1 you've seen before/)).toBeInTheDocument()

    const strip = within(screen.getByText('Coming up').parentElement!)
    expect(strip.getByText('Tomorrow').previousSibling).toHaveTextContent('1')
    expect(strip.getByText('In 3 days').previousSibling).toHaveTextContent('1')

    const pipeline = screen.getByRole('heading', { level: 2, name: /From missed to mastered/i })
    expect(pipeline).toBeInTheDocument()
    expect(screen.getByText(/4 positions/)).toBeInTheDocument()
    expect(screen.getByText('Not tried yet')).toBeInTheDocument()
    expect(screen.getByText('Recalled 3 times in a row')).toBeInTheDocument()
  })

  it('builds theme chips from the bank and filters the positions', async () => {
    await seed('a', -1, { theme: 'fork', origin: 'vs Fork Bot' })
    await seed('b', -1, { theme: 'pin', origin: 'vs Pin Bot' })
    renderMistakesScreen()

    expect(await screen.findByRole('button', { name: /^Fork · 1$/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Pin · 1$/ }))
    expect(screen.getByText('vs Pin Bot')).toBeInTheDocument()
    expect(screen.queryByText('vs Fork Bot')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^All · 2$/ }))
    expect(screen.getByText('vs Fork Bot')).toBeInTheDocument()
  })

  it('toggles the explanation behind the reveal button', async () => {
    await seed('a', -1)
    renderMistakesScreen()
    const reveal = await screen.findByRole('button', { name: /Reveal the better idea/i })
    expect(screen.getByText(/Reveal after you try/i)).toBeInTheDocument()
    fireEvent.click(reveal)
    expect(await screen.findByText(/The knight had nothing to do on g5/i)).toBeInTheDocument()
  })

  it('pages the list with a real Show more', async () => {
    for (let i = 0; i < 8; i += 1) await seed(`m${String(i)}`, -1)
    renderMistakesScreen()
    const more = await screen.findByRole('button', { name: /Show more \(2 left\)/ })
    expect(screen.getAllByRole('article')).toHaveLength(6)
    fireEvent.click(more)
    expect(screen.getAllByRole('article')).toHaveLength(8)
  })

  it('"Not today" moves every due card to tomorrow', async () => {
    await seed('a', -1)
    renderMistakesScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Not today' }))
    await waitFor(async () => {
      expect(await srsCardsRepo.countDue({ kind: 'mistake' })).toBe(0)
    })
  })

  it('starts a review from the hero, shows the recap on a miss, and saves the result', async () => {
    await seed('a', -1)
    renderMistakesScreen()
    fireEvent.click(await screen.findByRole('button', { name: /Start review/ }))

    expect(await screen.findByTestId('review-session')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Need a hint?' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show me' }))
    expect(await screen.findByText('The idea you missed')).toBeInTheDocument()
    expect(screen.getByText('Qf3+', { selector: '.san' })).toBeInTheDocument()
    expect(screen.getByText(/Back again in a few minutes/)).toBeInTheDocument()

    await waitFor(async () => {
      const card = await srsCardsRepo.get(newCard('a').id)
      expect(card?.state).toBe('learning')
      expect(card?.reps).toBe(1)
    })
  })

  it('plays a correct line through to the end of the session', async () => {
    await seed('a', -1)
    renderMistakesScreen()
    fireEvent.click(await screen.findByRole('button', { name: /Start review/ }))
    await screen.findByTestId('review-session')

    const click = (square: string) => {
      const target = document.querySelector(`[data-square="${square}"]`)
      if (target === null) throw new Error(`no square ${square}`)
      fireEvent.click(target)
    }
    click('f6')
    click('f3')
    // The scripted reply (Kg1) arrives a beat later; then the finishing move.
    await waitFor(() => {
      expect(document.querySelector('[data-square="g1"]')).not.toBeNull()
    })
    await new Promise((resolve) => setTimeout(resolve, 600))
    click('f3')
    click('e2')

    expect(await screen.findByText("That's the idea")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /See how it went/ }))
    expect(await screen.findByTestId('review-done')).toBeInTheDocument()
    expect(screen.getByText(/1 of 1 recalled/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the bank' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mistake Bank' }),
    ).toBeInTheDocument()
  })

  it('"Try it" opens a single position even when it is not due', async () => {
    await seed('a', 5, { state: 'review' })
    renderMistakesScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Try it' }))
    expect(await screen.findByTestId('review-session')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Leave review' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mistake Bank' }),
    ).toBeInTheDocument()
  })

  it('passes accessibility audit', async () => {
    await seed('a', -1)
    const { container } = renderMistakesScreen()
    await screen.findByRole('heading', { level: 2, name: /due today/i })
    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})
