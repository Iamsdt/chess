import { describe, expect, it } from 'vitest'

import { buildCatalogue, materializeSpec, OPENING_SPECS, splitMoves, STARTER_IDS } from './library'
import { emptyTree, testContext } from './test-helpers'
import { findBySanPath, findTranspositions, headOf, lineEnds, treeStats } from './tree'

describe('opening specs', () => {
  it.each(OPENING_SPECS.map((spec) => [spec.id, spec] as const))(
    "%s plays legally and every line ends on the player's own move",
    (_id, spec) => {
      const ctx = testContext()
      const base = emptyTree(spec.color, ctx)
      const result = materializeSpec(base, spec, ctx)
      if (!result.ok) throw new Error(result.error.message)
      const tree = result.value.tree
      expect(lineEnds(tree)).toHaveLength(
        new Set(spec.lines.map((line) => splitMoves(line).join(' '))).size,
      )
      const head = findBySanPath(tree, splitMoves(spec.lines[0] ?? '').slice(0, spec.headMoves))
      expect(head?.openingName).toBe(spec.name)
    },
  )

  it('seeds the Italian with a real transposition and a named head', () => {
    const spec = OPENING_SPECS.find((entry) => entry.id === 'italian')
    if (spec === undefined) throw new Error('missing spec')
    const ctx = testContext()
    const result = materializeSpec(emptyTree('white', ctx), spec, ctx)
    if (!result.ok) throw new Error(result.error.message)
    expect(findTranspositions(result.value.tree).length).toBeGreaterThan(0)
    const leaf = lineEnds(result.value.tree)[0]
    expect(leaf).toBeDefined()
    expect(headOf(result.value.tree, leaf?.id ?? result.value.tree.rootId)?.openingName).toBe(
      'Italian Game',
    )
  })

  it('builds a catalogue whose codes come from the ECO table', () => {
    const catalogue = buildCatalogue()
    expect(catalogue).toHaveLength(OPENING_SPECS.length)
    const caro = catalogue.find((entry) => entry.id === 'caro-kann')
    expect(caro?.eco).toBe('B10')
    expect(caro?.codeAndMoves).toBe('B10 · 1.e4 c6')
    expect(catalogue.every((entry) => entry.eco !== null)).toBe(true)
  })

  it('has a starter set that covers both colours', () => {
    const colours = new Set(
      OPENING_SPECS.filter((s) => STARTER_IDS.includes(s.id)).map((s) => s.color),
    )
    expect(colours).toEqual(new Set(['white', 'black']))
    expect(treeStats(emptyTree('white')).nodes).toBe(0)
  })
})
