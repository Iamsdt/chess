import { z } from 'zod'

import {
  applyMove,
  createGame,
  normalizeFen,
  parseFen,
  playMoves,
  type ChessGame,
  type MoveInput,
} from '@/chess'
import {
  domainError,
  err,
  FenSchema,
  ok,
  SanSchema,
  START_FEN,
  UciSchema,
  type Fen,
  type Result,
  type San,
  type Uci,
} from '@/domain'

/**
 * S19 · the variation tree, as pure data.
 *
 * Why a flat id map rather than nested objects: the tree is edited from the board
 * (a new move), from the move list (promote, delete) and from an import, and every
 * one of those has to survive a reload. A flat map serialises to JSON without a
 * custom walker, and an edit copies one node plus its parent instead of the spine.
 *
 * Two invariants the rest of the feature relies on:
 *
 * - **A node's `children` are ordered, main line first.** "Promote" is a reordering
 *   of that list and nothing else, which is why it cannot lose a sub-variation.
 * - **Siblings never repeat a move.** Playing a move that already exists navigates
 *   to it instead of adding a twin, so the tree matches what the player believes
 *   they have explored.
 *
 * Nothing here imports React, and nothing here talks to storage.
 */

export type VariationNodeId = string

export interface VariationNode {
  readonly id: VariationNodeId
  /** `null` for a move played from the root position. */
  readonly parentId: VariationNodeId | null
  readonly san: San
  readonly uci: Uci
  /** The position *after* this move, so navigating never replays the line to draw it. */
  readonly fen: Fen
  /** Continuations, main line first. */
  readonly children: readonly VariationNodeId[]
}

const NodeIdSchema = z.string().min(1)

export const VariationNodeSchema: z.ZodType<VariationNode> = z.object({
  id: NodeIdSchema,
  parentId: NodeIdSchema.nullable(),
  san: SanSchema,
  uci: UciSchema,
  fen: FenSchema,
  children: z.array(NodeIdSchema),
})

export interface VariationTree {
  readonly rootFen: Fen
  readonly rootChildren: readonly VariationNodeId[]
  readonly nodes: Readonly<Record<VariationNodeId, VariationNode>>
  /** `null` means the root position is on the board. */
  readonly currentId: VariationNodeId | null
  /** The next id to mint. Kept in the tree so ids stay stable across a reload. */
  readonly nextId: number
}

export const VariationTreeSchema: z.ZodType<VariationTree> = z.object({
  rootFen: FenSchema,
  rootChildren: z.array(NodeIdSchema),
  nodes: z.record(NodeIdSchema, VariationNodeSchema),
  currentId: NodeIdSchema.nullable(),
  nextId: z.number().int().min(1),
})

/**
 * An empty tree rooted at `fen`.
 *
 * The FEN is normalised before it is checked, because a position pasted from
 * another program may spell its castling rights in any order and that is the same
 * position, not a bad one. It is then validated for legality, not just shape.
 */
export function createVariationTree(fen: string = START_FEN): Result<VariationTree> {
  const normalized = normalizeFen(fen)
  if (!normalized.ok) return normalized
  const game = createGame(normalized.value)
  if (!game.ok) return game
  return ok({
    rootFen: game.value.fen,
    rootChildren: [],
    nodes: {},
    currentId: null,
    nextId: 1,
  })
}

export function nodeOf(tree: VariationTree, id: VariationNodeId | null): VariationNode | null {
  if (id === null) return null
  return tree.nodes[id] ?? null
}

export function childrenOf(
  tree: VariationTree,
  parentId: VariationNodeId | null,
): readonly VariationNodeId[] {
  if (parentId === null) return tree.rootChildren
  return tree.nodes[parentId]?.children ?? []
}

export function fenAt(tree: VariationTree, id: VariationNodeId | null): Fen {
  return nodeOf(tree, id)?.fen ?? tree.rootFen
}

/**
 * Root-first list of the moves that lead to `id`.
 *
 * The visited set is not paranoia about our own writes: a tree restored from
 * storage is untrusted data, and a cycle there would otherwise hang the screen.
 */
export function pathTo(tree: VariationTree, id: VariationNodeId | null): readonly VariationNode[] {
  const path: VariationNode[] = []
  const seen = new Set<VariationNodeId>()
  let cursor = nodeOf(tree, id)
  while (cursor !== null && !seen.has(cursor.id)) {
    seen.add(cursor.id)
    path.push(cursor)
    cursor = nodeOf(tree, cursor.parentId)
  }
  path.reverse()
  return path
}

/** How many moves have been played to reach `id`. The root is ply 0. */
export function plyOf(tree: VariationTree, id: VariationNodeId | null): number {
  return pathTo(tree, id).length
}

/**
 * Replay the line to `id`.
 *
 * Why replay when every node already carries its FEN: legal moves, check and
 * repetition need a game with history, and a FEN alone has thrown that away.
 */
export function gameAt(tree: VariationTree, id: VariationNodeId | null): Result<ChessGame> {
  const start = createGame(tree.rootFen)
  if (!start.ok) return start
  return playMoves(
    start.value,
    pathTo(tree, id).map((node) => node.uci),
  )
}

export interface AddedMove {
  readonly tree: VariationTree
  readonly nodeId: VariationNodeId
}

function withChildren(
  tree: VariationTree,
  parentId: VariationNodeId | null,
  children: readonly VariationNodeId[],
): VariationTree {
  if (parentId === null) return { ...tree, rootChildren: children }
  const parent = tree.nodes[parentId]
  if (parent === undefined) return tree
  return { ...tree, nodes: { ...tree.nodes, [parentId]: { ...parent, children } } }
}

/**
 * Play `move` from `parentId`, adding a branch when it is new.
 *
 * The move is checked by replaying the line, so an illegal move is an error value
 * rather than a node the board can never draw.
 */
export function addMove(
  tree: VariationTree,
  parentId: VariationNodeId | null,
  move: MoveInput,
): Result<AddedMove> {
  const game = gameAt(tree, parentId)
  if (!game.ok) return game
  const played = applyMove(game.value, move)
  if (!played.ok) return played
  const last = played.value.history.at(-1)
  if (last === undefined) {
    return err(
      domainError('validation', 'That move left the position unchanged', {
        where: 'variation tree',
      }),
    )
  }

  const siblings = childrenOf(tree, parentId)
  const existing = siblings.find((id) => tree.nodes[id]?.uci === last.uci)
  if (existing !== undefined) {
    return ok({ tree: { ...tree, currentId: existing }, nodeId: existing })
  }

  const id = `n${String(tree.nextId)}`
  const node: VariationNode = {
    id,
    parentId,
    san: last.san,
    uci: last.uci,
    fen: last.fenAfter,
    children: [],
  }
  const grown: VariationTree = {
    ...tree,
    nodes: { ...tree.nodes, [id]: node },
    currentId: id,
    nextId: tree.nextId + 1,
  }
  return ok({
    tree: withChildren(grown, parentId, [...siblings, id]),
    nodeId: id,
  })
}

export interface AddedLine {
  readonly tree: VariationTree
  /** `null` only when the line was empty, leaving the cursor where it started. */
  readonly nodeId: VariationNodeId | null
}

/** Add a whole line — a pasted PV, a PGN variation — one move at a time. */
export function addLine(
  tree: VariationTree,
  parentId: VariationNodeId | null,
  moves: readonly MoveInput[],
): Result<AddedLine> {
  let current = tree
  let cursor = parentId
  for (const move of moves) {
    const added = addMove(current, cursor, move)
    if (!added.ok) return added
    current = added.value.tree
    cursor = added.value.nodeId
  }
  return ok({ tree: { ...current, currentId: cursor }, nodeId: cursor })
}

/** Remove a move and everything that hangs off it. The cursor falls back to its parent. */
export function deleteNode(tree: VariationTree, id: VariationNodeId): VariationTree {
  const node = tree.nodes[id]
  if (node === undefined) return tree

  const doomed = new Set<VariationNodeId>([id])
  const stack: VariationNodeId[] = [...node.children]
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    if (doomed.has(next)) continue
    doomed.add(next)
    stack.push(...(tree.nodes[next]?.children ?? []))
  }

  const nodes: Record<VariationNodeId, VariationNode> = {}
  for (const [key, value] of Object.entries(tree.nodes)) {
    if (doomed.has(key)) continue
    nodes[key] = { ...value, children: value.children.filter((child) => !doomed.has(child)) }
  }

  const currentId =
    tree.currentId !== null && doomed.has(tree.currentId) ? node.parentId : tree.currentId
  return {
    ...tree,
    nodes,
    rootChildren: tree.rootChildren.filter((child) => !doomed.has(child)),
    currentId,
  }
}

function reorderSibling(
  tree: VariationTree,
  id: VariationNodeId,
  target: (index: number, count: number) => number,
): VariationTree {
  const node = tree.nodes[id]
  if (node === undefined) return tree
  const siblings = [...childrenOf(tree, node.parentId)]
  const index = siblings.indexOf(id)
  if (index < 0) return tree
  const to = Math.min(Math.max(target(index, siblings.length), 0), siblings.length - 1)
  if (to === index) return tree
  siblings.splice(index, 1)
  siblings.splice(to, 0, id)
  return withChildren(tree, node.parentId, siblings)
}

/** Move a variation one place towards the main line — the usual "promote". */
export function promoteVariation(tree: VariationTree, id: VariationNodeId): VariationTree {
  return reorderSibling(tree, id, (index) => index - 1)
}

/** Make the line through `id` the main line all the way back to the root. */
export function promoteToMainLine(tree: VariationTree, id: VariationNodeId): VariationTree {
  let current = tree
  let cursor: VariationNodeId | null = id
  const seen = new Set<VariationNodeId>()
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor)
    const node: VariationNodeId = cursor
    current = reorderSibling(current, node, () => 0)
    cursor = current.nodes[node]?.parentId ?? null
  }
  return current
}

/** Whether every move on the way to `id` is its parent's first choice. */
export function isMainLine(tree: VariationTree, id: VariationNodeId | null): boolean {
  return pathTo(tree, id).every((node) => childrenOf(tree, node.parentId)[0] === node.id)
}

/** The main line from the root, following the first child at every step. */
export function mainLineIds(tree: VariationTree): readonly VariationNodeId[] {
  const ids: VariationNodeId[] = []
  const seen = new Set<VariationNodeId>()
  let cursor = tree.rootChildren[0] ?? null
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor)
    ids.push(cursor)
    cursor = tree.nodes[cursor]?.children[0] ?? null
  }
  return ids
}

export function nextNodeId(
  tree: VariationTree,
  id: VariationNodeId | null = tree.currentId,
): VariationNodeId | null {
  return childrenOf(tree, id)[0] ?? null
}

export function previousNodeId(
  tree: VariationTree,
  id: VariationNodeId | null = tree.currentId,
): VariationNodeId | null {
  return nodeOf(tree, id)?.parentId ?? null
}

/** The end of the line the cursor is currently on. */
export function lastNodeId(
  tree: VariationTree,
  id: VariationNodeId | null = tree.currentId,
): VariationNodeId | null {
  let cursor = id
  const seen = new Set<VariationNodeId>()
  for (let next = nextNodeId(tree, cursor); next !== null; next = nextNodeId(tree, cursor)) {
    if (seen.has(next)) break
    seen.add(next)
    cursor = next
  }
  return cursor
}

/** Move the cursor. An id that is no longer in the tree leaves it where it was. */
export function goTo(tree: VariationTree, id: VariationNodeId | null): VariationTree {
  if (id !== null && tree.nodes[id] === undefined) return tree
  return { ...tree, currentId: id }
}

/** Where the move numbers start, which a position set up mid-game decides. */
export interface LineStart {
  readonly fullmoveNumber: number
  readonly whiteToMove: boolean
}

export interface MoveNumbering {
  readonly moveNumber: number
  readonly white: boolean
}

/**
 * Where numbering starts for a line played from `fen`.
 *
 * The move list and an engine's principal variation need different answers to
 * this: the list numbers from the root of the tree, while a PV numbers from the
 * position the engine was actually given.
 */
export function lineStartOfFen(fen: Fen): LineStart {
  const fields = parseFen(fen)
  if (!fields.ok) return { fullmoveNumber: 1, whiteToMove: true }
  return {
    fullmoveNumber: fields.value.fullmoveNumber,
    whiteToMove: fields.value.sideToMove === 'white',
  }
}

export function lineStartOf(tree: VariationTree): LineStart {
  return lineStartOfFen(tree.rootFen)
}

/** Why: `7...a5` and `8.h3` both come from one ply index and the root's counters. */
export function numberingFor(ply: number, start: LineStart): MoveNumbering {
  const white = start.whiteToMove ? ply % 2 === 1 : ply % 2 === 0
  const offset = start.whiteToMove ? Math.floor((ply - 1) / 2) : Math.floor(ply / 2)
  return { moveNumber: start.fullmoveNumber + offset, white }
}
