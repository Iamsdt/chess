import type { Color, Fen, RepertoireNodeId } from '@/domain'

import { lineMastery } from './drill'
import { outerHeads, subtreeOf, type RepertoireTree } from './tree'

import type { LineSummary } from './service'

/** What one opening card on the repertoire tab shows, derived from the stored tree. */
export interface OpeningSummary {
  readonly id: RepertoireNodeId
  readonly name: string
  readonly details: string
  readonly fen: Fen
  readonly color: Color
  readonly lineCount: number
  readonly dueCount: number
  readonly masteryPercent: number
  readonly masteryCaption: string
}

/** Lines at or above this mastery count as "settled" in the caption. */
export const SETTLED_MASTERY = 60

export function isDue(line: LineSummary, at: Date): boolean {
  return line.card !== undefined && line.card.state !== 'mastered' && line.card.due <= at.getTime()
}

export function summarizeOpenings(
  tree: RepertoireTree,
  lines: readonly LineSummary[],
  at: Date,
): OpeningSummary[] {
  return outerHeads(tree).map((head) => {
    const inside = new Set(subtreeOf(tree, head.id).map((node) => node.id))
    const mine = lines.filter((line) => inside.has(line.node.id))
    const mastery = mine.map((line) => lineMastery(line.card))
    const average =
      mastery.length === 0
        ? 0
        : Math.round(mastery.reduce((sum, value) => sum + value, 0) / mastery.length)
    const settled = mastery.filter((value) => value >= SETTLED_MASTERY).length
    const parts = [
      head.eco,
      head.variation,
      `${String(mine.length)} ${mine.length === 1 ? 'line' : 'lines'}`,
    ]
    return {
      id: head.id,
      name: head.openingName ?? 'Opening',
      details: parts.filter((part): part is string => part !== undefined).join(' · '),
      fen: head.fen,
      color: tree.color,
      lineCount: mine.length,
      dueCount: mine.filter((line) => isDue(line, at)).length,
      masteryPercent: average,
      masteryCaption:
        mine.length === 0
          ? 'No lines yet. Add a move you play to start one.'
          : `${String(settled)} of ${String(mine.length)} lines settled`,
    }
  })
}

/** About three-quarters of a minute per line, rounded up to whole minutes. */
export function estimateMinutes(dueLines: number): number {
  return dueLines === 0 ? 0 : Math.max(1, Math.round((dueLines * 45) / 60))
}
