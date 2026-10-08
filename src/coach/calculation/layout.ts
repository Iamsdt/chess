import type { CalcNode } from '@/domain'

/**
 * Pure tree layout (coach-agent.md §9.3): one column per ply, one row per branch.
 *
 * Why rows follow leaves: a parent sits on the row of its first child, so a line reads
 * left to right on one row and a sibling starts a new row below, like a move tree on paper.
 */

export const CHIP_WIDTH = 112
export const CHIP_HEIGHT = 28
export const COLUMN_GAP = 22
/** Space above each chip, where the branch name sits on a root candidate. */
export const LABEL_HEIGHT = 16
export const ROW_GAP = 10

export interface LayoutChip {
  readonly id: string
  readonly node: CalcNode
  /** Ply index below the root: 0 for a root candidate. */
  readonly column: number
  readonly row: number
  readonly x: number
  readonly y: number
}

export interface LayoutEdge {
  readonly from: string
  readonly to: string
}

export interface TreeLayout {
  readonly chips: readonly LayoutChip[]
  readonly edges: readonly LayoutEdge[]
  readonly columns: number
  readonly rows: number
  readonly width: number
  readonly height: number
}

export function layoutTree(nodes: readonly CalcNode[]): TreeLayout {
  const known = new Set(nodes.map((node) => node.id))
  const children = new Map<string | null, CalcNode[]>()
  for (const node of nodes) {
    // An orphan (parent missing) is dropped rather than drawn at a made-up place.
    if (node.parentId !== null && !known.has(node.parentId)) continue
    const list = children.get(node.parentId) ?? []
    list.push(node)
    children.set(node.parentId, list)
  }

  const chips: LayoutChip[] = []
  const edges: LayoutEdge[] = []
  let nextRow = 0
  let maxColumn = -1

  const place = (node: CalcNode, column: number): number => {
    const kids = children.get(node.id) ?? []
    let row = nextRow
    if (kids.length === 0) {
      nextRow += 1
    } else {
      kids.forEach((kid, index) => {
        const kidRow = place(kid, column + 1)
        if (index === 0) row = kidRow
        edges.push({ from: node.id, to: kid.id })
      })
    }
    maxColumn = Math.max(maxColumn, column)
    chips.push({
      id: node.id,
      node,
      column,
      row,
      x: column * (CHIP_WIDTH + COLUMN_GAP),
      y: row * (LABEL_HEIGHT + CHIP_HEIGHT + ROW_GAP) + LABEL_HEIGHT,
    })
    return row
  }

  for (const root of children.get(null) ?? []) place(root, 0)

  const columns = maxColumn + 1
  return {
    chips: chips.sort((a, b) => a.column - b.column || a.row - b.row),
    edges,
    columns,
    rows: nextRow,
    width: columns === 0 ? 0 : columns * CHIP_WIDTH + (columns - 1) * COLUMN_GAP,
    height: nextRow === 0 ? 0 : nextRow * (LABEL_HEIGHT + CHIP_HEIGHT + ROW_GAP) - ROW_GAP,
  }
}
