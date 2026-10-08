import { newSrsCardId } from '@/data'
import type { RepertoireRepository, SrsCardsRepository } from '@/data'
import {
  domainError,
  err,
  now as clockNow,
  ok,
  type Color,
  type RepertoireNode,
  type RepertoireNodeId,
  type Result,
  type SrsCard,
  type Timestamp,
} from '@/domain'

import { gradeRun, reviewedNode, type DrillRun } from './drill'
import { materializeSpec, OPENING_SPECS, STARTER_IDS, type OpeningSpec } from './library'
import { createLinesPort, type LinesPort } from './pgn-lines-port'
import { OPENING_DAILY_CAPS, type Scheduler } from './scheduler'
import {
  addBranches,
  addMove,
  annotate,
  buildTree,
  createTree,
  deleteSubtree,
  lineEnds,
  setMainLine,
  DEFAULT_CONTEXT,
  type AddMoveOptions,
  type EditContext,
  type NodePatch,
  type RepertoireTree,
  type TreeEdit,
} from './tree'

/**
 * Repertoire edits that reach storage.
 *
 * Every function is "pure tree operation, then write the diff, then reconcile the SRS
 * cards", and returns a `Result` carrying the new tree so the caller never re-reads.
 * Repositories are injected so tests run on a scratch database.
 */
export interface OpeningsDeps {
  readonly repertoire: RepertoireRepository
  readonly srsCards: SrsCardsRepository
  readonly ctx?: EditContext
  readonly now?: () => Timestamp
}

function contextOf(deps: OpeningsDeps): EditContext {
  return deps.ctx ?? DEFAULT_CONTEXT
}

export async function loadTree(deps: OpeningsDeps, color: Color): Promise<RepertoireTree | null> {
  return buildTree(color, await deps.repertoire.listByColor(color))
}

/** The empty-state check: nothing at all, not even a root, in either colour. */
export async function isRepertoireEmpty(deps: OpeningsDeps): Promise<boolean> {
  const [white, black] = await Promise.all([loadTree(deps, 'white'), loadTree(deps, 'black')])
  return [white, black].every((tree) => tree === null || tree.nodes.size <= 1)
}

/** A colour's tree, created (and its root stored) the first time something is added. */
export async function ensureTree(
  deps: OpeningsDeps,
  color: Color,
): Promise<Result<RepertoireTree>> {
  const existing = await loadTree(deps, color)
  if (existing !== null) return ok(existing)
  const created = createTree(color, contextOf(deps))
  const written = await deps.repertoire.applyChange(created.change.put, [])
  return written.ok ? ok(created.tree) : written
}

/**
 * Gives every line a card and takes cards from nodes that stopped being lines.
 *
 * Why this runs after every edit: the lines are the leaves, and an edit moves them. A
 * card that stayed on a node that now has children would review a position that is no
 * longer the end of anything.
 */
export async function syncLineCards(
  deps: OpeningsDeps,
  tree: RepertoireTree,
  verify = false,
): Promise<Result<TreeEdit<null>>> {
  const at = (deps.now ?? clockNow)()
  const changes: RepertoireNode[] = []
  const staleCards: SrsCard['id'][] = []
  const cards: SrsCard[] = []
  const ends = new Set(lineEnds(tree).map((node) => node.id))

  for (const node of tree.nodes.values()) {
    if (ends.has(node.id)) {
      let needsCard = node.srsCardId === undefined
      if (verify && node.srsCardId !== undefined) {
        needsCard = (await deps.srsCards.get(node.srsCardId)) === undefined
      }
      if (!needsCard) continue
      const id = newSrsCardId()
      cards.push(newLineCard(id, node.id, at))
      const { srsCardId: _previous, ...rest } = node
      changes.push({ ...rest, srsCardId: id, updatedAt: at })
    } else if (node.srsCardId !== undefined) {
      staleCards.push(node.srsCardId)
      const { srsCardId: _previous, ...rest } = node
      changes.push({ ...rest, updatedAt: at })
    }
  }

  if (changes.length === 0) return ok({ tree, change: { put: [], removed: [] }, value: null })
  if (cards.length > 0) {
    const stored = await deps.srsCards.putMany(cards)
    if (!stored.ok) return stored
  }
  for (const id of staleCards) await deps.srsCards.remove(id)
  const written = await deps.repertoire.applyChange(changes, [])
  if (!written.ok) return written
  const nodes = new Map(tree.nodes)
  for (const node of changes) nodes.set(node.id, node)
  return ok({
    tree: { ...tree, nodes },
    change: { put: changes, removed: [] },
    value: null,
  })
}

function newLineCard(id: SrsCard['id'], nodeId: RepertoireNodeId, at: Timestamp): SrsCard {
  return {
    id,
    subject: { kind: 'opening', nodeId },
    state: 'new',
    due: at,
    lastReviewedAt: null,
    stability: 0,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    learningStep: null,
    consecutiveCorrect: 0,
    masteredAt: null,
    createdAt: at,
    updatedAt: at,
  }
}

/** Stores an edit, then reconciles the cards with the lines the new tree has. */
export async function commit<T>(
  deps: OpeningsDeps,
  edit: TreeEdit<T>,
): Promise<Result<{ readonly tree: RepertoireTree; readonly value: T }>> {
  const written = await deps.repertoire.applyChange(edit.change.put, edit.change.removed)
  if (!written.ok) return written
  const synced = await syncLineCards(deps, edit.tree)
  if (!synced.ok) return synced
  return ok({ tree: synced.value.tree, value: edit.value })
}

export async function addMoveAndSave(
  deps: OpeningsDeps,
  tree: RepertoireTree,
  parentId: RepertoireNodeId,
  move: string,
  options: AddMoveOptions = {},
) {
  const edit = addMove(tree, parentId, move, options, contextOf(deps))
  return edit.ok ? commit(deps, edit.value) : edit
}

export async function annotateAndSave(
  deps: OpeningsDeps,
  tree: RepertoireTree,
  id: RepertoireNodeId,
  patch: NodePatch,
) {
  const edit = annotate(tree, id, patch, contextOf(deps))
  return edit.ok ? commit(deps, edit.value) : edit
}

export async function setMainLineAndSave(
  deps: OpeningsDeps,
  tree: RepertoireTree,
  id: RepertoireNodeId,
) {
  const edit = setMainLine(tree, id, contextOf(deps))
  return edit.ok ? commit(deps, edit.value) : edit
}

/** Deleting a branch deletes its lines' cards too; a card for a line that is gone is noise. */
export async function deleteAndSave(
  deps: OpeningsDeps,
  tree: RepertoireTree,
  id: RepertoireNodeId,
) {
  const edit = deleteSubtree(tree, id, contextOf(deps))
  if (!edit.ok) return edit
  const cardIds = edit.value.value.flatMap((node) =>
    node.srsCardId === undefined ? [] : [node.srsCardId],
  )
  const committed = await commit(deps, edit.value)
  if (!committed.ok) return committed
  for (const cardId of cardIds) await deps.srsCards.remove(cardId)
  return ok({ tree: committed.value.tree, value: edit.value.value.length })
}

/** Writes a spec's lines into the colour's tree. Used for the starter set and the catalogue. */
export async function addOpening(deps: OpeningsDeps, spec: OpeningSpec) {
  const ensured = await ensureTree(deps, spec.color)
  if (!ensured.ok) return ensured
  const edit = materializeSpec(ensured.value, spec, contextOf(deps))
  return edit.ok ? commit(deps, edit.value) : edit
}

/** Seeds the small default repertoire. Only ever called because the user said yes. */
export async function seedStarter(
  deps: OpeningsDeps,
  ids: readonly string[] = STARTER_IDS,
): Promise<Result<number>> {
  let added = 0
  for (const spec of OPENING_SPECS.filter((entry) => ids.includes(entry.id))) {
    const result = await addOpening(deps, spec)
    if (!result.ok) return result
    added += 1
  }
  return ok(added)
}

export interface ImportReport {
  readonly games: number
  readonly skipped: number
  readonly created: number
}

/** PGN to repertoire: parse (in a worker when large), merge with what exists, store the diff. */
export async function importPgnLines(
  deps: OpeningsDeps,
  color: Color,
  text: string,
  port: LinesPort = createLinesPort(),
): Promise<Result<ImportReport>> {
  const parsed = await port.parse(text)
  if (!parsed.ok) return parsed
  const ensured = await ensureTree(deps, color)
  if (!ensured.ok) return ensured
  const edit = addBranches(
    ensured.value,
    ensured.value.rootId,
    parsed.value.branches,
    contextOf(deps),
  )
  if (!edit.ok) {
    return err(
      domainError(
        'validation',
        `${edit.error.message}. Check that these lines match the colour you picked.`,
        { where: 'PGN', cause: edit.error },
      ),
    )
  }
  const committed = await commit(deps, edit.value)
  if (!committed.ok) return committed
  return ok({
    games: parsed.value.games,
    skipped: parsed.value.skipped,
    created: edit.value.value,
  })
}

export interface DrillOutcome {
  readonly card: SrsCard
  readonly grade: 'again' | 'hard' | 'good' | 'easy'
}

/** Feeds a finished run to the scheduler and stores the card it returns. */
export async function recordRun(
  deps: OpeningsDeps,
  scheduler: Scheduler,
  run: DrillRun,
  at: Date = new Date(),
): Promise<Result<DrillOutcome | null>> {
  const grade = gradeRun(run)
  const node = reviewedNode(run)
  if (grade === null || node?.srsCardId === undefined) return ok(null)
  const card = await deps.srsCards.get(node.srsCardId)
  if (card === undefined) {
    return err(domainError('not-found', 'This line has no card to review', { where: 'drill' }))
  }
  const reviewed = scheduler.reviewCard(card, grade, at)
  const stored = await deps.srsCards.put(reviewed)
  return stored.ok ? ok({ card: stored.value, grade }) : stored
}

export interface LineSummary {
  readonly node: RepertoireNode
  readonly card: SrsCard | undefined
}

/** Every line of a tree with its card, for lists and mastery bars. */
export async function loadLines(
  deps: OpeningsDeps,
  tree: RepertoireTree,
): Promise<readonly LineSummary[]> {
  const ends = lineEnds(tree)
  const cards = await Promise.all(
    ends.map((node) =>
      node.srsCardId === undefined ? Promise.resolve(undefined) : deps.srsCards.get(node.srsCardId),
    ),
  )
  return ends.map((node, index) => ({ node, card: cards[index] }))
}

/** The scheduler's queue for the openings: due cards, capped, in its order. */
export function dueLines(
  lines: readonly LineSummary[],
  scheduler: Scheduler,
  at: Date,
): LineSummary[] {
  const cards = lines.flatMap((line) => (line.card === undefined ? [] : [line.card]))
  const queue = scheduler.buildDueQueue(cards, at, OPENING_DAILY_CAPS)
  const byCard = new Map(
    lines.flatMap((line) => (line.card === undefined ? [] : [[line.card.id, line] as const])),
  )
  return queue.flatMap((card) => {
    const line = byCard.get(card.id)
    return line === undefined ? [] : [line]
  })
}
