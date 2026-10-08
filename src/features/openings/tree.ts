import { applyMove, createGame, lookupOpening } from '@/chess'
import {
  domainError,
  err,
  now as clockNow,
  ok,
  positionKeyFromFen,
  START_FEN,
  toRepertoireNodeId,
  type Color,
  type DomainError,
  type RepertoireNode,
  type RepertoireNodeId,
  type Result,
  type Timestamp,
} from '@/domain'

/**
 * Pure repertoire tree operations.
 *
 * Why a module of its own: the editor, the PGN import, the starter seed and the drill all
 * need "what is under this node" and "add a move here". Keeping every rule here, with no
 * React and no storage, means each of them is one unit test, and a repository write is
 * just the `TreeChange` an operation hands back.
 *
 * The tree is immutable: every operation returns a new tree plus the minimal set of rows
 * to write and delete, so the caller persists a diff rather than the whole repertoire.
 */

export interface RepertoireTree {
  readonly color: Color
  readonly rootId: RepertoireNodeId
  readonly nodes: ReadonlyMap<RepertoireNodeId, RepertoireNode>
}

/** What a persistence layer must do to make storage match the new tree. */
export interface TreeChange {
  readonly put: readonly RepertoireNode[]
  readonly removed: readonly RepertoireNodeId[]
}

export interface TreeEdit<T> {
  readonly tree: RepertoireTree
  readonly change: TreeChange
  readonly value: T
}

/** Injected so tests get stable ids and times. */
export interface EditContext {
  readonly newId: () => RepertoireNodeId
  readonly now: () => Timestamp
}

export interface AddMoveOptions {
  readonly comment?: string
  readonly tags?: readonly string[]
  readonly openingName?: string
  readonly variation?: string
  readonly popularity?: number
}

/** `null` clears a field; `undefined` leaves it alone. */
export interface NodePatch {
  readonly comment?: string | null
  readonly tags?: readonly string[]
  readonly openingName?: string | null
  readonly variation?: string | null
  readonly popularity?: number | null
}

export interface TranspositionGroup {
  readonly positionKey: string
  readonly nodeIds: readonly RepertoireNodeId[]
}

export interface TreeStats {
  readonly nodes: number
  readonly yourMoves: number
  readonly lines: number
}

let idCounter = 0

/** Why a counter plus time: ids only need to be unique inside one browser's database. */
function defaultNewId(): RepertoireNodeId {
  idCounter += 1
  const bytes = new Uint8Array(8)
  globalThis.crypto.getRandomValues(bytes)
  const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return toRepertoireNodeId(`node_${random}${idCounter.toString(36)}`)
}

export const DEFAULT_CONTEXT: EditContext = { newId: defaultNewId, now: clockNow }

function failure(message: string, where: string): DomainError {
  return domainError('validation', message, { where })
}

/** Why: the board's colour and the ply decide whose move a node is, nothing stored. */
export function isYourPly(color: Color, ply: number): boolean {
  return (ply % 2 === 1) === (color === 'white')
}

/** An empty tree is just a root at the start position. */
export function createTree(color: Color, ctx: EditContext = DEFAULT_CONTEXT): TreeEdit<null> {
  const at = ctx.now()
  const root: RepertoireNode = {
    id: ctx.newId(),
    parentId: null,
    childIds: [],
    color,
    fen: START_FEN,
    positionKey: positionKeyFromFen(START_FEN),
    san: null,
    uci: null,
    ply: 0,
    isYourMove: false,
    isMainLine: true,
    tags: [],
    createdAt: at,
    updatedAt: at,
  }
  return {
    tree: { color, rootId: root.id, nodes: new Map([[root.id, root]]) },
    change: { put: [root], removed: [] },
    value: null,
  }
}

/** `null` when the colour has no root yet, which is the empty state, not an error. */
export function buildTree(color: Color, rows: readonly RepertoireNode[]): RepertoireTree | null {
  const nodes = new Map<RepertoireNodeId, RepertoireNode>()
  let rootId: RepertoireNodeId | null = null
  for (const row of rows) {
    if (row.color !== color) continue
    nodes.set(row.id, row)
    if (row.parentId === null) rootId = row.id
  }
  return rootId === null ? null : { color, rootId, nodes }
}

export function getNode(tree: RepertoireTree, id: RepertoireNodeId): RepertoireNode | undefined {
  return tree.nodes.get(id)
}

export function rootOf(tree: RepertoireTree): RepertoireNode | undefined {
  return tree.nodes.get(tree.rootId)
}

/** Children in stored order, which puts the main line first. */
export function childrenOf(tree: RepertoireTree, id: RepertoireNodeId): RepertoireNode[] {
  const node = tree.nodes.get(id)
  if (node === undefined) return []
  const found: RepertoireNode[] = []
  for (const childId of node.childIds) {
    const child = tree.nodes.get(childId)
    if (child !== undefined) found.push(child)
  }
  return found
}

/** Root first, the node itself last. */
export function pathTo(tree: RepertoireTree, id: RepertoireNodeId): RepertoireNode[] {
  const path: RepertoireNode[] = []
  let cursor = tree.nodes.get(id)
  while (cursor !== undefined) {
    path.push(cursor)
    cursor = cursor.parentId === null ? undefined : tree.nodes.get(cursor.parentId)
  }
  return path.reverse()
}

/** The node and everything beneath it, parents before children. */
export function subtreeOf(tree: RepertoireTree, id: RepertoireNodeId): RepertoireNode[] {
  const collected: RepertoireNode[] = []
  const pending: RepertoireNodeId[] = [id]
  while (pending.length > 0) {
    const next = pending.pop()
    if (next === undefined) break
    const node = tree.nodes.get(next)
    if (node === undefined) continue
    collected.push(node)
    for (let index = node.childIds.length - 1; index >= 0; index -= 1) {
      const childId = node.childIds[index]
      if (childId !== undefined) pending.push(childId)
    }
  }
  return collected
}

/** Whose turn it is in the position this node reaches. */
export function sideToMoveAfter(node: RepertoireNode): Color {
  return node.fen.split(' ')[1] === 'b' ? 'black' : 'white'
}

/** True when the next move in this position is the opponent's. */
export function isOpponentToMove(tree: RepertoireTree, node: RepertoireNode): boolean {
  return sideToMoveAfter(node) !== tree.color
}

class Draft {
  readonly nodes: Map<RepertoireNodeId, RepertoireNode>
  private readonly touched = new Set<RepertoireNodeId>()
  private readonly removedIds = new Set<RepertoireNodeId>()

  constructor(
    private readonly source: RepertoireTree,
    private readonly ctx: EditContext,
  ) {
    this.nodes = new Map(source.nodes)
  }

  set(node: RepertoireNode): void {
    this.nodes.set(node.id, node)
    this.touched.add(node.id)
    this.removedIds.delete(node.id)
  }

  remove(id: RepertoireNodeId): void {
    this.nodes.delete(id)
    this.touched.delete(id)
    this.removedIds.add(id)
  }

  stamp(node: RepertoireNode): RepertoireNode {
    return { ...node, updatedAt: this.ctx.now() }
  }

  finish<T>(value: T): TreeEdit<T> {
    const put: RepertoireNode[] = []
    for (const id of this.touched) {
      const node = this.nodes.get(id)
      if (node !== undefined) put.push(node)
    }
    return {
      tree: { color: this.source.color, rootId: this.source.rootId, nodes: this.nodes },
      change: { put, removed: [...this.removedIds] },
      value,
    }
  }
}

function playChild(
  draft: Draft,
  parentId: RepertoireNodeId,
  move: string,
  options: AddMoveOptions,
  color: Color,
  ctx: EditContext,
): Result<RepertoireNode> {
  const parent = draft.nodes.get(parentId)
  if (parent === undefined) return err(failure('That position is not in the repertoire', 'addMove'))
  const started = createGame(parent.fen)
  if (!started.ok) return started
  const played = applyMove(started.value, move)
  if (!played.ok) return played
  const made = played.value.history.at(-1)
  if (made === undefined) return err(failure('The move was not recorded', 'addMove'))

  for (const siblingId of parent.childIds) {
    const sibling = draft.nodes.get(siblingId)
    if (sibling?.uci === made.uci) return ok(sibling)
  }

  const at = ctx.now()
  const ply = parent.ply + 1
  const book = lookupOpening(made.fenAfter)
  const eco = book?.eco
  const variation = options.variation ?? book?.variation
  const node: RepertoireNode = {
    id: ctx.newId(),
    parentId,
    childIds: [],
    color,
    fen: made.fenAfter,
    positionKey: positionKeyFromFen(made.fenAfter),
    san: made.san,
    uci: made.uci,
    ply,
    isYourMove: isYourPly(color, ply),
    isMainLine: parent.isMainLine && parent.childIds.length === 0,
    ...(eco === undefined ? {} : { eco }),
    ...(options.openingName === undefined ? {} : { openingName: options.openingName }),
    ...(variation === undefined ? {} : { variation }),
    ...(options.comment === undefined ? {} : { comment: options.comment }),
    ...(options.popularity === undefined ? {} : { popularity: options.popularity }),
    tags: [...(options.tags ?? [])],
    createdAt: at,
    updatedAt: at,
  }
  draft.set(node)
  draft.set({ ...parent, childIds: [...parent.childIds, node.id], updatedAt: at })
  return ok(node)
}

/**
 * Add a move under a node, or return the existing child if it is already there.
 *
 * Why idempotent: a PGN import and a double click both mean "make sure this move exists",
 * and a duplicate sibling would split the drill's attention between two identical lines.
 */
export function addMove(
  tree: RepertoireTree,
  parentId: RepertoireNodeId,
  move: string,
  options: AddMoveOptions = {},
  ctx: EditContext = DEFAULT_CONTEXT,
): Result<TreeEdit<RepertoireNode>> {
  const draft = new Draft(tree, ctx)
  const child = playChild(draft, parentId, move, options, tree.color, ctx)
  if (!child.ok) return child
  return ok(draft.finish(child.value))
}

/** Plays a whole line in one pass, so an import copies the tree once, not once per move. */
export function addLine(
  tree: RepertoireTree,
  parentId: RepertoireNodeId,
  moves: readonly string[],
  ctx: EditContext = DEFAULT_CONTEXT,
): Result<TreeEdit<RepertoireNode>> {
  const draft = new Draft(tree, ctx)
  let cursor = parentId
  let last: RepertoireNode | undefined
  for (const move of moves) {
    const child = playChild(draft, cursor, move, {}, tree.color, ctx)
    if (!child.ok) return child
    last = child.value
    cursor = child.value.id
  }
  const tail = last ?? draft.nodes.get(parentId)
  if (tail === undefined) return err(failure('That position is not in the repertoire', 'addLine'))
  return ok(draft.finish(tail))
}

/** Merges a branching PGN-style tree under a node, creating only what is missing. */
export interface LineBranch {
  readonly san: string
  readonly comment?: string | undefined
  readonly children: readonly LineBranch[]
}

export function addBranches(
  tree: RepertoireTree,
  parentId: RepertoireNodeId,
  branches: readonly LineBranch[],
  ctx: EditContext = DEFAULT_CONTEXT,
): Result<TreeEdit<number>> {
  const draft = new Draft(tree, ctx)
  let created = 0
  const pending: { parent: RepertoireNodeId; branch: LineBranch }[] = branches
    .map((branch) => ({ parent: parentId, branch }))
    .reverse()
  while (pending.length > 0) {
    const item = pending.pop()
    if (item === undefined) break
    const before = draft.nodes.size
    const child = playChild(
      draft,
      item.parent,
      item.branch.san,
      item.branch.comment === undefined ? {} : { comment: item.branch.comment },
      tree.color,
      ctx,
    )
    if (!child.ok) return child
    if (draft.nodes.size > before) created += 1
    for (let index = item.branch.children.length - 1; index >= 0; index -= 1) {
      const next = item.branch.children[index]
      if (next !== undefined) pending.push({ parent: child.value.id, branch: next })
    }
  }
  return ok(draft.finish(created))
}

/** Edits the author's notes and tags on a node without touching its move. */
export function annotate(
  tree: RepertoireTree,
  id: RepertoireNodeId,
  patch: NodePatch,
  ctx: EditContext = DEFAULT_CONTEXT,
): Result<TreeEdit<RepertoireNode>> {
  const node = tree.nodes.get(id)
  if (node === undefined) return err(failure('That position is not in the repertoire', 'annotate'))
  const { comment, openingName, variation, popularity, ...rest } = node
  const nextComment = resolve(patch.comment, comment)
  const nextName = resolve(patch.openingName, openingName)
  const nextVariation = resolve(patch.variation, variation)
  const nextPopularity = resolve(patch.popularity, popularity)
  const next: RepertoireNode = {
    ...rest,
    tags: patch.tags === undefined ? node.tags : [...patch.tags],
    ...(nextComment === undefined ? {} : { comment: nextComment }),
    ...(nextName === undefined ? {} : { openingName: nextName }),
    ...(nextVariation === undefined ? {} : { variation: nextVariation }),
    ...(nextPopularity === undefined ? {} : { popularity: nextPopularity }),
    updatedAt: ctx.now(),
  }
  const draft = new Draft(tree, ctx)
  draft.set(next)
  return ok(draft.finish(next))
}

/** Why: `null` means clear, `undefined` means keep, and an absent key must stay absent. */
function resolve<V>(patch: V | null | undefined, current: V | undefined): V | undefined {
  if (patch === undefined) return current
  return patch ?? undefined
}

/**
 * Makes a node, and every ancestor, the main line at its branch.
 *
 * Why the first child moves to the front: the drill and the tree view both read child
 * order as priority, so "main line" and "first" are kept as one fact in two places.
 */
export function setMainLine(
  tree: RepertoireTree,
  id: RepertoireNodeId,
  ctx: EditContext = DEFAULT_CONTEXT,
): Result<TreeEdit<null>> {
  if (!tree.nodes.has(id)) return err(failure('That position is not in the repertoire', 'mainLine'))
  const draft = new Draft(tree, ctx)
  const path = pathTo(tree, id)
  for (const [index, node] of path.entries()) {
    const parent = index === 0 ? undefined : path[index - 1]
    if (parent === undefined) continue
    const current = draft.nodes.get(parent.id)
    if (current === undefined) continue
    const reordered = [node.id, ...current.childIds.filter((childId) => childId !== node.id)]
    draft.set(draft.stamp({ ...current, childIds: reordered }))
    for (const siblingId of current.childIds) {
      const sibling = draft.nodes.get(siblingId)
      if (sibling === undefined) continue
      const flag = sibling.id === node.id
      if (sibling.isMainLine !== flag) draft.set(draft.stamp({ ...sibling, isMainLine: flag }))
    }
  }
  return ok(draft.finish(null))
}

/**
 * Deletes a node and everything under it.
 *
 * The root cannot go: it is the repertoire's anchor, and "start over" is a different
 * action. If the deleted branch was the main line, the next sibling takes over.
 */
export function deleteSubtree(
  tree: RepertoireTree,
  id: RepertoireNodeId,
  ctx: EditContext = DEFAULT_CONTEXT,
): Result<TreeEdit<readonly RepertoireNode[]>> {
  const node = tree.nodes.get(id)
  if (node === undefined) return err(failure('That position is not in the repertoire', 'delete'))
  if (node.parentId === null)
    return err(failure('The starting position cannot be deleted', 'delete'))
  const doomed = subtreeOf(tree, id)
  const draft = new Draft(tree, ctx)
  for (const gone of doomed) draft.remove(gone.id)
  const parent = draft.nodes.get(node.parentId)
  if (parent !== undefined) {
    const childIds = parent.childIds.filter((childId) => childId !== id)
    draft.set(draft.stamp({ ...parent, childIds }))
    if (node.isMainLine) {
      const heir = childIds[0] === undefined ? undefined : draft.nodes.get(childIds[0])
      if (heir !== undefined) draft.set(draft.stamp({ ...heir, isMainLine: true }))
    }
  }
  return ok(draft.finish(doomed))
}

/** Positions reached by more than one move order, ignoring the root. */
export function findTranspositions(tree: RepertoireTree): TranspositionGroup[] {
  const byKey = new Map<string, RepertoireNodeId[]>()
  for (const node of tree.nodes.values()) {
    if (node.parentId === null) continue
    const ids = byKey.get(node.positionKey)
    if (ids === undefined) byKey.set(node.positionKey, [node.id])
    else ids.push(node.id)
  }
  const groups: TranspositionGroup[] = []
  for (const [positionKey, nodeIds] of byKey) {
    if (nodeIds.length > 1) groups.push({ positionKey, nodeIds })
  }
  return groups
}

/** The other nodes that reach the same position as this one. */
export function transpositionsOf(tree: RepertoireTree, id: RepertoireNodeId): RepertoireNode[] {
  const node = tree.nodes.get(id)
  if (node === undefined) return []
  if (node.parentId === null) return []
  const matches: RepertoireNode[] = []
  for (const other of tree.nodes.values()) {
    if (other.id === id || other.parentId === null) continue
    if (other.positionKey === node.positionKey) matches.push(other)
  }
  return matches
}

/**
 * The lines a user drills: paths that end on one of their own moves.
 *
 * Why only your moves: a path ending on an opponent move has no prepared answer, which
 * is a gap to fix, not a line to remember.
 */
export function lineEnds(
  tree: RepertoireTree,
  from: RepertoireNodeId = tree.rootId,
): RepertoireNode[] {
  const ends: RepertoireNode[] = []
  for (const node of subtreeOf(tree, from)) {
    if (node.parentId !== null && node.isYourMove && node.childIds.length === 0) ends.push(node)
  }
  return ends
}

/** The nearest named opening at or above a node; the root when none is named. */
export function headOf(tree: RepertoireTree, id: RepertoireNodeId): RepertoireNode | undefined {
  const path = pathTo(tree, id)
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const node = path[index]
    if (node?.openingName !== undefined) return node
  }
  return rootOf(tree)
}

/** Every node that names an opening, in tree order. */
export function openingHeads(tree: RepertoireTree): RepertoireNode[] {
  return subtreeOf(tree, tree.rootId).filter(
    (node) => node.parentId !== null && node.openingName !== undefined,
  )
}

/** Named openings not nested inside another named opening: one card each on the screen. */
export function outerHeads(tree: RepertoireTree): RepertoireNode[] {
  const heads: RepertoireNode[] = []
  const pending: RepertoireNodeId[] = [tree.rootId]
  while (pending.length > 0) {
    const id = pending.pop()
    const node = id === undefined ? undefined : tree.nodes.get(id)
    if (node === undefined) continue
    if (node.parentId !== null && node.openingName !== undefined) {
      heads.push(node)
      continue
    }
    for (let index = node.childIds.length - 1; index >= 0; index -= 1) {
      const childId = node.childIds[index]
      if (childId !== undefined) pending.push(childId)
    }
  }
  return heads
}

export function treeStats(tree: RepertoireTree, from: RepertoireNodeId = tree.rootId): TreeStats {
  let nodes = 0
  let yourMoves = 0
  let lines = 0
  for (const node of subtreeOf(tree, from)) {
    if (node.parentId === null) continue
    nodes += 1
    if (node.isYourMove) yourMoves += 1
    if (node.isYourMove && node.childIds.length === 0) lines += 1
  }
  return { nodes, yourMoves, lines }
}

/** `3.e5 Bf5 4.Nf3`, numbering from the first move shown, in the style a coach writes. */
export function formatLine(nodes: readonly RepertoireNode[]): string {
  const parts: string[] = []
  for (const [index, node] of nodes.entries()) {
    if (node.san === null) continue
    const number = Math.ceil(node.ply / 2)
    const isWhite = node.ply % 2 === 1
    if (isWhite) parts.push(`${String(number)}.${node.san}`)
    else if (index === 0 || parts.length === 0) parts.push(`${String(number)}…${node.san}`)
    else parts.push(node.san)
  }
  return parts.join(' ')
}

/** The moves from the root to a node, as text. */
export function lineTo(tree: RepertoireTree, id: RepertoireNodeId): string {
  return formatLine(pathTo(tree, id))
}

/** Folds several edits' changes into one write: the last version of each row wins. */
export function combineChanges(changes: readonly TreeChange[]): TreeChange {
  const put = new Map<RepertoireNodeId, RepertoireNode>()
  const removed = new Set<RepertoireNodeId>()
  for (const change of changes) {
    for (const node of change.put) {
      put.set(node.id, node)
      removed.delete(node.id)
    }
    for (const id of change.removed) {
      put.delete(id)
      removed.add(id)
    }
  }
  return { put: [...put.values()], removed: [...removed] }
}

/** Walks a SAN path from the root; `undefined` if the repertoire does not contain it. */
export function findBySanPath(
  tree: RepertoireTree,
  sans: readonly string[],
): RepertoireNode | undefined {
  let cursor = tree.nodes.get(tree.rootId)
  for (const san of sans) {
    if (cursor === undefined) return undefined
    cursor = childrenOf(tree, cursor.id).find((child) => child.san === san)
  }
  return cursor
}
