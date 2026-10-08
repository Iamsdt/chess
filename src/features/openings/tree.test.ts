import { describe, expect, it } from 'vitest'

import { START_FEN, type RepertoireNodeId } from '@/domain'

import { emptyTree, testContext } from './test-helpers'
import {
  addBranches,
  addLine,
  addMove,
  annotate,
  buildTree,
  childrenOf,
  combineChanges,
  deleteSubtree,
  findBySanPath,
  findTranspositions,
  formatLine,
  headOf,
  lineEnds,
  lineTo,
  pathTo,
  setMainLine,
  subtreeOf,
  transpositionsOf,
  treeStats,
  type RepertoireTree,
} from './tree'

function must<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('expected a value')
  return value
}

function line(tree: RepertoireTree, moves: string): RepertoireTree {
  const edit = addLine(tree, tree.rootId, moves.split(' '), testContext())
  if (!edit.ok) throw new Error(edit.error.message)
  return edit.value.tree
}

describe('addMove', () => {
  it('creates a node with ply, side, position key and ECO from the position', () => {
    const ctx = testContext()
    const tree = emptyTree('white', ctx)
    const edit = addMove(tree, tree.rootId, 'e4', {}, ctx)
    if (!edit.ok) throw new Error(edit.error.message)
    const node = edit.value.value
    expect(node.san).toBe('e4')
    expect(node.uci).toBe('e2e4')
    expect(node.ply).toBe(1)
    expect(node.isYourMove).toBe(true)
    expect(node.isMainLine).toBe(true)
    expect(node.positionKey).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -')
    expect(node.eco).toBe('B00')
    expect(edit.value.change.put.map((row) => row.id)).toContain(tree.rootId)
  })

  it('marks opponent moves as not yours, per colour', () => {
    const white = line(emptyTree('white'), 'e4 e5')
    expect(must(findBySanPath(white, ['e4', 'e5'])).isYourMove).toBe(false)
    const black = line(emptyTree('black'), 'e4 e5')
    expect(must(findBySanPath(black, ['e4'])).isYourMove).toBe(false)
    expect(must(findBySanPath(black, ['e4', 'e5'])).isYourMove).toBe(true)
  })

  it('is idempotent for a move that already exists', () => {
    const tree = line(emptyTree('white'), 'e4 e5')
    const again = addMove(tree, tree.rootId, 'e4')
    if (!again.ok) throw new Error(again.error.message)
    expect(again.value.change.put).toHaveLength(0)
    expect(again.value.tree.nodes.size).toBe(tree.nodes.size)
  })

  it('rejects an illegal move and an unknown parent', () => {
    const tree = emptyTree('white')
    expect(addMove(tree, tree.rootId, 'e5').ok).toBe(false)
    expect(addMove(tree, 'missing' as RepertoireNodeId, 'e4').ok).toBe(false)
  })

  it('accepts UCI as well as SAN', () => {
    const tree = emptyTree('white')
    const edit = addMove(tree, tree.rootId, 'g1f3')
    if (!edit.ok) throw new Error(edit.error.message)
    expect(edit.value.value.san).toBe('Nf3')
  })

  it('does not mutate the tree it was given', () => {
    const tree = emptyTree('white')
    const size = tree.nodes.size
    addMove(tree, tree.rootId, 'e4')
    expect(tree.nodes.size).toBe(size)
    expect(must(tree.nodes.get(tree.rootId)).childIds).toHaveLength(0)
  })
})

describe('main line', () => {
  it('gives the first child the main line, and setMainLine promotes a sibling with its ancestors', () => {
    const tree = line(line(emptyTree('white'), 'e4 e5 Nf3'), 'e4 c5 Nf3')
    const e5 = must(findBySanPath(tree, ['e4', 'e5']))
    const c5 = must(findBySanPath(tree, ['e4', 'c5']))
    expect(e5.isMainLine).toBe(true)
    expect(c5.isMainLine).toBe(false)
    const edit = setMainLine(tree, c5.id)
    if (!edit.ok) throw new Error(edit.error.message)
    const next = edit.value.tree
    expect(must(next.nodes.get(c5.id)).isMainLine).toBe(true)
    expect(must(next.nodes.get(e5.id)).isMainLine).toBe(false)
    const e4 = must(findBySanPath(next, ['e4']))
    expect(e4.childIds[0]).toBe(c5.id)
    expect(childrenOf(next, e4.id).map((child) => child.san)).toEqual(['c5', 'e5'])
  })
})

describe('annotate', () => {
  it('sets, replaces and clears fields', () => {
    const tree = line(emptyTree('white'), 'e4')
    const id = must(findBySanPath(tree, ['e4'])).id
    const set = annotate(tree, id, { comment: 'Claim the centre', tags: ['classical'] })
    if (!set.ok) throw new Error(set.error.message)
    expect(set.value.value.comment).toBe('Claim the centre')
    expect(set.value.value.tags).toEqual(['classical'])
    const cleared = annotate(set.value.tree, id, { comment: null })
    if (!cleared.ok) throw new Error(cleared.error.message)
    expect(cleared.value.value.comment).toBeUndefined()
    expect(cleared.value.value.tags).toEqual(['classical'])
  })
})

describe('deleteSubtree', () => {
  it('removes the whole branch, unlinks it and promotes the next sibling', () => {
    const tree = line(line(emptyTree('white'), 'e4 e5 Nf3 Nc6'), 'e4 c5')
    const e5 = must(findBySanPath(tree, ['e4', 'e5']))
    const edit = deleteSubtree(tree, e5.id)
    if (!edit.ok) throw new Error(edit.error.message)
    expect(edit.value.value.map((node) => node.san)).toEqual(['e5', 'Nf3', 'Nc6'])
    expect(edit.value.change.removed).toHaveLength(3)
    expect(findBySanPath(edit.value.tree, ['e4', 'e5'])).toBeUndefined()
    expect(must(findBySanPath(edit.value.tree, ['e4', 'c5'])).isMainLine).toBe(true)
  })

  it('refuses to delete the root', () => {
    const tree = emptyTree('white')
    expect(deleteSubtree(tree, tree.rootId).ok).toBe(false)
  })
})

describe('transpositions', () => {
  it('detects two move orders that reach one position', () => {
    const tree = line(line(emptyTree('white'), 'e4 e5 Nf3 Nc6'), 'Nf3 Nc6 e4 e5')
    const groups = findTranspositions(tree)
    const final = must(findBySanPath(tree, ['e4', 'e5', 'Nf3', 'Nc6']))
    const group = groups.find((entry) => entry.positionKey === final.positionKey)
    expect(group?.nodeIds).toHaveLength(2)
    const other = transpositionsOf(tree, final.id)
    expect(other.map((node) => lineTo(tree, node.id))).toEqual(['1.Nf3 Nc6 2.e4 e5'])
  })

  it('finds none in a tree with no repeated positions', () => {
    expect(findTranspositions(line(emptyTree('white'), 'e4 e5 Nf3'))).toEqual([])
  })
})

describe('lines and stats', () => {
  it("counts only paths that end on the player's own move", () => {
    const tree = line(line(emptyTree('white'), 'e4 e5 Nf3'), 'e4 c5')
    expect(lineEnds(tree).map((node) => node.san)).toEqual(['Nf3'])
    expect(treeStats(tree)).toEqual({ nodes: 4, yourMoves: 2, lines: 1 })
  })

  it('finds the outermost named head at or above a node', () => {
    const tree = line(emptyTree('white'), 'e4 e5 Nf3')
    const e4 = must(findBySanPath(tree, ['e4']))
    const named = annotate(tree, e4.id, { openingName: 'King pawn' })
    if (!named.ok) throw new Error(named.error.message)
    const leaf = must(findBySanPath(named.value.tree, ['e4', 'e5', 'Nf3']))
    expect(headOf(named.value.tree, leaf.id)?.id).toBe(e4.id)
  })
})

describe('formatting and paths', () => {
  it('numbers white moves and elides a black move at the start', () => {
    const tree = line(emptyTree('black'), 'e4 c6 d4 d5')
    const nodes = pathTo(tree, must(findBySanPath(tree, ['e4', 'c6', 'd4', 'd5'])).id)
    expect(formatLine(nodes)).toBe('1.e4 c6 2.d4 d5')
    expect(formatLine(nodes.slice(2))).toBe('1…c6 2.d4 d5')
  })
})

describe('addBranches', () => {
  it('merges a branching tree, creating only what is missing', () => {
    const tree = line(emptyTree('white'), 'e4 e5')
    const edit = addBranches(tree, tree.rootId, [
      {
        san: 'e4',
        children: [
          { san: 'e5', children: [{ san: 'Nf3', children: [] }] },
          { san: 'c5', comment: 'Sicilian', children: [] },
        ],
      },
    ])
    if (!edit.ok) throw new Error(edit.error.message)
    expect(edit.value.value).toBe(2)
    expect(subtreeOf(edit.value.tree, edit.value.tree.rootId)).toHaveLength(5)
    expect(must(findBySanPath(edit.value.tree, ['e4', 'c5'])).comment).toBe('Sicilian')
  })

  it('fails on an illegal move without a partial tree', () => {
    const tree = emptyTree('white')
    expect(addBranches(tree, tree.rootId, [{ san: 'Ke2', children: [] }]).ok).toBe(false)
  })
})

describe('changes', () => {
  it('combineChanges keeps the last version of a row and drops rows later removed', () => {
    const ctx = testContext()
    const tree = emptyTree('white', ctx)
    const first = addMove(tree, tree.rootId, 'e4', {}, ctx)
    if (!first.ok) throw new Error(first.error.message)
    const second = deleteSubtree(first.value.tree, first.value.value.id, ctx)
    if (!second.ok) throw new Error(second.error.message)
    const combined = combineChanges([first.value.change, second.value.change])
    expect(combined.removed).toEqual([first.value.value.id])
    expect(combined.put.map((row) => row.id)).toEqual([tree.rootId])
  })

  it('buildTree needs a root and ignores the other colour', () => {
    const tree = line(emptyTree('white'), 'e4')
    const rows = [...tree.nodes.values()]
    expect(buildTree('white', rows)?.nodes.size).toBe(2)
    expect(buildTree('black', rows)).toBeNull()
    expect(buildTree('white', [])).toBeNull()
    expect(must(buildTree('white', rows)).nodes.get(tree.rootId)?.fen).toBe(START_FEN)
  })
})
