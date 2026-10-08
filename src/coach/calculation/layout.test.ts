import { describe, expect, it } from 'vitest'

import { CALCULATION_CARD } from '../fixtures/calculation-fixtures'

import { layoutTree } from './layout'

describe('layoutTree', () => {
  const layout = layoutTree(CALCULATION_CARD.nodes)

  it('places every node once, with one edge per non-root node', () => {
    expect(layout.chips).toHaveLength(CALCULATION_CARD.nodes.length)
    expect(layout.edges).toHaveLength(CALCULATION_CARD.nodes.length - 4)
  })

  it('uses the ply as the column and a distinct row per leaf', () => {
    const byId = new Map(layout.chips.map((chip) => [chip.id, chip]))
    expect(byId.get('d4')?.column).toBe(0)
    expect(byId.get('d4-exd4-oo')?.column).toBe(2)
    const leaves = CALCULATION_CARD.nodes.filter((n) => n.stop !== undefined)
    expect(new Set(leaves.map((n) => byId.get(n.id)?.row)).size).toBe(leaves.length)
    expect(layout.rows).toBe(leaves.length)
  })

  it('keeps a parent on the row of its first child', () => {
    const byId = new Map(layout.chips.map((chip) => [chip.id, chip]))
    expect(byId.get('d4')?.row).toBe(byId.get('d4-exd4')?.row)
    expect(byId.get('d4-bd6')?.row).toBeGreaterThan(byId.get('d4-exd4')?.row ?? 0)
  })

  it('is empty for no nodes', () => {
    expect(layoutTree([])).toMatchObject({ chips: [], rows: 0, width: 0 })
  })
})
