import { applyMove, classifyMove, createGame, isCheck, isGameOver, legalMoves } from '@/chess'
import type { ChessGame } from '@/chess'
import {
  domainError,
  err,
  ok,
  scoreToWhiteCentipawns,
  type CalcNode,
  type CalcTag,
  type CoachEval,
  type Color,
  type EngineLine,
  type EngineScore,
  type Fen,
  type Result,
  type Uci,
} from '@/domain'
import type { Engine } from '@/engine'

/**
 * The engine-only tree builder (coach-agent.md §9.1): no key, no model, no storage.
 *
 * Why the tree is pruned like a player's would be: top three candidates, only the best
 * continuation of our own, only the replies that are close to best for them. A full
 * search tree is unreadable; the lesson is in the few lines a person would actually check,
 * plus the tempting move whose refutation is the point.
 *
 * Why every move comes from a line the engine returned and is replayed through `@/chess`:
 * the tree is shown to a learner as fact, so a node that is not a legal move from its parent
 * cannot exist, whatever the engine or the model said.
 */

/** About 25 nodes: enough for three branches, few enough to read on a phone. */
export const TREE_NODE_BUDGET = 25
export const TREE_MAX_PLIES = 6
/** Wall-clock for the whole build; what is built by then is the tree. */
export const TREE_BUDGET_MS = 7_000

const SEARCH_DEPTH = 12
/** Enough lines that checks and captures ranked below the top three are still visible. */
const ROOT_MULTI_PV = 8
const TOP_CANDIDATES = 3
const MAX_TEMPTING = 2
const TEMPTING_LOSS_CP = 150
const SECOND_REPLY_WITHIN_CP = 50
const QUIET_FROM_PLY = 3
const QUIET_SWING_CP = 30

export interface BuildTreeOptions {
  /** Stops every search in flight; the build then fails instead of returning a partial tree. */
  readonly signal?: AbortSignal
  readonly budgetMs?: number
}

/** The score as the other side sees it. */
function negate(score: EngineScore): EngineScore {
  return score.kind === 'cp'
    ? { kind: 'cp', value: -score.value }
    : { kind: 'mate', moves: -score.moves }
}

/** An engine score (side-to-move view) as the white-centred eval the UI and the model read. */
export function toCoachEval(score: EngineScore, sideToMove: Color): CoachEval {
  const sign = sideToMove === 'white' ? 1 : -1
  return score.kind === 'cp' ? { cp: sign * score.value } : { mate: sign * score.moves }
}

/** One comparable number for the side that is moving; a mate outranks any material count. */
function moverValue(score: EngineScore): number {
  return scoreToWhiteCentipawns(score, 'white')
}

/** A position whose node has been placed and may still be expanded. */
interface Frontier {
  readonly id: string
  readonly game: ChessGame
  readonly ply: number
  readonly whiteCp: number
}

function tagFor(
  lines: readonly EngineLine[],
  line: EngineLine,
  uci: Uci,
  game: ChessGame,
): CalcTag {
  if (legalMoves(game).length === 1) return 'forced'
  const best = lines[0]
  if (best === undefined) return 'good'
  const quality = classifyMove({
    mover: game.turn,
    scoreBefore: best.score,
    scoreAfter: negate(line.score),
    playedUci: uci,
    bestUci: best.pv[0],
    secondBestScore: lines[1]?.score,
  })
  switch (quality) {
    case 'blunder':
    case 'miss':
      return 'blunder'
    case 'mistake':
    case 'inaccuracy':
      return 'mistake'
    case 'great':
    case 'brilliant':
      return 'only-move'
    case 'best':
      return 'best'
    default:
      return 'good'
  }
}

async function search(
  engine: Engine,
  game: ChessGame,
  multiPv: number,
  signal: AbortSignal,
): Promise<Result<readonly EngineLine[]>> {
  const evaluated = await engine.evaluate(game.fen, {
    depth: SEARCH_DEPTH,
    multiPv,
    lane: 'interactive',
    signal,
  })
  if (!evaluated.ok) return err(evaluated.error)
  return evaluated.value.lines.length === 0
    ? err(domainError('engine', 'The engine returned no lines', { where: 'calculation tree' }))
    : ok(evaluated.value.lines)
}

/** Our moves keep only the best; theirs add a second reply when it is nearly as good. */
function wantedLines(lines: readonly EngineLine[], ours: boolean): readonly EngineLine[] {
  const best = lines[0]
  if (best === undefined) return []
  if (ours) return [best]
  const second = lines[1]
  const close =
    second !== undefined &&
    moverValue(best.score) - moverValue(second.score) <= SECOND_REPLY_WITHIN_CP
  return close ? [best, second] : [best]
}

/**
 * Build the pruned candidate/reply tree for a position, breadth first.
 *
 * Returns the nodes in the order they were placed: every candidate before any reply, every
 * reply before any continuation, and each parent's best child first, which is the order
 * `mainLineFrom` reads as the principal line.
 */
export async function buildCalculationTree(
  engine: Engine,
  fen: Fen,
  options: BuildTreeOptions = {},
): Promise<Result<CalcNode[]>> {
  const root = createGame(fen)
  if (!root.ok) return err(root.error)
  if (isGameOver(root.value)) {
    return err(
      domainError('validation', 'The game is over here: there is nothing to calculate', {
        where: 'calculation tree',
      }),
    )
  }

  const budget = AbortSignal.timeout(options.budgetMs ?? TREE_BUDGET_MS)
  const signal = options.signal === undefined ? budget : AbortSignal.any([options.signal, budget])

  const nodes: CalcNode[] = []
  const queue: Frontier[] = []

  /**
   * Place one engine line as a child of `parent`. `false` when the move is not legal, or when
   * `tempting` is asked for and the move is neither a check nor a capture.
   */
  const place = (
    parent: Frontier | null,
    game: ChessGame,
    lines: readonly EngineLine[],
    line: EngineLine,
    tempting = false,
  ): boolean => {
    const uci = line.pv[0]
    if (uci === undefined) return false
    const next = applyMove(game, uci)
    const played = next.ok ? next.value.history.at(-1) : undefined
    if (!next.ok || played === undefined) return false
    // Only a move that looks natural tempts: a check or a capture.
    if (tempting && played.captured === undefined && !isCheck(next.value)) return false

    const ply = (parent?.ply ?? 0) + 1
    const eval_ = toCoachEval(line.score, game.turn)
    const whiteCp = scoreToWhiteCentipawns(line.score, game.turn)
    const swing = parent === null ? Infinity : Math.abs(whiteCp - parent.whiteCp)
    const stop = ((): CalcNode['stop'] => {
      if (next.value.status.kind === 'checkmate') return 'mate'
      if (next.value.status.kind === 'draw') return 'quiet'
      if (ply >= TREE_MAX_PLIES) return 'depth'
      const quiet =
        ply >= QUIET_FROM_PLY &&
        played.captured === undefined &&
        !isCheck(next.value) &&
        swing <= QUIET_SWING_CP
      return quiet ? 'quiet' : undefined
    })()
    const node: CalcNode = {
      id: `n${String(nodes.length)}`,
      parentId: parent?.id ?? null,
      san: played.san,
      eval: eval_,
      tag: tempting ? 'tempting' : tagFor(lines, line, uci, game),
      ...(stop === undefined ? {} : { stop }),
    }
    nodes.push(node)
    if (stop === undefined) queue.push({ id: node.id, game: next.value, ply, whiteCp })
    return true
  }

  const rootLines = await search(engine, root.value, ROOT_MULTI_PV, signal)
  if (!rootLines.ok) return err(rootLines.error)
  const best = rootLines.value[0]
  if (best === undefined)
    return err(domainError('engine', 'No lines', { where: 'calculation tree' }))

  rootLines.value.slice(0, TOP_CANDIDATES).forEach((line) => {
    place(null, root.value, rootLines.value, line)
  })

  let temptingCount = 0
  for (const line of rootLines.value.slice(TOP_CANDIDATES)) {
    if (temptingCount >= MAX_TEMPTING) break
    if (moverValue(best.score) - moverValue(line.score) < TEMPTING_LOSS_CP) continue
    if (place(null, root.value, rootLines.value, line, true)) temptingCount += 1
  }

  while (queue.length > 0 && nodes.length < TREE_NODE_BUDGET) {
    const item = queue.shift()
    if (item === undefined) break
    const lines = await search(engine, item.game, 2, signal)
    // Out of time or cancelled: keep what is built; the caller decides about a cancel.
    if (!lines.ok) break
    // Odd plies are ours, so the position after one is the opponent's to answer.
    const ours = item.ply % 2 === 0
    for (const line of wantedLines(lines.value, ours)) {
      if (nodes.length >= TREE_NODE_BUDGET) break
      place(item, item.game, lines.value, line)
    }
  }

  if (options.signal?.aborted === true) {
    return err(
      domainError('cancelled', 'Stopped before the tree was built', { where: 'calculation tree' }),
    )
  }

  // A branch the budget cut short stopped for the same reason as one the depth cut short.
  const parents = new Set(nodes.map((node) => node.parentId))
  return ok(
    nodes.map((node) =>
      node.stop !== undefined || parents.has(node.id) ? node : { ...node, stop: 'depth' },
    ),
  )
}
