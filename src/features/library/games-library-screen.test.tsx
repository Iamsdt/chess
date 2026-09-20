import 'fake-indexeddb/auto'

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'

import { gamesRepo } from '@/data'
import { makeGame, makeGameMeta, toGameId, toTimestamp } from '@/domain'
import type { Game, GameMeta } from '@/domain'

import { GamesLibraryScreen } from './games-library-screen'

/**
 * The screen, against a real repository.
 *
 * jsdom lays nothing out, so the virtualizer renders its first window and no more —
 * which is enough to prove the rows are built from the right data and that the header
 * controls sort them. What is deliberately *not* asserted here is scrolling: a
 * virtualized list cannot be scrolled without a layout engine, and pretending otherwise
 * would be a test of the mock rather than of the table.
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

  // The virtualizer sizes its window from `offsetWidth`/`offsetHeight`, which jsdom
  // reports as zero for everything; without a size it would render no rows at all.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 900 })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 560 })
})

const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

function gameFor(id: string, overrides: Partial<GameMeta>): Game {
  const meta = makeGameMeta({ id: toGameId(id), ...overrides })
  const base = makeGame()
  return { meta, moves: base.moves.map((move) => ({ ...move, gameId: meta.id })) }
}

const ITALIAN = gameFor('g-italian', {
  startedAt: toTimestamp(3_000),
  result: '1-0',
  youPlay: 'white',
  black: { kind: 'engine', name: 'Stockfish 1200', rating: 1200 },
  opening: { eco: 'C54', name: 'Italian Game' },
  reviewState: 'reviewed',
})

const SICILIAN = gameFor('g-sicilian', {
  startedAt: toTimestamp(1_000),
  result: '1-0',
  youPlay: 'black',
  white: { kind: 'human', name: 'Rafi' },
  black: { kind: 'you', name: 'me' },
  source: 'lichess',
  opening: { eco: 'B22', name: 'Sicilian Defense' },
  reviewState: 'not-reviewed',
  accuracy: { white: 90, black: 61 },
})

beforeEach(async () => {
  await gamesRepo.clear()
})

describe('<GamesLibraryScreen>', () => {
  it('owns exactly one h1', async () => {
    render(<GamesLibraryScreen />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My games')
    })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('invites a first import when the library is empty', async () => {
    render(<GamesLibraryScreen />)
    expect(await screen.findByText('No games yet')).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('lists stored games with the opponent and the outcome', async () => {
    await gamesRepo.save(ITALIAN)
    await gamesRepo.save(SICILIAN)
    render(<GamesLibraryScreen />)

    const table = await screen.findByRole('table', { name: 'Games' })
    await waitFor(() => {
      expect(within(table).getByText('Stockfish 1200')).toBeVisible()
    })
    expect(within(table).getByText('Rafi')).toBeVisible()
    expect(within(table).getAllByText('Won')).toHaveLength(1)
    expect(within(table).getAllByText('Lost')).toHaveLength(1)
    expect(screen.getByText('Showing 2 of 2')).toBeVisible()
  })

  it('filters down to the games you won', async () => {
    const user = userEvent.setup()
    await gamesRepo.save(ITALIAN)
    await gamesRepo.save(SICILIAN)
    render(<GamesLibraryScreen />)
    await screen.findByRole('table', { name: 'Games' })

    await user.click(screen.getByRole('radio', { name: 'Won' }))
    await waitFor(() => {
      expect(screen.getByText('Showing 1 of 2')).toBeVisible()
    })
    expect(screen.queryByText('Rafi')).toBeNull()
  })

  it('says so when a filter finds nothing', async () => {
    const user = userEvent.setup()
    await gamesRepo.save(ITALIAN)
    render(<GamesLibraryScreen />)
    await screen.findByRole('table', { name: 'Games' })

    await user.click(screen.getByRole('radio', { name: 'Drawn' }))
    expect(await screen.findByText('No games match these filters')).toBeVisible()
  })

  it('sorts by a column and announces which way', async () => {
    const user = userEvent.setup()
    await gamesRepo.save(ITALIAN)
    await gamesRepo.save(SICILIAN)
    render(<GamesLibraryScreen />)
    const table = await screen.findByRole('table', { name: 'Games' })

    const header = within(table).getByRole('columnheader', { name: /Opponent/ })
    expect(header).toHaveAttribute('aria-sort', 'none')
    await user.click(within(header).getByRole('button'))

    await waitFor(() => {
      expect(header).toHaveAttribute('aria-sort', 'ascending')
    })
    const names = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent)
    expect(names[0]).toContain('Rafi')

    await user.click(within(header).getByRole('button'))
    await waitFor(() => {
      expect(header).toHaveAttribute('aria-sort', 'descending')
    })
  })

  it('offers the openings actually in the library as chips', async () => {
    await gamesRepo.save(ITALIAN)
    render(<GamesLibraryScreen />)
    expect(await screen.findByRole('radio', { name: /Italian Game/ })).toBeVisible()
  })

  it('has no axe violations with games on screen', async () => {
    await gamesRepo.save(ITALIAN)
    const { container } = render(<GamesLibraryScreen />)
    await screen.findByRole('table', { name: 'Games' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  }, 30_000)
})
