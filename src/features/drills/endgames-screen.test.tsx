import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { kvRepo } from '@/data'
import { ThemeProvider } from '@/design'
import { type Result } from '@/domain'

import { drillStatsText } from './drill-copy'
import { ENDGAME_DRILLS } from './endgame-drills'
import { EndgamesScreen } from './endgames-screen'
import { DrillPortsContext, type DrillPorts } from './ports'
import {
  brokenRecords,
  installBoardShims,
  realRecords,
  scriptedEngine,
  silentEngine,
  testPorts,
} from './test-support'

import type { DrillRecordsPort, EndgameRecords } from './drill-records'

beforeAll(() => {
  installBoardShims()
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

beforeEach(async () => {
  await kvRepo.clear()
})

const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

function renderEndgames(ports: DrillPorts = testPorts()) {
  const rootRoute = createRootRoute()
  const endgamesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/drills/endgames',
    component: EndgamesScreen,
  })
  const learnRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/learn',
    component: () => <div>Learn Screen</div>,
  })
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: () => <div>Settings Screen</div>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([endgamesRoute, learnRoute, settingsRoute]),
    history: createMemoryHistory({ initialEntries: ['/drills/endgames'] }),
  })
  return render(
    <ThemeProvider>
      <DrillPortsContext value={ports}>
        <RouterProvider router={router} />
      </DrillPortsContext>
    </ThemeProvider>,
  )
}

function cell(container: HTMLElement, name: string): HTMLElement {
  const element = container.querySelector(`[data-square="${name}"]`)
  if (!(element instanceof HTMLElement)) throw new Error(`No square ${name} rendered`)
  return element
}

async function ready() {
  return screen.findByRole('heading', { level: 1, name: 'Endgame drills' })
}

async function pickDrill(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(await screen.findByRole('button', { name }))
}

describe('EndgamesScreen states', () => {
  it('shows a loading state until the records arrive', async () => {
    const pending: DrillRecordsPort = {
      ...realRecords(),
      readEndgames: () => new Promise<Result<EndgameRecords>>(() => undefined),
    }
    renderEndgames(testPorts({ records: pending }))
    expect(await screen.findByRole('status', { name: 'Loading your drills' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Endgame drills list' })).toBeNull()
  })

  it('shows an error with a retry, and recovers when storage comes back', async () => {
    const user = userEvent.setup()
    let failing = true
    const flaky: DrillRecordsPort = {
      ...realRecords(),
      readEndgames: () => (failing ? brokenRecords().readEndgames() : realRecords().readEndgames()),
    }
    renderEndgames(testPorts({ records: flaky }))

    expect(await screen.findByText('Your drills could not be opened')).toBeInTheDocument()
    expect(screen.getByText('The database is closed')).toBeInTheDocument()

    failing = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('navigation', { name: 'Endgame drills list' }),
    ).toBeInTheDocument()
  })

  it('invites a first attempt when nothing has been played', async () => {
    renderEndgames()
    await ready()
    await screen.findByRole('navigation', { name: 'Endgame drills list' })

    expect(screen.getByText('0 of 7 mastered')).toBeInTheDocument()
    expect(screen.getByText('No attempts yet')).toBeInTheDocument()
    expect(screen.getAllByText('New')).toHaveLength(ENDGAME_DRILLS.length)
    expect(screen.getByText('Not tried · par 14')).toBeInTheDocument()
    // The prototype's invented numbers are gone.
    expect(screen.queryByText(/Best 19/)).toBeNull()
    expect(screen.queryByText(/On pace for/)).toBeNull()
    expect(screen.queryByText('12 in a row')).toBeNull()
  })

  it('shows persisted bests and stars in the list', async () => {
    const ports = testPorts()
    await ports.records.recordEndgame('kr-vs-k', {
      kind: 'success',
      how: 'checkmate',
      moves: 13,
      stars: 3,
      overPar: false,
    })
    await ports.records.recordEndgame('kq-vs-k', { kind: 'failed', reason: 'stalemate', moves: 4 })
    renderEndgames(ports)
    await ready()

    expect(await screen.findByText('Best 13 · par 14')).toBeInTheDocument()
    expect(screen.getByText('Not won yet · 1 try')).toBeInTheDocument()
    expect(screen.getByText('1 of 7 mastered')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '3 of 3 stars' })).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderEndgames()
    await ready()
    await screen.findByRole('navigation', { name: 'Endgame drills list' })
    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})

describe('EndgamesScreen drills', () => {
  it('lists the drills by category and switches the technique card', async () => {
    const user = userEvent.setup()
    renderEndgames()
    await ready()

    expect(await screen.findByText('Basic mates')).toBeInTheDocument()
    expect(screen.getByText('Pawn endgames')).toBeInTheDocument()
    expect(screen.getByText('Rook endgames')).toBeInTheDocument()
    for (const title of [
      'K+Q vs K',
      'K+R vs K',
      'Two bishops',
      'Opposition',
      'Lucena',
      'Philidor',
    ]) {
      expect(
        screen.getByRole('button', { name: new RegExp(title.replace('+', '\\+'), 'i') }),
      ).toBeInTheDocument()
    }

    expect(screen.getByText('Technique: the box')).toBeInTheDocument()
    await pickDrill(user, /Opposition/i)
    expect(screen.getByText('The direct opposition')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Promote your pawn using direct king opposition/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Attempt 1')).toBeInTheDocument()
  })

  it('makes the engine open a drill where it moves first', async () => {
    const user = userEvent.setup()
    const engine = scriptedEngine(['e5f5'])
    renderEndgames(testPorts({ engine }))
    await ready()
    await pickDrill(user, /Opposition/i)

    expect(await screen.findByText('1...Kf5')).toBeInTheDocument()
    expect(engine.asked).toHaveLength(1)
  })

  it('plays the player’s move, then the engine’s reply', async () => {
    const user = userEvent.setup()
    const engine = scriptedEngine(['d6d7'])
    const { container } = renderEndgames(testPorts({ engine }))
    await ready()
    await pickDrill(user, /K\+Q vs K/i)

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e4'))

    expect(await screen.findByText('1.Qe4 Kd7')).toBeInTheDocument()
    expect(screen.getByText('1 of 10', { exact: false })).toBeInTheDocument()
    expect(engine.asked).toEqual(['8/8/3k4/8/4Q3/8/5K2/8 b - - 1 1'])
  })

  it('shows the engine thinking while it works', async () => {
    const user = userEvent.setup()
    const { container } = renderEndgames(testPorts({ engine: silentEngine }))
    await ready()
    await pickDrill(user, /K\+Q vs K/i)

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e4'))
    expect((await screen.findAllByText('Stockfish is thinking')).length).toBeGreaterThan(0)
  })

  it('reports an engine that stops answering and lets the player ask again', async () => {
    const user = userEvent.setup()
    const { container } = renderEndgames(testPorts({ engine: scriptedEngine([]) }))
    await ready()
    await pickDrill(user, /K\+Q vs K/i)

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e4'))
    expect((await screen.findAllByText('The engine stopped answering')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Ask the engine again' })).toBeInTheDocument()
  })

  it('takes back a move together with the reply, and restarts', async () => {
    const user = userEvent.setup()
    const { container } = renderEndgames(testPorts({ engine: scriptedEngine(['d6d7']) }))
    await ready()
    await pickDrill(user, /K\+Q vs K/i)
    expect(screen.getByRole('button', { name: /Take back/i })).toBeDisabled()

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e4'))
    await screen.findByText('1.Qe4 Kd7')

    await user.click(screen.getByRole('button', { name: /Take back/i }))
    expect(await screen.findByText('No moves yet')).toBeInTheDocument()

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e3'))
    await waitFor(() => {
      expect(screen.queryByText('No moves yet')).toBeNull()
    })
    await user.click(screen.getByRole('button', { name: /Restart drill/i }))
    expect(await screen.findByText('No moves yet')).toBeInTheDocument()
  })

  it('asks the engine for a hint and points at the piece', async () => {
    const user = userEvent.setup()
    const engine = scriptedEngine(['e2e4'])
    const { container } = renderEndgames(testPorts({ engine }))
    await ready()
    await pickDrill(user, /K\+Q vs K/i)

    await user.click(screen.getByRole('button', { name: /Hint/i }))
    await waitFor(() => {
      expect(cell(container, 'e2')).toHaveClass('fo')
    })
    expect(engine.asked).toHaveLength(1)
  })

  it('flips the board', async () => {
    const user = userEvent.setup()
    const { container } = renderEndgames()
    await ready()
    await screen.findByRole('navigation', { name: 'Endgame drills list' })
    expect(container.querySelectorAll('[data-square]')[0]).toHaveAttribute('data-square', 'a8')
    await user.click(screen.getByRole('button', { name: 'Flip board' }))
    expect(container.querySelectorAll('[data-square]')[0]).toHaveAttribute('data-square', 'h1')
  })

  it('finishes a drill, awards stars and saves the record', async () => {
    const user = userEvent.setup()
    const ports = testPorts({ engine: scriptedEngine(['h3g4', 'g4f5', 'f5e6', 'e6e5']) })
    const { container } = renderEndgames(ports)
    await ready()
    await pickDrill(user, /Rule of the square/i)

    for (const [from, to, reply] of [
      ['d4', 'd5', /Kg4/],
      ['d5', 'd6', /Kf5/],
      ['d6', 'd7', /Ke6/],
    ] as const) {
      await user.click(cell(container, from))
      await user.click(cell(container, to))
      await screen.findByText(reply)
    }
    await user.click(cell(container, 'd7'))
    await user.click(cell(container, 'd8'))
    await user.click(screen.getByRole('button', { name: 'queen' }))

    const aside = screen.getByRole('complementary', { name: 'Drill details' })
    expect(await within(aside).findByText('Drill complete · 3 of 3 stars')).toBeInTheDocument()
    expect(within(aside).getByText(/Promoted and held the queen in 4 moves/)).toBeInTheDocument()

    // Saved: the list now shows the real best and the header counts a mastered drill.
    expect(await screen.findByText('Best 4 · par 4')).toBeInTheDocument()
    expect(screen.getByText('1 of 7 mastered')).toBeInTheDocument()
    const saved = await ports.records.readEndgames()
    expect(saved.ok && saved.value['rule-square']).toMatchObject({ attempts: 1, wins: 1, stars: 3 })
  })

  it('fails a drill when the queen is given away', async () => {
    const user = userEvent.setup()
    const { container } = renderEndgames(testPorts({ engine: scriptedEngine(['d6e5']) }))
    await ready()
    await pickDrill(user, /K\+Q vs K/i)

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e5'))

    const aside = screen.getByRole('complementary', { name: 'Drill details' })
    expect(await within(aside).findByText('Drill failed')).toBeInTheDocument()
    expect(within(aside).getByText(/Not enough material left to mate/)).toBeInTheDocument()
    expect(await screen.findByText('Not won yet · 1 try')).toBeInTheDocument()
  })
})

describe('drill list wording', () => {
  const kr = ENDGAME_DRILLS.find((drill) => drill.id === 'kr-vs-k')
  const philidor = ENDGAME_DRILLS.find((drill) => drill.id === 'philidor')
  const fresh = { attempts: 0, wins: 0, bestMoves: null, stars: 0, lastPlayedAt: null }

  it('describes only what has happened', () => {
    if (kr === undefined || philidor === undefined) throw new Error('drills missing')
    expect(drillStatsText(kr, fresh)).toBe('Not tried · par 14')
    expect(drillStatsText(kr, { ...fresh, attempts: 3 })).toBe('Not won yet · 3 tries')
    expect(drillStatsText(kr, { ...fresh, attempts: 3, wins: 1, bestMoves: 12 })).toBe(
      'Best 12 · par 14',
    )
    expect(drillStatsText(philidor, { ...fresh, attempts: 5, wins: 4 })).toBe('Held 4 of 5')
  })
})
