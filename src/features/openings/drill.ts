import type { RepertoireNode, RepertoireNodeId, SrsCard } from '@/domain'

import { childrenOf, headOf, isOpponentToMove, pathTo, type RepertoireTree } from './tree'

import type { MoveDistribution } from './popularity'

/**
 * The drill, as a state machine with no React in it.
 *
 * A run starts at the opening's head position, plays the opponent's side by popularity,
 * and asks the user for their prepared move each time it is their turn. Because the
 * opponent chooses, two runs of the same line can differ; the card that is reviewed is
 * the line the run actually ended on.
 */

export type DrillGrade = 'again' | 'hard' | 'good' | 'easy'

export type RunStatus = 'your-move' | 'complete' | 'out-of-book'

export interface TrailStep {
  readonly nodeId: RepertoireNodeId
  readonly san: string
  readonly by: 'you' | 'opponent'
}

export interface DrillRun {
  readonly tree: RepertoireTree
  readonly targetId: RepertoireNodeId
  readonly headId: RepertoireNodeId
  readonly currentId: RepertoireNodeId
  readonly status: RunStatus
  readonly trail: readonly TrailStep[]
  readonly misses: number
  readonly hintsUsed: number
  readonly gaveUp: boolean
  /** Thinking time summed over the user's correct moves. */
  readonly thinkMs: number
  readonly yourMovesPlayed: number
}

export type MoveVerdict =
  | { readonly kind: 'correct'; readonly node: RepertoireNode }
  | { readonly kind: 'wrong'; readonly expected: readonly RepertoireNode[] }

/** A function from 0..1, injected so tests can pick the opponent's reply. */
export type Random = () => number

/** Opponent replies on the way to the due line are this many times as likely. */
export const STEER_FACTOR = 3

/** A clean run under this average per move is "easy". */
export const EASY_AVERAGE_MS = 4000

const FALLBACK_WEIGHT = 1

function weightOf(
  child: RepertoireNode,
  parent: RepertoireNode,
  distribution: MoveDistribution,
): number {
  if (child.popularity !== undefined) return Math.max(child.popularity, FALLBACK_WEIGHT)
  const estimate = distribution(parent.fen).find((move) => move.uci === child.uci)
  return Math.max(estimate?.popularity ?? 0, FALLBACK_WEIGHT)
}

/**
 * The opponent's reply: weighted by how often it is played, nudged toward the due line.
 *
 * Why steer instead of force: a drill that always walked the due line would never meet
 * the other replies, so the opponent keeps its real habits and the due line is just
 * more likely.
 */
export function chooseOpponentReply(
  parent: RepertoireNode,
  children: readonly RepertoireNode[],
  distribution: MoveDistribution,
  random: Random,
  steer: ReadonlySet<RepertoireNodeId> = new Set(),
): RepertoireNode | undefined {
  if (children.length === 0) return undefined
  const weights = children.map(
    (child) => weightOf(child, parent, distribution) * (steer.has(child.id) ? STEER_FACTOR : 1),
  )
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let cursor = random() * total
  for (const [index, child] of children.entries()) {
    cursor -= weights[index] ?? 0
    if (cursor < 0) return child
  }
  return children.at(-1)
}

function steerSet(tree: RepertoireTree, targetId: RepertoireNodeId): Set<RepertoireNodeId> {
  return new Set(pathTo(tree, targetId).map((node) => node.id))
}

/** Plays the opponent's turns until it is the user's move or the line ends. */
function advance(run: DrillRun, distribution: MoveDistribution, random: Random): DrillRun {
  let current = run
  const steer = steerSet(run.tree, run.targetId)
  for (;;) {
    const node = current.tree.nodes.get(current.currentId)
    if (node === undefined) return { ...current, status: 'out-of-book' }
    const children = childrenOf(current.tree, node.id)
    if (children.length === 0) {
      return { ...current, status: node.isYourMove ? 'complete' : 'out-of-book' }
    }
    if (!isOpponentToMove(current.tree, node)) return { ...current, status: 'your-move' }
    const reply = chooseOpponentReply(node, children, distribution, random, steer)
    if (reply === undefined) return { ...current, status: 'out-of-book' }
    current = {
      ...current,
      currentId: reply.id,
      trail: [...current.trail, { nodeId: reply.id, san: reply.san ?? '', by: 'opponent' }],
    }
  }
}

/** Begins at the opening's head so the shared first moves are shown, not quizzed. */
export function startRun(
  tree: RepertoireTree,
  targetId: RepertoireNodeId,
  distribution: MoveDistribution,
  random: Random,
): DrillRun {
  const head = headOf(tree, targetId)
  const headId = head?.id ?? tree.rootId
  return advance(
    {
      tree,
      targetId,
      headId,
      currentId: headId,
      status: 'your-move',
      trail: [],
      misses: 0,
      hintsUsed: 0,
      gaveUp: false,
      thinkMs: 0,
      yourMovesPlayed: 0,
    },
    distribution,
    random,
  )
}

/** Any prepared child counts: a repertoire may deliberately hold two answers. */
export function judgeMove(run: DrillRun, uci: string): MoveVerdict {
  const children = childrenOf(run.tree, run.currentId)
  const match = children.find((child) => child.uci === uci)
  return match === undefined
    ? { kind: 'wrong', expected: children }
    : { kind: 'correct', node: match }
}

/** Applies the user's move; a wrong move costs a miss and leaves the position as it was. */
export function playMove(
  run: DrillRun,
  uci: string,
  elapsedMs: number,
  distribution: MoveDistribution,
  random: Random,
): { readonly run: DrillRun; readonly verdict: MoveVerdict } {
  if (run.status !== 'your-move') return { run, verdict: { kind: 'wrong', expected: [] } }
  const verdict = judgeMove(run, uci)
  if (verdict.kind === 'wrong') {
    return { run: { ...run, misses: run.misses + 1 }, verdict }
  }
  const moved: DrillRun = {
    ...run,
    currentId: verdict.node.id,
    trail: [...run.trail, { nodeId: verdict.node.id, san: verdict.node.san ?? '', by: 'you' }],
    thinkMs: run.thinkMs + Math.max(0, elapsedMs),
    yourMovesPlayed: run.yourMovesPlayed + 1,
  }
  return { run: advance(moved, distribution, random), verdict }
}

/** The move to point at; counts as a hint so a peek is not graded like recall. */
export function takeHint(run: DrillRun): {
  readonly run: DrillRun
  readonly hint: RepertoireNode | null
} {
  const hint = childrenOf(run.tree, run.currentId)[0] ?? null
  return { run: hint === null ? run : { ...run, hintsUsed: run.hintsUsed + 1 }, hint }
}

/** Ends the run as a failure, for "I don't remember". */
export function giveUp(run: DrillRun): DrillRun {
  return { ...run, gaveUp: true, status: run.status === 'your-move' ? 'complete' : run.status }
}

/** The card of the line the run ended on, when it ended on one. */
export function reviewedNode(run: DrillRun): RepertoireNode | undefined {
  if (run.gaveUp) return run.tree.nodes.get(run.targetId)
  return run.status === 'complete' ? run.tree.nodes.get(run.currentId) : undefined
}

/**
 * How the run went, in the scheduler's vocabulary.
 *
 * Misses and hints are what "I knew it" means for a repertoire: two misses is a lapse,
 * one miss or a hint is a hard recall, and a clean fast run is easy.
 */
export function gradeRun(run: DrillRun): DrillGrade | null {
  if (run.status === 'out-of-book' && !run.gaveUp) return null
  if (run.gaveUp || run.misses >= 2) return 'again'
  if (run.misses === 1 || run.hintsUsed > 0) return 'hard'
  const average = run.yourMovesPlayed === 0 ? 0 : run.thinkMs / run.yourMovesPlayed
  return average <= EASY_AVERAGE_MS ? 'easy' : 'good'
}

/** Your moves from the head on the target line, for the "3 of 7" progress bar. */
export function progressOf(run: DrillRun): { readonly done: number; readonly total: number } {
  const total = pathTo(run.tree, run.targetId).filter(
    (node) => node.isYourMove && pathIncludesHead(run, node),
  ).length
  return { done: Math.min(run.yourMovesPlayed, total), total }
}

function pathIncludesHead(run: DrillRun, node: RepertoireNode): boolean {
  const head = run.tree.nodes.get(run.headId)
  return head !== undefined && node.ply > head.ply
}

/** Mastery for the line list: stability against three weeks, which is "settled". */
export function lineMastery(card: SrsCard | undefined): number {
  if (card === undefined || card.state === 'new') return 0
  if (card.state === 'mastered') return 100
  return Math.min(99, Math.max(5, Math.round((card.stability / 21) * 100)))
}

const DAY_MS = 86_400_000

/** "now", "today", "tomorrow", "in 4 days": the wording the drill list uses. */
export function formatNextReview(card: SrsCard | undefined, at: Date): string {
  if (card === undefined || (card.state === 'new' && card.reps === 0)) return 'new'
  if (card.due <= at.getTime()) return 'now'
  const startOfToday = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()
  const days = Math.floor((card.due - startOfToday) / DAY_MS)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${String(days)} days`
}
