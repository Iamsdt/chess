import { toRepertoireNodeId, toTimestamp, type Color } from '@/domain'

import { createTree, type EditContext, type RepertoireTree } from './tree'

/** Stable ids and a fixed clock, so assertions can name nodes and diffs stay readable. */
let counter = 0

export function testContext(): EditContext {
  return {
    newId: () => {
      counter += 1
      return toRepertoireNodeId(`n${String(counter)}`)
    },
    now: () => toTimestamp(1_700_000_000_000),
  }
}

export function emptyTree(color: Color, ctx: EditContext = testContext()): RepertoireTree {
  return createTree(color, ctx).tree
}
