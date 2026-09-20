import {
  applyMove,
  createGame,
  parsePgnGame,
  serializePgn,
  type ChessGame,
  type PgnGame,
  type PgnMoveNode,
} from '@/chess'
import { domainError, err, ok, type Result } from '@/domain'

import {
  addMove,
  childrenOf,
  createVariationTree,
  goTo,
  type VariationNode,
  type VariationNodeId,
  type VariationTree,
} from './variation-tree'

/**
 * PGN in and PGN out, with the branches intact.
 *
 * Why this is not folded into `variation-tree.ts`: the tree is the app's own shape
 * and PGN is an interchange format with its own opinions (a variation belongs to
 * the move it replaces, not to the position). Keeping the translation in one file
 * means the tree never has to think about `(…)` nesting.
 */

const PGN_HEADER_KEYS = ['Event', 'Site', 'Date', 'Round', 'White', 'Black'] as const

/** What `serializePgn` needs when the position never came from a real game. */
const ANALYSIS_HEADERS: Readonly<Record<string, string>> = {
  Event: 'Analysis',
  Site: 'Chess King',
  Date: '????.??.??',
  Round: '-',
  White: '?',
  Black: '?',
}

function absorb(
  tree: VariationTree,
  parentId: VariationNodeId | null,
  nodes: readonly PgnMoveNode[],
): Result<VariationTree> {
  let current = tree
  let cursor = parentId
  for (const node of nodes) {
    const added = addMove(current, cursor, node.move.uci)
    if (!added.ok) return added
    current = added.value.tree
    // A PGN variation is an alternative to *this* move, so it hangs off the same
    // parent — which is exactly how the tree stores a branch.
    for (const variation of node.variations) {
      const branch = absorb(current, cursor, variation)
      if (!branch.ok) return branch
      current = branch.value
    }
    cursor = added.value.nodeId
  }
  return ok(current)
}

/**
 * Build a tree from PGN text, keeping every variation.
 *
 * The cursor is left at the root so the screen shows the position the player
 * pasted, not the end of somebody else's game.
 */
export function treeFromPgn(text: string): Result<VariationTree> {
  const parsed = parsePgnGame(text)
  if (!parsed.ok) return parsed
  const tree = createVariationTree(parsed.value.initialFen)
  if (!tree.ok) return tree
  const filled = absorb(tree.value, null, parsed.value.moves)
  if (!filled.ok) return filled
  return ok(goTo(filled.value, null))
}

function lineFrom(
  tree: VariationTree,
  startGame: ChessGame,
  startId: VariationNodeId,
): Result<PgnMoveNode[]> {
  const written: PgnMoveNode[] = []
  const seen = new Set<VariationNodeId>()
  let game = startGame
  let cursor: VariationNodeId | null = startId

  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor)
    const node: VariationNode | undefined = tree.nodes[cursor]
    if (node === undefined) break

    const played = applyMove(game, node.uci)
    if (!played.ok) return played
    const move = played.value.history.at(-1)
    if (move === undefined) {
      return err(domainError('validation', 'A stored move is not legal here', { where: 'PGN' }))
    }

    const siblings = childrenOf(tree, node.parentId)
    const variations: PgnMoveNode[][] = []
    // Only the main move carries the alternatives; a variation that listed its own
    // siblings would print each branch once per sibling.
    if (siblings[0] === node.id) {
      for (const sibling of siblings.slice(1)) {
        const branch = lineFrom(tree, game, sibling)
        if (!branch.ok) return branch
        variations.push(branch.value)
      }
    }

    written.push({ move, nags: [], variations })
    game = played.value
    cursor = node.children[0] ?? null
  }

  return ok(written)
}

/** Serialise the whole tree, main line plus branches, as importable PGN. */
export function treeToPgn(
  tree: VariationTree,
  headers: Readonly<Record<string, string>> = {},
): Result<string> {
  const start = createGame(tree.rootFen)
  if (!start.ok) return start

  const first = tree.rootChildren[0]
  const moves = first === undefined ? ok<PgnMoveNode[]>([]) : lineFrom(tree, start.value, first)
  if (!moves.ok) return moves

  const merged: Record<string, string> = {}
  for (const key of PGN_HEADER_KEYS) {
    merged[key] = headers[key] ?? ANALYSIS_HEADERS[key] ?? '?'
  }
  const game: PgnGame = {
    headers: merged,
    initialFen: tree.rootFen,
    moves: moves.value,
    result: '*',
  }
  return ok(serializePgn(game))
}
