import { describe, expect, it } from 'vitest'

import { treeFromPgn, treeToPgn } from './tree-pgn'
import { childrenOf, mainLineIds, type VariationTree } from './variation-tree'

/** The prototype's own analysis PGN: a main line with two side lines. */
const PROTOTYPE_PGN =
  '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. a4 (7. b4 Bb6 8. a4 a5) ' +
  '7... a6 (7... a5 8. h3 h6) 8. Re1 Ba7 9. h3 Be6 *'

/** A game that starts at move 20, so the FEN header and the numbering both matter. */
const MIDGAME_FEN = '6k1/5ppp/8/8/8/8/5PPP/R3K2R w KQ - 0 20'
const MIDGAME_PGN = `[SetUp "1"]\n[FEN "${MIDGAME_FEN}"]\n\n20. O-O Kh8 *`

function sans(tree: VariationTree, ids: readonly string[]): string[] {
  return ids.map((id) => tree.nodes[id]?.san ?? '?')
}

describe('treeFromPgn', () => {
  it('keeps the main line and hangs each variation off the move it replaces', () => {
    const tree = treeFromPgn(PROTOTYPE_PGN)
    expect(tree.ok).toBe(true)
    if (!tree.ok) return

    expect(sans(tree.value, mainLineIds(tree.value))).toEqual([
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'Bc4',
      'Bc5',
      'c3',
      'Nf6',
      'd3',
      'd6',
      'O-O',
      'O-O',
      'a4',
      'a6',
      'Re1',
      'Ba7',
      'h3',
      'Be6',
    ])

    const seventhWhite = mainLineIds(tree.value)[12]
    if (seventhWhite === undefined) throw new Error('unreachable')
    const alternativesToA4 = childrenOf(
      tree.value,
      tree.value.nodes[seventhWhite]?.parentId ?? null,
    )
    expect(sans(tree.value, alternativesToA4)).toEqual(['a4', 'b4'])
  })

  it('leaves the cursor at the root, so the pasted position is what is shown', () => {
    const tree = treeFromPgn(PROTOTYPE_PGN)
    expect(tree.ok).toBe(true)
    if (!tree.ok) return
    expect(tree.value.currentId).toBeNull()
  })

  it('starts from the FEN header when the game does not start at move one', () => {
    const tree = treeFromPgn(MIDGAME_PGN)
    expect(tree.ok).toBe(true)
    if (!tree.ok) return
    expect(tree.value.rootFen).toBe(MIDGAME_FEN)
    expect(sans(tree.value, mainLineIds(tree.value))).toEqual(['O-O', 'Kh8'])
  })

  it('refuses a game with a move that cannot be played', () => {
    expect(treeFromPgn('1. e4 e5 2. Nf7 *').ok).toBe(false)
  })
})

describe('treeToPgn', () => {
  it('round-trips a tree with branches back through the parser', () => {
    const first = treeFromPgn(PROTOTYPE_PGN)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const written = treeToPgn(first.value)
    expect(written.ok).toBe(true)
    if (!written.ok) return

    const second = treeFromPgn(written.value)
    expect(second.ok).toBe(true)
    if (!second.ok) return

    expect(sans(second.value, mainLineIds(second.value))).toEqual(
      sans(first.value, mainLineIds(first.value)),
    )
    expect(Object.keys(second.value.nodes)).toHaveLength(Object.keys(first.value.nodes).length)
  })

  it('writes the SetUp and FEN headers for a position that is not the start', () => {
    const tree = treeFromPgn(MIDGAME_PGN)
    if (!tree.ok) throw new Error('unreachable')
    const written = treeToPgn(tree.value)
    expect(written.ok).toBe(true)
    if (!written.ok) return
    expect(written.value).toContain('[SetUp "1"]')
    expect(written.value).toContain(`[FEN "${MIDGAME_FEN}"]`)
    expect(written.value).toContain('20. O-O')
  })

  it('writes an empty game as headers and a result', () => {
    const tree = treeFromPgn('*')
    if (!tree.ok) throw new Error('unreachable')
    const written = treeToPgn(tree.value)
    expect(written.ok).toBe(true)
    if (!written.ok) return
    expect(written.value.trimEnd().endsWith('*')).toBe(true)
  })
})
