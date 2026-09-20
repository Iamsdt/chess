import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { START_FEN, toFen, toUci, type Fen } from '@/domain'

import { ExplorerPanel } from './explorer-panel'
import { TreePanel } from './tree-panel'
import { treeFromPgn } from './tree-pgn'
import { lineStartOf, type VariationTree } from './variation-tree'

function treeOf(pgn: string): VariationTree {
  const tree = treeFromPgn(pgn)
  if (!tree.ok) throw new Error(tree.error.message)
  return tree.value
}

function renderTree(tree: VariationTree) {
  const handlers = {
    onSelect: vi.fn(),
    onPromote: vi.fn(),
    onPromoteToMain: vi.fn(),
    onDelete: vi.fn(),
  }
  render(<TreePanel tree={tree} lineStart={lineStartOf(tree)} {...handlers} />)
  return { ...handlers, user: userEvent.setup() }
}

describe('<TreePanel>', () => {
  it('invites a first move when the tree is empty', () => {
    renderTree(treeOf('*'))
    expect(screen.getByText(/No moves yet/)).toBeVisible()
  })

  it('numbers the moves from the position the tree is rooted at', () => {
    const tree = treeOf(
      '[SetUp "1"]\n[FEN "6k1/5ppp/8/8/8/8/5PPP/R3K2R w KQ - 0 20"]\n\n20. O-O Kh8 *',
    )
    renderTree(tree)
    expect(screen.getByRole('button', { name: '20. O-O' })).toBeVisible()
    expect(screen.getByRole('button', { name: '20… Kh8' })).toBeVisible()
  })

  it('draws a side line beside the move it replaces', () => {
    renderTree(treeOf('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *'))
    expect(screen.getByRole('button', { name: '1… e5' })).toBeVisible()
    expect(screen.getByRole('button', { name: '1… c5' })).toBeVisible()
    // The main line and the side line both reach Nf3, and both restate the number
    // because a branch has interrupted the flow.
    expect(screen.getAllByRole('button', { name: '2. Nf3' })).toHaveLength(2)
  })

  it('selects the move that was clicked', async () => {
    const tree = treeOf('1. e4 e5 *')
    const second = Object.values(tree.nodes).find((node) => node.san === 'e5')
    const { user, onSelect } = renderTree(tree)
    await user.click(screen.getByRole('button', { name: '1… e5' }))
    expect(onSelect).toHaveBeenCalledWith(second?.id)
  })

  it('offers promote only for a move that is not already on the main line', () => {
    const tree = treeOf('1. e4 e5 (1... c5) *')
    renderTree({ ...tree, currentId: tree.rootChildren[0] ?? null })
    expect(screen.getByRole('button', { name: 'Promote' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Make main line' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })

  it('promotes and deletes the move the cursor is on', async () => {
    const tree = treeOf('1. e4 e5 (1... c5) *')
    const branch = Object.values(tree.nodes).find((node) => node.san === 'c5')
    if (branch === undefined) throw new Error('no branch')

    const { user, onPromote, onPromoteToMain, onDelete } = renderTree({
      ...tree,
      currentId: branch.id,
    })
    await user.click(screen.getByRole('button', { name: 'Promote' }))
    await user.click(screen.getByRole('button', { name: 'Make main line' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onPromote).toHaveBeenCalledWith(branch.id)
    expect(onPromoteToMain).toHaveBeenCalledWith(branch.id)
    expect(onDelete).toHaveBeenCalledWith(branch.id)
  })
})

function renderExplorer(options: {
  enabled: boolean
  fetchImpl?: typeof globalThis.fetch
  isOnline?: () => boolean
  fen?: Fen
}) {
  const onPlayMove = vi.fn()
  render(
    <ExplorerPanel
      fen={options.fen ?? START_FEN}
      enabled={options.enabled}
      onToggle={vi.fn()}
      onPlayMove={onPlayMove}
      {...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl })}
      {...(options.isOnline === undefined ? {} : { isOnline: options.isOnline })}
    />,
  )
  return { onPlayMove, user: userEvent.setup() }
}

const MASTERS = {
  white: 100,
  draws: 100,
  black: 100,
  moves: [{ uci: 'e2e4', san: 'e4', white: 36, draws: 39, black: 25 }],
  opening: null,
}

describe('<ExplorerPanel>', () => {
  it('says where the numbers come from, switched on or off', () => {
    renderExplorer({ enabled: false })
    expect(screen.getByText(/Lichess masters database/)).toBeVisible()
    expect(screen.getByText(/sends the position on the board/)).toBeVisible()
  })

  it('asks for nothing while it is switched off', () => {
    const fetchImpl = vi.fn() as unknown as typeof globalThis.fetch
    renderExplorer({ enabled: false, fetchImpl })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('says it is offline rather than breaking the panel', async () => {
    const fetchImpl = vi.fn() as unknown as typeof globalThis.fetch
    renderExplorer({ enabled: true, fetchImpl, isOnline: () => false })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/offline/)
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('shows the moves once the lookup answers', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.resolve(new Response(JSON.stringify(MASTERS), { status: 200 })),
    ) as unknown as typeof globalThis.fetch
    const { user, onPlayMove } = renderExplorer({ enabled: true, fetchImpl, isOnline: () => true })

    const move = await screen.findByRole('button', { name: 'e4' })
    await user.click(move)
    expect(onPlayMove).toHaveBeenCalledWith(toUci('e2e4'))
  })

  it('reports an unreachable explorer as offline, not as an error page', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.reject(new TypeError('Failed to fetch')),
    ) as unknown as typeof globalThis.fetch
    renderExplorer({
      enabled: true,
      fetchImpl,
      isOnline: () => true,
      fen: toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'),
    })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Analysis works offline/)
    })
  })
})
