import { describe, expect, it } from 'vitest'

import { START_FEN, toFen, toSquare } from '@/domain'

import {
  addLine,
  addMove,
  childrenOf,
  createVariationTree,
  deleteNode,
  fenAt,
  gameAt,
  goTo,
  isMainLine,
  lastNodeId,
  lineStartOf,
  mainLineIds,
  nextNodeId,
  numberingFor,
  pathTo,
  plyOf,
  previousNodeId,
  promoteToMainLine,
  promoteVariation,
  VariationTreeSchema,
  type VariationNodeId,
  type VariationTree,
} from './variation-tree'

/** A tree with the given main line played from the start position. */
function lineOf(...moves: readonly string[]): VariationTree {
  const created = createVariationTree(START_FEN)
  expect(created.ok).toBe(true)
  if (!created.ok) throw new Error('unreachable')
  const added = addLine(created.value, null, moves)
  expect(added.ok).toBe(true)
  if (!added.ok) throw new Error(added.error.message)
  return added.value.tree
}

function sanOf(tree: VariationTree, id: VariationNodeId | null): string {
  return tree.nodes[id ?? '']?.san ?? '(root)'
}

/** Play `move` from `parentId` and fail the test if it was refused. */
function play(tree: VariationTree, parentId: VariationNodeId | null, move: string) {
  const added = addMove(tree, parentId, move)
  expect(added.ok).toBe(true)
  if (!added.ok) throw new Error(added.error.message)
  return added.value
}

describe('createVariationTree', () => {
  it('starts empty at the position it was given', () => {
    const tree = createVariationTree(START_FEN)
    expect(tree.ok).toBe(true)
    if (!tree.ok) return
    expect(tree.value.rootChildren).toEqual([])
    expect(tree.value.currentId).toBeNull()
    expect(tree.value.rootFen).toBe(START_FEN)
  })

  it('refuses a position that could not occur', () => {
    const tree = createVariationTree('8/8/8/8/8/8/8/8 w - - 0 1')
    expect(tree.ok).toBe(false)
  })

  it('normalises the castling field so two spellings are one root', () => {
    const tree = createVariationTree('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w qkQK - 0 1')
    expect(tree.ok).toBe(true)
    if (!tree.ok) return
    expect(tree.value.rootFen).toBe(START_FEN)
  })
})

describe('addMove', () => {
  it('appends to the line and follows the cursor', () => {
    const tree = lineOf('e4', 'e5', 'Nf3')
    expect(mainLineIds(tree).map((id) => sanOf(tree, id))).toEqual(['e4', 'e5', 'Nf3'])
    expect(sanOf(tree, tree.currentId)).toBe('Nf3')
    expect(plyOf(tree, tree.currentId)).toBe(3)
  })

  it('accepts the object form a board hands back', () => {
    const start = createVariationTree(START_FEN)
    if (!start.ok) throw new Error('unreachable')
    const added = addMove(start.value, null, { from: toSquare('e2'), to: toSquare('e4') })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(sanOf(added.value.tree, added.value.nodeId)).toBe('e4')
  })

  it('refuses an illegal move instead of storing it', () => {
    const start = createVariationTree(START_FEN)
    if (!start.ok) throw new Error('unreachable')
    const added = addMove(start.value, null, 'e5')
    expect(added.ok).toBe(false)
  })

  it('navigates to an existing move rather than making a twin', () => {
    const tree = lineOf('e4', 'e5')
    const first = tree.rootChildren[0] ?? null
    const again = play(tree, null, 'e4')
    expect(again.tree.rootChildren).toHaveLength(1)
    expect(again.nodeId).toBe(first)
    expect(again.tree.currentId).toBe(first)
  })

  it('starts a branch when a different move is played from the same position', () => {
    const tree = lineOf('e4', 'e5')
    const first = tree.rootChildren[0] ?? null
    const branched = play(tree, first, 'c5').tree
    expect(childrenOf(branched, first).map((id) => sanOf(branched, id))).toEqual(['e5', 'c5'])
    expect(mainLineIds(branched).map((id) => sanOf(branched, id))).toEqual(['e4', 'e5'])
  })

  it('stores the position after the move so navigation needs no replay', () => {
    const tree = lineOf('e4')
    expect(fenAt(tree, tree.currentId)).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    )
  })
})

describe('promote and delete', () => {
  /** e4 with three answers, so promotion has something to move past. */
  function branched() {
    const tree = lineOf('e4', 'e5')
    const first = tree.rootChildren[0] ?? null
    const withC5 = play(tree, first, 'c5')
    const withE6 = play(withC5.tree, first, 'e6')
    return { tree: withE6.tree, first, c5: withC5.nodeId, e6: withE6.nodeId }
  }

  it('moves a variation one place towards the main line', () => {
    const { tree, first, e6 } = branched()
    const promoted = promoteVariation(tree, e6)
    expect(childrenOf(promoted, first).map((id) => sanOf(promoted, id))).toEqual(['e5', 'e6', 'c5'])
  })

  it('leaves the main move alone when it is already first', () => {
    const { tree, first } = branched()
    const main = childrenOf(tree, first)[0] ?? ''
    expect(promoteVariation(tree, main)).toBe(tree)
  })

  it('makes a whole line main, all the way to the root', () => {
    const { tree, first, c5 } = branched()
    const deep = play(tree, c5, 'Nf3').tree
    const alternative = play(deep, null, 'd4').tree
    const promoted = promoteToMainLine(alternative, c5)
    expect(childrenOf(promoted, first)[0]).toBe(c5)
    expect(promoted.rootChildren[0]).toBe(first)
    expect(mainLineIds(promoted).map((id) => sanOf(promoted, id))).toEqual(['e4', 'c5', 'Nf3'])
  })

  it('deletes a move with everything hanging off it', () => {
    const { tree, first, c5 } = branched()
    const deep = play(tree, c5, 'Nf3').tree
    const pruned = deleteNode(deep, c5)
    expect(childrenOf(pruned, first).map((id) => sanOf(pruned, id))).toEqual(['e5', 'e6'])
    expect(Object.values(pruned.nodes).some((node) => node.san === 'Nf3')).toBe(false)
  })

  it('falls back to the parent when the cursor was inside what was deleted', () => {
    const { tree, first, c5 } = branched()
    const deep = play(tree, c5, 'Nf3')
    const pruned = deleteNode(deep.tree, c5)
    expect(pruned.currentId).toBe(first)
  })

  it('leaves the cursor where it was when something else is deleted', () => {
    const { tree, c5, e6 } = branched()
    const onC5 = goTo(tree, c5)
    expect(deleteNode(onC5, e6).currentId).toBe(c5)
  })

  it('ignores a delete for a move that is no longer there', () => {
    const { tree } = branched()
    expect(deleteNode(tree, 'nope')).toBe(tree)
  })
})

describe('navigation', () => {
  it('walks forward, back, and to the end of the line the cursor is on', () => {
    const tree = lineOf('e4', 'e5', 'Nf3')
    const atStart = goTo(tree, null)
    const first = nextNodeId(atStart)
    expect(sanOf(tree, first)).toBe('e4')
    expect(previousNodeId(tree, first)).toBeNull()
    expect(sanOf(tree, lastNodeId(atStart))).toBe('Nf3')
  })

  it('refuses to point at a move that is not in the tree', () => {
    const tree = lineOf('e4')
    expect(goTo(tree, 'gone')).toBe(tree)
  })

  it('knows whether the cursor is on the main line', () => {
    const tree = lineOf('e4', 'e5')
    const first = tree.rootChildren[0] ?? null
    const branch = play(tree, first, 'c5')
    expect(isMainLine(branch.tree, branch.nodeId)).toBe(false)
    expect(isMainLine(branch.tree, first)).toBe(true)
  })
})

describe('replay and numbering', () => {
  it('rebuilds a game with its history, so repetition and check still work', () => {
    const tree = lineOf('f3', 'e5', 'g4', 'Qh4')
    const game = gameAt(tree, tree.currentId)
    expect(game.ok).toBe(true)
    if (!game.ok) return
    expect(game.value.history).toHaveLength(4)
    expect(game.value.status).toEqual({ kind: 'checkmate', winner: 'black' })
  })

  it('numbers moves from the root position, not from move one', () => {
    const start = createVariationTree(
      'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7',
    )
    if (!start.ok) throw new Error('unreachable')
    const line = lineStartOf(start.value)
    expect(line).toEqual({ fullmoveNumber: 7, whiteToMove: true })
    expect(numberingFor(1, line)).toEqual({ moveNumber: 7, white: true })
    expect(numberingFor(2, line)).toEqual({ moveNumber: 7, white: false })
    expect(numberingFor(3, line)).toEqual({ moveNumber: 8, white: true })
  })

  it('numbers a position where Black moves first', () => {
    const line = { fullmoveNumber: 7, whiteToMove: false }
    expect(numberingFor(1, line)).toEqual({ moveNumber: 7, white: false })
    expect(numberingFor(2, line)).toEqual({ moveNumber: 8, white: true })
    expect(numberingFor(3, line)).toEqual({ moveNumber: 8, white: false })
  })
})

describe('surviving storage', () => {
  it('round-trips through JSON', () => {
    const tree = lineOf('e4', 'e5', 'Nf3')
    const restored = VariationTreeSchema.safeParse(JSON.parse(JSON.stringify(tree)))
    expect(restored.success).toBe(true)
    if (!restored.success) return
    expect(mainLineIds(restored.data).map((id) => sanOf(restored.data, id))).toEqual([
      'e4',
      'e5',
      'Nf3',
    ])
  })

  it('rejects a record whose moves are not SAN', () => {
    const tree = lineOf('e4')
    const broken = JSON.parse(JSON.stringify(tree)) as { nodes: Record<string, { san: string }> }
    const first = Object.values(broken.nodes)[0]
    if (first !== undefined) first.san = 'not a move'
    expect(VariationTreeSchema.safeParse(broken).success).toBe(false)
  })

  it('does not hang on a cycle a corrupted record could contain', () => {
    const tree = lineOf('e4', 'e5')
    const [first, second] = mainLineIds(tree)
    if (first === undefined || second === undefined) throw new Error('unreachable')
    const firstNode = tree.nodes[first]
    if (firstNode === undefined) throw new Error('unreachable')
    const looped: VariationTree = {
      ...tree,
      nodes: { ...tree.nodes, [first]: { ...firstNode, parentId: second } },
    }
    expect(pathTo(looped, second).length).toBeLessThanOrEqual(3)
    expect(lastNodeId(looped, second)).toBeTruthy()
  })
})

describe('addLine', () => {
  it('leaves the cursor where it started when there is nothing to add', () => {
    const tree = lineOf('e4')
    const added = addLine(tree, tree.currentId, [])
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(added.value.nodeId).toBe(tree.currentId)
  })

  it('reports the first illegal move in the line', () => {
    const tree = createVariationTree(toFen(START_FEN))
    if (!tree.ok) throw new Error('unreachable')
    const added = addLine(tree.value, null, ['e4', 'e5', 'Ke2', 'Ke7', 'Qq9'])
    expect(added.ok).toBe(false)
  })
})
