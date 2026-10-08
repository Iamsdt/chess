import { describe, expect, it } from 'vitest'

import { CalculationAttachmentSchema } from '@/domain'

import { replayTree } from '../calculation/tree-model'

import { CALCULATION_CARD } from './calculation-fixtures'

describe('CALCULATION_CARD', () => {
  it('parses against the attachment schema', () => {
    expect(CalculationAttachmentSchema.safeParse(CALCULATION_CARD).success).toBe(true)
  })

  it('replays every line legally through the rules', () => {
    const { positions, illegal } = replayTree(CALCULATION_CARD)
    expect(illegal).toEqual([])
    expect(positions.size).toBe(CALCULATION_CARD.nodes.length)
  })

  it('has consistent parents, unique ids and a stop on every leaf', () => {
    const ids = new Set(CALCULATION_CARD.nodes.map((n) => n.id))
    expect(ids.size).toBe(CALCULATION_CARD.nodes.length)
    const parents = new Set(CALCULATION_CARD.nodes.map((n) => n.parentId))
    for (const node of CALCULATION_CARD.nodes) {
      if (node.parentId !== null) expect(ids.has(node.parentId)).toBe(true)
      if (!parents.has(node.id)) expect(node.stop).toBeDefined()
      else expect(node.stop).toBeUndefined()
      if (node.parentId === null) {
        expect(node.branchName).toBeDefined()
        expect(node.idea).toBeDefined()
      }
    }
  })
})
