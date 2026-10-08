import { positionKeyFromFen, type Fen, type RepertoireNodeId } from '@/domain'

import { DEFAULT_MEANINGFUL_SHARE, type MoveDistribution } from './popularity'
import {
  childrenOf,
  getNode,
  isOpponentToMove,
  lineTo,
  treeStats,
  type RepertoireTree,
} from './tree'

/**
 * Coverage: "what happens if the opponent plays X?" for every X that matters.
 *
 * A reply is a gap when opponents play it often enough to meet it, and the repertoire
 * has no answer. An answer can be a child node, or a transposition: the position after
 * the reply already exists elsewhere in the tree and has a prepared move.
 */

export type GapKind = 'missing-reply' | 'no-answer'

export interface Gap {
  readonly kind: GapKind
  /** The node after which the opponent plays the unprepared reply. */
  readonly parentId: RepertoireNodeId
  readonly parentFen: Fen
  readonly san: string
  readonly uci: string
  readonly fenAfter: Fen
  /** Share of opponents choosing it at that position, 0-100. */
  readonly popularity: number
  /** Chance of reaching this position at all, times the share: how much it matters. */
  readonly weight: number
  /** The moves that lead to the parent, e.g. `1.e4 c6 2.d4`. */
  readonly path: string
}

export interface CoverageReport {
  readonly gaps: readonly Gap[]
  /** Positions where the opponent moves and a distribution was available. */
  readonly checkedPositions: number
  /** Share of weighted meaningful replies that have an answer, 0-100. */
  readonly coveragePercent: number
  readonly lines: number
  readonly yourMoves: number
}

export interface CoverageOptions {
  /** Replies at or above this share count. */
  readonly threshold?: number
  /** Stops a runaway tree; far above any real repertoire. */
  readonly maxPositions?: number
}

const DEFAULT_MAX_POSITIONS = 5000

/** A coverage walk that can be paused, so a cold estimate never blocks a frame. */
export interface CoverageRun {
  /** Does work for about `budgetMs`, returns true once the walk is finished. */
  readonly step: (budgetMs: number) => boolean
  readonly report: () => CoverageReport
  /** Positions examined so far, for a progress line. */
  readonly checked: () => number
}

/**
 * Walks the repertoire from the root, weighting each position by how likely it is to
 * arise, and collects the meaningful replies with no prepared answer.
 *
 * Why resumable: the first estimate for a position generates moves, which costs a few
 * milliseconds; a large tree would hold the main thread for a second. Stepping in small
 * slices keeps input responsive, and later runs hit the estimate's cache.
 */
export function startCoverage(
  tree: RepertoireTree,
  distribution: MoveDistribution,
  options: CoverageOptions = {},
): CoverageRun {
  const threshold = options.threshold ?? DEFAULT_MEANINGFUL_SHARE
  const maxPositions = options.maxPositions ?? DEFAULT_MAX_POSITIONS

  const answered = new Set<string>()
  for (const node of tree.nodes.values()) {
    if (node.childIds.length > 0) answered.add(node.positionKey)
  }

  const gaps: Gap[] = []
  let coveredWeight = 0
  let missedWeight = 0
  let checkedPositions = 0
  const pending: { id: RepertoireNodeId; reach: number }[] = [{ id: tree.rootId, reach: 1 }]

  const visit = (item: { id: RepertoireNodeId; reach: number }): void => {
    const node = getNode(tree, item.id)
    if (node === undefined) return
    const children = childrenOf(tree, node.id)

    if (!isOpponentToMove(tree, node)) {
      for (const child of children) pending.push({ id: child.id, reach: item.reach })
      return
    }

    const meaningful = distribution(node.fen).filter((move) => move.popularity >= threshold)
    checkedPositions += 1
    const path = lineTo(tree, node.id)
    for (const move of meaningful) {
      const weight = item.reach * (move.popularity / 100)
      const child = children.find((candidate) => candidate.uci === move.uci)
      if (child !== undefined) {
        if (child.childIds.length > 0) {
          coveredWeight += weight
          pending.push({ id: child.id, reach: weight })
        } else if (answered.has(child.positionKey)) {
          coveredWeight += weight
        } else {
          missedWeight += weight
          gaps.push(gap('no-answer', node.id, node.fen, move, weight, path))
        }
        continue
      }
      if (answered.has(positionKeyFromFen(move.fenAfter))) {
        coveredWeight += weight
        continue
      }
      missedWeight += weight
      gaps.push(gap('missing-reply', node.id, node.fen, move, weight, path))
    }
    for (const child of children) {
      if (!meaningful.some((move) => move.uci === child.uci)) {
        pending.push({ id: child.id, reach: item.reach * ((child.popularity ?? 0) / 100) })
      }
    }
  }

  return {
    step(budgetMs) {
      const deadline = performance.now() + budgetMs
      while (pending.length > 0 && checkedPositions < maxPositions) {
        const item = pending.pop()
        if (item === undefined) break
        visit(item)
        if (performance.now() >= deadline) break
      }
      return pending.length === 0 || checkedPositions >= maxPositions
    },
    checked: () => checkedPositions,
    report() {
      const total = coveredWeight + missedWeight
      const stats = treeStats(tree)
      return {
        gaps: [...gaps].sort((a, b) => b.weight - a.weight),
        checkedPositions,
        coveragePercent: total === 0 ? 100 : Math.round((coveredWeight / total) * 100),
        lines: stats.lines,
        yourMoves: stats.yourMoves,
      }
    },
  }
}

/** The whole walk at once, for tests and for trees whose estimates are already cached. */
export function computeCoverage(
  tree: RepertoireTree,
  distribution: MoveDistribution,
  options: CoverageOptions = {},
): CoverageReport {
  const run = startCoverage(tree, distribution, options)
  run.step(Number.POSITIVE_INFINITY)
  return run.report()
}

function gap(
  kind: GapKind,
  parentId: RepertoireNodeId,
  parentFen: Fen,
  move: { san: string; uci: string; fenAfter: Fen; popularity: number },
  weight: number,
  path: string,
): Gap {
  return {
    kind,
    parentId,
    parentFen,
    san: move.san,
    uci: move.uci,
    fenAfter: move.fenAfter,
    popularity: move.popularity,
    weight,
    path,
  }
}
