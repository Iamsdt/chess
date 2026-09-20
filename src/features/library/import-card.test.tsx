import 'fake-indexeddb/auto'

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { gamesRepo } from '@/data'

import { ImportCard } from './import-card'
import { parsePgnStream, serializeGames, textPgnSource } from './pgn-import'

import type { PgnPort } from './pgn-port'
import type { FetchLike } from './providers'

/**
 * The import panel, driven the way a person drives it, against a stubbed provider.
 *
 * The worker is stood in for by the code the worker runs, and `fetch` by a function that
 * answers from memory — so this covers the whole path from a keystroke to a row in
 * IndexedDB without a network or a `Worker`, neither of which exists in jsdom.
 */

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
})

const port: PgnPort = {
  parse: (source, options, onBatch, signal) =>
    source.kind === 'text'
      ? parsePgnStream(textPgnSource(source.text), options, onBatch, signal)
      : Promise.reject(new Error('this test only pastes text')),
  serialize: (games) => Promise.resolve(serializeGames(games)),
  close: () => undefined,
}

const PGN =
  '[Event "One"]\n[Site "https://lichess.org/aaaa1111"]\n[Date "2024.03.09"]\n[White "bishop_bard"]\n[Black "rival"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0\n'

beforeEach(async () => {
  await gamesRepo.clear()
})

describe('<ImportCard>', () => {
  it('imports a pasted PGN and tells the table to reload', async () => {
    const user = userEvent.setup()
    const onImported = vi.fn()
    render(<ImportCard getPort={() => port} onImported={onImported} />)

    await user.type(screen.getByLabelText('PGN'), PGN.replaceAll('[', '{[}'))
    await user.click(screen.getByRole('button', { name: /^Import$/ }))

    expect(await screen.findByText(/1 imported/)).toBeVisible()
    expect(onImported).toHaveBeenCalled()
    expect(await gamesRepo.count()).toBe(1)
  })

  it('refuses to import an empty box', async () => {
    const user = userEvent.setup()
    render(<ImportCard getPort={() => port} onImported={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Import$/ }))
    expect(await screen.findByText('Paste a PGN first.')).toBeVisible()
  })

  it('fetches a Lichess account and reports what it stored', async () => {
    const user = userEvent.setup()
    const fetchImpl = vi.fn<FetchLike>(() => Promise.resolve(new Response(PGN, { status: 200 })))
    render(<ImportCard getPort={() => port} onImported={vi.fn()} fetchImpl={fetchImpl} />)

    await user.click(screen.getByRole('tab', { name: 'Lichess' }))
    await user.type(screen.getByLabelText('Lichess username'), 'bishop_bard')
    await user.click(screen.getByRole('button', { name: 'Fetch' }))

    expect(await screen.findByText(/1 imported/)).toBeVisible()
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('lichess.org/api/games/user/bishop_bard')
    expect(await gamesRepo.count()).toBe(1)
  })

  it('imports nothing twice', async () => {
    const user = userEvent.setup()
    const fetchImpl = vi.fn<FetchLike>(() => Promise.resolve(new Response(PGN, { status: 200 })))
    render(<ImportCard getPort={() => port} onImported={vi.fn()} fetchImpl={fetchImpl} />)

    await user.click(screen.getByRole('tab', { name: 'Lichess' }))
    await user.type(screen.getByLabelText('Lichess username'), 'bishop_bard')
    await user.click(screen.getByRole('button', { name: 'Fetch' }))
    await screen.findByText(/1 imported/)

    await user.click(screen.getByRole('button', { name: 'Fetch' }))
    expect(await screen.findByText(/0 imported · 1 already here/)).toBeVisible()
    expect(await gamesRepo.count()).toBe(1)
  })

  it('says plainly when the account does not exist', async () => {
    const user = userEvent.setup()
    const fetchImpl = vi.fn<FetchLike>(() => Promise.resolve(new Response('', { status: 404 })))
    render(<ImportCard getPort={() => port} onImported={vi.fn()} fetchImpl={fetchImpl} />)

    await user.click(screen.getByRole('tab', { name: 'Chess.com' }))
    await user.type(screen.getByLabelText('Chess.com username'), 'nobody')
    await user.click(screen.getByRole('button', { name: 'Fetch' }))

    expect(await screen.findByText('No account with that username')).toBeVisible()
  })

  it('lists the games it could not read', async () => {
    const user = userEvent.setup()
    const broken = '[Event "B"]\n[White "x"]\n[Black "y"]\n[Result "1-0"]\n\n1. e4 e9 1-0\n'
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(new Response(`${PGN}\n${broken}`, { status: 200 })),
    )
    render(<ImportCard getPort={() => port} onImported={vi.fn()} fetchImpl={fetchImpl} />)

    await user.click(screen.getByRole('tab', { name: 'Lichess' }))
    await user.type(screen.getByLabelText('Lichess username'), 'bishop_bard')
    await user.click(screen.getByRole('button', { name: 'Fetch' }))

    await waitFor(() => {
      expect(screen.getByText('1 game(s) could not be read')).toBeVisible()
    })
    // The list itself sits inside a collapsed `<details>`, so presence is the assertion.
    expect(screen.getByText('x vs y')).toBeInTheDocument()
  })
})
