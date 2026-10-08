import type { RepertoireNode, RepertoireNodeId } from '@/domain'

import { formatLine, pathTo, type RepertoireTree } from './tree'

/**
 * Words and numbers the drill screen shows, derived from the tree so the component only
 * lays them out.
 */

/** The moves of a line after the opening's head, e.g. `4.Nf3 e6 5.Be2 c5`. */
export function lineText(
  tree: RepertoireTree,
  headId: RepertoireNodeId,
  nodeId: RepertoireNodeId,
): string {
  const head = tree.nodes.get(headId)
  const after = pathTo(tree, nodeId).filter((node) => node.ply > (head?.ply ?? 0))
  return formatLine(after)
}

/** The moves up to and including the head, shown as already played. */
export function preludeNodes(tree: RepertoireTree, headId: RepertoireNodeId): RepertoireNode[] {
  return pathTo(tree, headId).filter((node) => node.san !== null)
}

/** The most specific variation name on the way to a node, e.g. `Advance Variation`. */
export function variationAlong(tree: RepertoireTree, nodeId: RepertoireNodeId): string | undefined {
  const path = pathTo(tree, nodeId)
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const variation = path[index]?.variation
    if (variation !== undefined) return variation
  }
  return undefined
}

/** `3.e5` or `3…Bf5`: how a single move is written when it stands alone. */
export function moveText(node: RepertoireNode): string {
  const number = Math.ceil(node.ply / 2)
  const san = node.san ?? ''
  return node.ply % 2 === 1 ? `${String(number)}.${san}` : `${String(number)}…${san}`
}
