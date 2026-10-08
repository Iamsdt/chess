import 'fake-indexeddb/auto'

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'

import { repertoireRepo, srsCardsRepo } from '@/data'

import { OpeningsScreen } from './openings-screen'
import { installDomShims, renderAt } from './screen-test-kit'
import { seedStarter } from './service'

import type { OpeningsDeps } from './service'

const deps: OpeningsDeps = { repertoire: repertoireRepo, srsCards: srsCardsRepo }
const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

beforeAll(() => {
  installDomShims()
})

beforeEach(async () => {
  await repertoireRepo.clear()
  await srsCardsRepo.clear()
})

function renderScreen() {
  return renderAt('/openings', () => <OpeningsScreen />)
}

async function ready() {
  await screen.findByRole('heading', { level: 1, name: 'Openings' })
}

describe('OpeningsScreen with an empty repertoire', () => {
  it('invites the user to start, and seeds nothing on its own', async () => {
    renderScreen()
    await ready()
    expect(await screen.findByText('No openings yet')).toBeInTheDocument()
    expect(screen.getByText('0 lines due')).toBeInTheDocument()
    expect(await repertoireRepo.count()).toBe(0)
    expect(await srsCardsRepo.countDue({ kind: 'opening' })).toBe(0)
  })

  it('seeds the starter repertoire only when asked, then lists it by colour', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(await screen.findByRole('button', { name: /Add a starter repertoire/i }))

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Italian Game' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { level: 3, name: 'London System' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Caro-Kann Defence' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /As White/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /As Black/i })).toBeInTheDocument()
    expect(screen.queryByText('No openings yet')).not.toBeInTheDocument()

    const lines = await srsCardsRepo.countDue({ kind: 'opening' })
    expect(lines).toBeGreaterThan(10)
    expect(await screen.findByText(`${String(lines)} lines due`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Drill due lines/i })).toHaveAttribute(
      'href',
      '/openings/drill',
    )
  })
})

describe('OpeningsScreen with a repertoire', () => {
  beforeEach(async () => {
    await seedStarter(deps)
  })

  it('shows real details and passes automated accessibility checks', async () => {
    const { container } = renderScreen()
    const caro = await screen.findByRole('heading', { level: 3, name: 'Caro-Kann Defence' })
    const card = caro.closest('article')
    expect(card).not.toBeNull()
    if (card === null) return
    expect(await within(card).findByText(/B10.*6 lines/)).toBeInTheDocument()
    expect(within(card).getByText('6 due')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /Drill/ })).toBeInTheDocument()
    expect(within(card).getByText('0 of 6 lines settled')).toBeInTheDocument()

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('opens the tree editor, adds a move by playing it on the board, and stores it', async () => {
    const user = userEvent.setup()
    const { container } = renderScreen()
    const caro = await screen.findByRole('heading', { level: 3, name: 'Caro-Kann Defence' })
    const card = caro.closest('article')
    if (card === null) throw new Error('no card')
    await user.click(within(card).getByRole('button', { name: /Edit tree/ }))

    expect(
      await screen.findByRole('heading', { name: 'Caro-Kann Defence tree' }),
    ).toBeInTheDocument()
    const before = await repertoireRepo.count('black')

    // The editor starts on the opening's head (after 1.e4 c6, White to move): play 2.g3.
    const board = container.querySelector('[aria-label^="Editor board"]')
    if (!(board instanceof HTMLElement)) throw new Error('no editor board')
    const square = (name: string) => {
      const element = board.querySelector(`[data-square="${name}"]`)
      if (!(element instanceof HTMLElement)) throw new Error(`no ${name}`)
      return element
    }
    await user.click(square('g2'))
    await user.click(square('g3'))

    await waitFor(async () => {
      expect(await repertoireRepo.count('black')).toBe(before + 1)
    })
    const stored = (await repertoireRepo.listByColor('black')).find((node) => node.san === 'g3')
    expect(stored?.isYourMove).toBe(false)
  })

  it('saves a note, marks a main line and deletes a branch', async () => {
    const user = userEvent.setup()
    renderScreen()
    const caro = await screen.findByRole('heading', { level: 3, name: 'Caro-Kann Defence' })
    const card = caro.closest('article')
    if (card === null) throw new Error('no card')
    await user.click(within(card).getByRole('button', { name: /Edit tree/ }))

    const tree = await screen.findByRole('list', { name: 'Repertoire tree' })
    await user.click(within(tree).getByRole('button', { name: '2.Nc3' }))
    const note = await screen.findByLabelText('Note for this move')
    await user.type(note, 'Two Knights: develop and hit d5')
    await user.tab()
    await waitFor(async () => {
      const node = (await repertoireRepo.listByColor('black')).find((row) => row.san === 'Nc3')
      expect(node?.comment).toBe('Two Knights: develop and hit d5')
    })

    await user.click(screen.getByRole('button', { name: 'Make main line' }))
    await waitFor(async () => {
      const rows = await repertoireRepo.listByColor('black')
      const c6 = rows.find((row) => row.san === 'c6')
      const first = c6?.childIds[0]
      expect(rows.find((row) => row.id === first)?.san).toBe('Nc3')
    })

    const before = await repertoireRepo.count('black')
    await user.click(screen.getByRole('button', { name: 'Delete branch' }))
    await waitFor(async () => {
      expect(await repertoireRepo.count('black')).toBeLessThan(before)
    })
    const remaining = await repertoireRepo.listByColor('black')
    const c6 = remaining.find((row) => row.san === 'c6')
    expect(c6?.childIds).toHaveLength(1)
    expect(remaining.filter((row) => row.san === 'Nc3' && row.parentId === c6?.id)).toHaveLength(0)
  })

  it('imports lines from pasted PGN, variations included', async () => {
    const user = userEvent.setup()
    renderScreen()
    const caro = await screen.findByRole('heading', { level: 3, name: 'Caro-Kann Defence' })
    const card = caro.closest('article')
    if (card === null) throw new Error('no card')
    await user.click(within(card).getByRole('button', { name: /Edit tree/ }))
    await user.click(await screen.findByRole('button', { name: 'Import PGN' }))

    const field = await screen.findByLabelText(/Paste PGN for your black repertoire/)
    await user.click(field)
    await user.paste('1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 (4... Nd7 5. Be2) 5. Be2 c5 6. O-O')
    await user.click(screen.getByRole('button', { name: 'Import lines' }))

    expect(await screen.findByText(/Added \d+ moves? from 1 game/)).toBeInTheDocument()
    const rows = await repertoireRepo.listByColor('black')
    expect(rows.some((row) => row.san === 'Nd7')).toBe(true)
  })

  it('reports coverage and offers to add an unprepared reply', async () => {
    renderScreen()
    const caro = await screen.findByRole('heading', { level: 3, name: 'Caro-Kann Defence' })
    const card = caro.closest('article')
    if (card === null) throw new Error('no card')
    const user = userEvent.setup()
    await user.click(within(card).getByRole('button', { name: /Edit tree/ }))

    const meter = await screen.findByRole(
      'progressbar',
      { name: 'Repertoire coverage' },
      { timeout: 20_000 },
    )
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(100)
    expect(
      screen.getByRole('heading', { name: 'What if they play something else?' }),
    ).toBeInTheDocument()
  }, 30_000)
})

describe('Explore', () => {
  it('searches the ECO-sourced catalogue, filters it, and adds an opening', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(await screen.findByRole('tab', { name: 'Explore' }))

    const search = screen.getByRole('textbox', { name: 'Search openings' })
    await user.type(search, 'B90')
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Sicilian Najdorf' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { level: 3, name: 'French Defence' }),
    ).not.toBeInTheDocument()

    await user.clear(search)
    await user.click(screen.getByRole('button', { name: /^white$/i }))
    expect(
      screen.queryByRole('heading', { level: 3, name: 'French Defence' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Ruy Lopez' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^all$/i }))
    await user.click(screen.getByRole('button', { name: 'Sharp' }))
    expect(
      screen.queryByRole('heading', { level: 3, name: 'French Defence' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Any style' }))
    await user.clear(search)
    await user.type(search, 'french')
    const french = (
      await screen.findByRole('heading', { level: 3, name: 'French Defence' })
    ).closest('article')
    if (french === null) throw new Error('no card')
    await user.click(within(french).getByRole('button', { name: 'Add to repertoire' }))
    await waitFor(() => {
      expect(within(french).getByRole('button', { name: 'In your repertoire' })).toBeDisabled()
    })
    const rows = await repertoireRepo.listByColor('black')
    expect(rows.some((row) => row.openingName === 'French Defence')).toBe(true)
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(await screen.findByRole('tab', { name: 'Explore' }))
    await user.type(screen.getByRole('textbox', { name: 'Search openings' }), 'zzzz')
    expect(screen.getByText('No openings match your search criteria.')).toBeInTheDocument()
  })
})
