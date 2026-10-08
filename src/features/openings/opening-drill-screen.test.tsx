import 'fake-indexeddb/auto'

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'

import { repertoireRepo, srsCardsRepo } from '@/data'
import { toTimestamp, type RepertoireNode, type SrsCardId } from '@/domain'

import { createFakeScheduler } from './fake-scheduler'
import { OpeningDrillScreen } from './opening-drill-screen'
import { installDomShims, renderAt } from './screen-test-kit'
import { seedStarter, type OpeningsDeps } from './service'
import { buildTree, findBySanPath, pathTo } from './tree'

import type { Scheduler } from './scheduler'

const deps: OpeningsDeps = { repertoire: repertoireRepo, srsCards: srsCardsRepo }
const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

beforeAll(() => {
  installDomShims()
})

beforeEach(async () => {
  await repertoireRepo.clear()
  await srsCardsRepo.clear()
})

const OPEN_LINE = ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'c5']

/** A scheduler that asks for one chosen line first, so the test knows what it will see. */
function schedulerAskingFor(cardId: SrsCardId): Scheduler {
  const base = createFakeScheduler()
  return {
    reviewCard: base.reviewCard,
    buildDueQueue: (cards, now, caps) =>
      base
        .buildDueQueue(cards, now, caps)
        .sort((a, b) => Number(b.id === cardId) - Number(a.id === cardId)),
  }
}

function cardOf(node: RepertoireNode): SrsCardId {
  if (node.srsCardId === undefined) throw new Error('line has no card')
  return node.srsCardId
}

async function caroLine(): Promise<{
  readonly leaf: RepertoireNode
  readonly mine: RepertoireNode[]
}> {
  const tree = buildTree('black', await repertoireRepo.listByColor('black'))
  if (tree === null) throw new Error('no black tree')
  const leaf = findBySanPath(tree, OPEN_LINE)
  if (leaf === undefined) throw new Error('no line')
  const head = findBySanPath(tree, ['e4', 'c6'])
  const mine = pathTo(tree, leaf.id).filter(
    (node) => node.isYourMove && node.ply > (head?.ply ?? 0),
  )
  return { leaf, mine }
}

function renderDrill(scheduler: Scheduler) {
  return renderAt('/openings/drill', () => (
    <OpeningDrillScreen deps={deps} scheduler={scheduler} random={() => 0} />
  ))
}

function squareOf(container: HTMLElement, name: string): HTMLElement {
  const board = container.querySelector('[aria-label^="Drill board,"]')
  const element = board?.querySelector(`[data-square="${name}"]`)
  if (!(element instanceof HTMLElement)) throw new Error(`no square ${name}`)
  return element
}

describe('OpeningDrillScreen without lines', () => {
  it('points to the repertoire instead of drilling nothing', async () => {
    renderDrill(createFakeScheduler())
    expect(await screen.findByText('No lines to drill yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to my repertoire' })).toHaveAttribute(
      'href',
      '/openings',
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Opening drill' })).toBeInTheDocument()
  })
})

describe('OpeningDrillScreen with a seeded repertoire', () => {
  beforeEach(async () => {
    await seedStarter(deps, ['caro-kann'])
  })

  it('shows the real line, the opponent opening move and the mastery list, and is accessible', async () => {
    const { leaf } = await caroLine()
    const { container } = renderDrill(schedulerAskingFor(cardOf(leaf)))
    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 1, name: 'Opening drill' })
      expect(heading).toHaveTextContent(/Caro-Kann Defence · Advance Variation.* · line 1 of 6/)
    })
    expect(screen.getByText('Spaced review')).toBeInTheDocument()
    expect(screen.getByText('6 due today')).toBeInTheDocument()
    expect(screen.getByText('Your move · play it from memory')).toBeInTheDocument()
    expect(screen.getAllByRole('progressbar', { name: /Line \d mastery/ })).toHaveLength(6)
    expect(screen.getByRole('link', { name: /Repertoire/ })).toHaveAttribute('href', '/openings')

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it("plays a whole line, grades it and stores the scheduler's card", async () => {
    const user = userEvent.setup()
    const { leaf, mine } = await caroLine()
    const { container } = renderDrill(schedulerAskingFor(cardOf(leaf)))
    await screen.findByText('Your move · play it from memory')

    for (const node of mine) {
      const uci = node.uci ?? ''
      await user.click(squareOf(container, uci.slice(0, 2)))
      await user.click(squareOf(container, uci.slice(2, 4)))
    }

    expect((await screen.findAllByText('Line finished')).length).toBeGreaterThan(0)
    await waitFor(async () => {
      const stored = await srsCardsRepo.get(cardOf(leaf))
      expect(stored?.reps).toBe(1)
      expect(stored?.state).toBe('review')
    })
    expect(screen.getByRole('button', { name: 'Next line' })).toBeInTheDocument()
  })

  it('treats a move outside the tree as a miss, explains it, and can keep it as a branch', async () => {
    const user = userEvent.setup()
    const { leaf } = await caroLine()
    const { container } = renderDrill(schedulerAskingFor(cardOf(leaf)))
    await screen.findByText('Your move · play it from memory')

    await user.click(squareOf(container, 'g8'))
    await user.click(squareOf(container, 'f6'))

    expect(await screen.findByText('Nf6 is not in your repertoire')).toBeInTheDocument()
    expect(screen.getByText(/Your prepared move here is d5/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try the move again' })).toBeInTheDocument()

    const keep = screen.getByRole('button', { name: 'Keep Nf6 too' })
    expect(keep).toBeEnabled()
    const before = await repertoireRepo.count('black')
    await user.click(keep)
    await waitFor(async () => {
      expect(await repertoireRepo.count('black')).toBe(before + 1)
    })
    const rows = await repertoireRepo.listByColor('black')
    expect(rows.some((row) => row.san === 'Nf6' && row.isYourMove)).toBe(true)
  })

  it('reveals the answer and schedules the line as a lapse', async () => {
    const user = userEvent.setup()
    const { leaf } = await caroLine()
    renderDrill(schedulerAskingFor(cardOf(leaf)))
    await screen.findByText('Your move · play it from memory')
    await user.click(screen.getByRole('button', { name: 'Show answer' }))
    expect(await screen.findByText('The line was')).toBeInTheDocument()
    await waitFor(async () => {
      const stored = await srsCardsRepo.get(cardOf(leaf))
      expect(stored?.lapses).toBe(1)
    })
  })

  it('offers to practise ahead of schedule when nothing is due', async () => {
    const user = userEvent.setup()
    const rows = await repertoireRepo.listByColor('black')
    for (const row of rows) {
      if (row.srsCardId === undefined) continue
      await srsCardsRepo.update(row.srsCardId, {
        state: 'review',
        due: toTimestamp(Date.now() + 5 * 86_400_000),
        stability: 12,
        reps: 2,
      })
    }
    renderDrill(createFakeScheduler())
    expect(await screen.findByText('Nothing is due right now')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Practise anyway' }))
    expect(await screen.findByText('Your move · play it from memory')).toBeInTheDocument()
    const lines = screen.getAllByRole('progressbar', { name: /Line \d mastery/ })
    expect(
      within(lines[0]?.closest('button') ?? document.body).getByText(/in \d+ days/),
    ).toBeInTheDocument()
  })
})
