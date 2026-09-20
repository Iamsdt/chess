import 'fake-indexeddb/auto'

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { kvRepo } from '@/data'
import { toSquare } from '@/domain'

import { ANALYSIS_BOARD_KEY } from './analysis-state'
import { useAnalysisBoard } from './use-analysis-board'
import { mainLineIds, type VariationTree } from './variation-tree'

/** The debounce in `useAnalysisBoard`, with room for IndexedDB to answer. */
const SAVE_TIMEOUT_MS = 2000

function sans(tree: VariationTree): string[] {
  return mainLineIds(tree).map((id) => tree.nodes[id]?.san ?? '?')
}

async function mounted() {
  const rendered = renderHook(() => useAnalysisBoard())
  await waitFor(() => {
    expect(rendered.result.current.ready).toBe(true)
  })
  return rendered
}

beforeEach(async () => {
  await kvRepo.remove(ANALYSIS_BOARD_KEY)
})

describe('useAnalysisBoard', () => {
  it('starts empty at the initial position', async () => {
    const { result } = await mounted()
    expect(result.current.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(sans(result.current.tree)).toEqual([])
    expect(result.current.legalMoveMap.get(toSquare('e2'))).toEqual([
      toSquare('e3'),
      toSquare('e4'),
    ])
  })

  it('keeps the variation tree across a reload', async () => {
    const first = await mounted()
    act(() => {
      first.result.current.play('e4')
    })
    act(() => {
      first.result.current.play('e5')
    })
    expect(sans(first.result.current.tree)).toEqual(['e4', 'e5'])

    await waitFor(
      async () => {
        const saved = await kvRepo.get(ANALYSIS_BOARD_KEY)
        expect(saved?.tree.rootChildren).toHaveLength(1)
      },
      { timeout: SAVE_TIMEOUT_MS },
    )
    first.unmount()

    const second = await mounted()
    expect(sans(second.result.current.tree)).toEqual(['e4', 'e5'])
    expect(second.result.current.tree.currentId).toBe(first.result.current.tree.currentId)
  })

  it('remembers the dials too', async () => {
    const first = await mounted()
    act(() => {
      first.result.current.updateSettings({ orientation: 'black', multiPv: 1 })
    })
    await waitFor(
      async () => {
        const saved = await kvRepo.get(ANALYSIS_BOARD_KEY)
        expect(saved?.settings.orientation).toBe('black')
      },
      { timeout: SAVE_TIMEOUT_MS },
    )
    first.unmount()

    const second = await mounted()
    expect(second.result.current.settings).toMatchObject({ orientation: 'black', multiPv: 1 })
  })

  it('walks the line with the navigation actions', async () => {
    const { result } = await mounted()
    act(() => {
      result.current.play('e4')
    })
    act(() => {
      result.current.play('e5')
    })

    act(() => {
      result.current.toStart()
    })
    expect(result.current.tree.currentId).toBeNull()

    act(() => {
      result.current.forward()
    })
    expect(result.current.fen).toContain('/4P3/')

    act(() => {
      result.current.toEnd()
    })
    expect(result.current.fen).toContain('4p3/')

    act(() => {
      result.current.back()
    })
    expect(result.current.fen).toContain('/4P3/')
  })

  it('reports a promotion so the board can ask which piece', async () => {
    const { result } = await mounted()
    act(() => {
      result.current.loadFen('4k3/4P3/8/8/8/8/8/4K3 w - - 0 1')
    })
    expect(result.current.isPromotion(toSquare('e7'), toSquare('e8'))).toBe(false)

    act(() => {
      result.current.loadFen('5k2/4P3/8/8/8/8/8/4K3 w - - 0 1')
    })
    expect(result.current.isPromotion(toSquare('e7'), toSquare('e8'))).toBe(true)
  })

  it('flags the king that is in check', async () => {
    const { result } = await mounted()
    act(() => {
      result.current.loadFen('4k3/8/8/8/8/8/8/R3K3 w - - 0 1')
    })
    expect(result.current.checkSquare).toBeNull()

    act(() => {
      result.current.play('Ra8')
    })
    expect(result.current.checkSquare).toBe('e8')
  })

  it('refuses a FEN that is not a position and says so', async () => {
    const { result } = await mounted()
    act(() => {
      expect(result.current.loadFen('this is not a fen').ok).toBe(false)
    })
    expect(result.current.problem).not.toBeNull()
  })

  it('loads a PGN with its variations', async () => {
    const { result } = await mounted()
    act(() => {
      expect(result.current.loadPgn('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *').ok).toBe(true)
    })
    expect(sans(result.current.tree)).toEqual(['e4', 'e5', 'Nf3'])
    expect(Object.keys(result.current.tree.nodes)).toHaveLength(5)
  })

  it('promotes and deletes through the tree operations', async () => {
    const { result } = await mounted()
    act(() => {
      result.current.loadPgn('1. e4 e5 (1... c5) *')
    })
    const branch = Object.values(result.current.tree.nodes).find((node) => node.san === 'c5')
    if (branch === undefined) throw new Error('no branch')

    act(() => {
      result.current.promoteToMain(branch.id)
    })
    expect(sans(result.current.tree)).toEqual(['e4', 'c5'])

    act(() => {
      result.current.remove(branch.id)
    })
    expect(sans(result.current.tree)).toEqual(['e4', 'e5'])
  })
})
