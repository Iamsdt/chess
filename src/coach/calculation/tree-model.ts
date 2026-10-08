import { applyMove, createGame, type ChessGame } from '@/chess'
import type { CalcNode, CalculationAttachment, CoachEval, Color, Fen, Square, Uci } from '@/domain'

/**
 * Pure helpers over a flat calculation tree: replay, lines, evals.
 *
 * Why replay here and not trust the nodes: the tree carries SANs only, so the board
 * position of every node is derived through the rules. A SAN that is not legal drops its
 * whole subtree from the UI instead of drawing a position that cannot exist.
 */

export interface NodePosition {
  readonly id: string
  readonly fenBefore: Fen
  readonly fenAfter: Fen
  readonly from: Square
  readonly to: Square
  readonly uci: Uci
  /** The side that played this node's move. */
  readonly mover: Color
  /** 1-based full-move number as a move list prints it. */
  readonly moveNumber: number
  /** Plies below the root position; 1 for a root candidate. */
  readonly ply: number
}

export interface ReplayResult {
  readonly positions: ReadonlyMap<string, NodePosition>
  /** Ids whose SAN is illegal (or whose ancestor's is). Empty for a sound tree. */
  readonly illegal: readonly string[]
}

export function childrenMap(
  nodes: readonly CalcNode[],
): ReadonlyMap<string | null, readonly CalcNode[]> {
  const map = new Map<string | null, CalcNode[]>()
  for (const node of nodes) {
    const list = map.get(node.parentId) ?? []
    list.push(node)
    map.set(node.parentId, list)
  }
  return map
}

export function replayTree(attachment: CalculationAttachment): ReplayResult {
  const root = createGame(attachment.fen)
  const positions = new Map<string, NodePosition>()
  const illegal: string[] = []
  if (!root.ok) return { positions, illegal: attachment.nodes.map((node) => node.id) }
  const kids = childrenMap(attachment.nodes)

  const walk = (parentId: string | null, game: ChessGame, ply: number): void => {
    for (const node of kids.get(parentId) ?? []) {
      const next = applyMove(game, node.san)
      const played = next.ok ? next.value.history.at(-1) : undefined
      if (!next.ok || played === undefined) {
        illegal.push(node.id)
        markIllegal(node.id)
        continue
      }
      positions.set(node.id, {
        id: node.id,
        fenBefore: game.fen,
        fenAfter: next.value.fen,
        from: played.from,
        to: played.to,
        uci: played.uci,
        mover: played.color,
        moveNumber: played.moveNumber,
        ply,
      })
      walk(node.id, next.value, ply + 1)
    }
  }
  const markIllegal = (id: string): void => {
    for (const kid of kids.get(id) ?? []) {
      illegal.push(kid.id)
      markIllegal(kid.id)
    }
  }
  walk(null, root.value, 1)
  return { positions, illegal }
}

/** The principal line below a node: always the first child, which is how trees are written. */
export function mainLineFrom(
  kids: ReadonlyMap<string | null, readonly CalcNode[]>,
  fromId: string | null,
): CalcNode[] {
  const line: CalcNode[] = []
  let current = kids.get(fromId)?.[0]
  while (current !== undefined) {
    line.push(current)
    current = kids.get(current.id)?.[0]
  }
  return line
}

/** The nodes from a root candidate down to `id`, inclusive. */
export function pathTo(nodes: readonly CalcNode[], id: string): CalcNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const path: CalcNode[] = []
  let current = byId.get(id)
  while (current !== undefined) {
    path.unshift(current)
    current = current.parentId === null ? undefined : byId.get(current.parentId)
  }
  return path
}

/** Siblings of a node, itself included, in tree order. */
export function siblingsOf(
  kids: ReadonlyMap<string | null, readonly CalcNode[]>,
  node: CalcNode,
): readonly CalcNode[] {
  return kids.get(node.parentId) ?? []
}

/* ── Evaluations ─────────────────────────────────────────────────────────── */

const MATE_CP = 100_000

/** White-centipawns as one number: a mate outranks any material count. */
export function evalValue(value: CoachEval): number {
  if (value.mate !== undefined) {
    const sign = value.mate >= 0 ? 1 : -1
    return sign * (MATE_CP - Math.abs(value.mate))
  }
  return value.cp ?? 0
}

/** Same number from the point of view of `color`. */
export function evalFor(value: CoachEval, color: Color): number {
  const white = evalValue(value)
  return color === 'white' ? white : -white
}

/** `+0.2`, `−2.1` (a real minus sign), `#3` for mate. White's point of view. */
export function formatEval(value: CoachEval): string {
  if (value.mate !== undefined) {
    return `${value.mate < 0 ? '−' : ''}#${String(Math.abs(value.mate))}`
  }
  const pawns = (value.cp ?? 0) / 100
  if (pawns === 0) return '0.0'
  return `${pawns > 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`
}

/** The eval at the end of a root candidate's principal line. */
export function finalEvalOf(
  kids: ReadonlyMap<string | null, readonly CalcNode[]>,
  root: CalcNode,
): CoachEval {
  return mainLineFrom(kids, root.id).at(-1)?.eval ?? root.eval
}

export interface CandidateSummary {
  readonly node: CalcNode
  readonly finalEval: CoachEval
  /** Final eval from the side-to-move's view: higher is better for the player choosing. */
  readonly score: number
  readonly isBest: boolean
}

export function summariseCandidates(
  attachment: CalculationAttachment,
  sideToMove: Color,
): CandidateSummary[] {
  const kids = childrenMap(attachment.nodes)
  const roots = kids.get(null) ?? []
  const rows = roots.map((node) => {
    const finalEval = finalEvalOf(kids, node)
    return { node, finalEval, score: evalFor(finalEval, sideToMove) }
  })
  const top = Math.max(...rows.map((row) => row.score))
  return rows.map((row) => ({ ...row, isBest: row.score === top }))
}

/** "Winning", "equal" or "losing" for the side choosing at the root. */
export const VERDICT_THRESHOLD_CP = 150
export type Verdict = 'winning' | 'equal' | 'losing'

export function verdictOf(score: number): Verdict {
  if (score >= VERDICT_THRESHOLD_CP) return 'winning'
  if (score <= -VERDICT_THRESHOLD_CP) return 'losing'
  return 'equal'
}

/** `6.d4` for White, `6…exd4` for Black. */
export function moveLabel(node: CalcNode, position: NodePosition | undefined): string {
  if (position === undefined) return node.san
  return `${String(position.moveNumber)}${position.mover === 'white' ? '.' : '…'}${node.san}`
}
