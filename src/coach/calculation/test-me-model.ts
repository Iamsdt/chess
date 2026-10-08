import { applyMove, createGame, type ChessGame } from '@/chess'
import type { CalcNode, CalculationAttachment, Color, Fen } from '@/domain'

import {
  childrenMap,
  summariseCandidates,
  verdictOf,
  type CandidateSummary,
  type Verdict,
} from './tree-model'

/**
 * Test me, without React: what the user typed, how far it is legal, and how it scores
 * against the real tree (coach-agent.md §9.4).
 */

export const MAX_PICKS = 3
/** Plies the user calculates per candidate: the candidate, the reply, the follow-up. */
export const LINE_PLIES = 3
/** A choice this close to the best candidate still counts as the right move. */
export const CHOICE_TOLERANCE_CP = 50

export interface Pick {
  /** The candidate, as a canonical SAN (it came from a legal-move list or the board). */
  readonly first: string
  /** Raw text the user typed; may be illegal until it is fixed. */
  readonly reply: string
  readonly follow: string
  readonly verdict: Verdict | null
}

export interface ResolvedPick {
  /** Canonical SANs of the longest legal prefix. */
  readonly sans: readonly string[]
  /** Position after that prefix, or `null` when even the candidate is illegal. */
  readonly game: ChessGame | null
  /** Which typed slot is the first illegal one, if any. */
  readonly invalid: 'first' | 'reply' | 'follow' | null
  readonly complete: boolean
}

export function resolvePick(rootFen: Fen, pick: Pick): ResolvedPick {
  const root = createGame(rootFen)
  if (!root.ok) return { sans: [], game: null, invalid: 'first', complete: false }
  const slots = [
    ['first', pick.first],
    ['reply', pick.reply],
    ['follow', pick.follow],
  ] as const
  let game = root.value
  const sans: string[] = []
  for (const [slot, text] of slots) {
    const trimmed = text.trim()
    if (trimmed === '')
      return { sans, game: sans.length === 0 ? null : game, invalid: null, complete: false }
    const next = applyMove(game, trimmed)
    const played = next.ok ? next.value.history.at(-1) : undefined
    if (!next.ok || played === undefined) {
      return { sans, game: sans.length === 0 ? null : game, invalid: slot, complete: false }
    }
    game = next.value
    sans.push(played.san)
  }
  return { sans, game, invalid: null, complete: true }
}

/* ── Reveal ──────────────────────────────────────────────────────────────── */

export interface PickReview {
  readonly san: string
  readonly node: CalcNode | null
  readonly tempting: boolean
  /** Ids of the tree nodes this line shares with the engine's tree, in order. */
  readonly matchedIds: readonly string[]
  /** Index into the user's line of the first move the tree does not contain, or `null`. */
  readonly leftAt: number | null
  readonly leftWith: string | null
  readonly expected: readonly string[]
  readonly truth: Verdict | null
  readonly verdict: Verdict | null
  readonly verdictRight: boolean
}

export interface AttemptReview {
  readonly picks: readonly PickReview[]
  readonly missed: readonly CalcNode[]
  readonly bestSan: string
  readonly chosenSan: string | null
  readonly choiceRight: boolean
  readonly foundBest: boolean
  readonly score: number
  /** Every tree node on one of the user's lines, for the overlay. */
  readonly overlay: ReadonlySet<string>
}

function reviewPick(
  kids: ReadonlyMap<string | null, readonly CalcNode[]>,
  summaries: readonly CandidateSummary[],
  pick: Pick,
  sans: readonly string[],
): PickReview {
  const matchedIds: string[] = []
  let leftAt: number | null = null
  let leftWith: string | null = null
  let expected: readonly string[] = []
  let parent: string | null = null
  for (const [index, san] of sans.entries()) {
    const options: readonly CalcNode[] = kids.get(parent) ?? []
    const hit = options.find((node) => node.san === san)
    if (hit === undefined) {
      leftAt = index
      leftWith = san
      expected = options.map((node) => node.san)
      break
    }
    matchedIds.push(hit.id)
    parent = hit.id
  }
  const summary = summaries.find((row) => row.node.san === pick.first) ?? null
  const truth = summary === null ? null : verdictOf(summary.score)
  return {
    san: pick.first,
    node: summary?.node ?? null,
    tempting: summary?.node.tag === 'tempting',
    matchedIds,
    leftAt,
    leftWith,
    expected,
    truth,
    verdict: pick.verdict,
    verdictRight: truth !== null && truth === pick.verdict,
  }
}

/**
 * Score out of 100: finding the best candidate (30), right verdicts (30), staying on the
 * engine's line (20), and choosing a move within half a pawn of the best (20).
 */
export function reviewAttempt(
  attachment: CalculationAttachment,
  rootFen: Fen,
  picks: readonly Pick[],
  chosenIndex: number | null,
): AttemptReview {
  const kids = childrenMap(attachment.nodes)
  const sideToMove: Color = rootFen.split(' ')[1] === 'b' ? 'black' : 'white'
  const summaries = summariseCandidates(attachment, sideToMove)
  const best = summaries.find((row) => row.isBest) ?? summaries[0]
  const bestSan = best?.node.san ?? ''

  const lines = picks.map((pick) => resolvePick(rootFen, pick).sans)
  const reviews = picks.map((pick, index) => reviewPick(kids, summaries, pick, lines[index] ?? []))
  const pickedSans = new Set(picks.map((pick) => pick.first))
  const missed = summaries
    .filter((row) => row.node.tag !== 'tempting' && !pickedSans.has(row.node.san))
    .map((row) => row.node)

  const chosen = chosenIndex === null ? undefined : picks[chosenIndex]
  const chosenSummary = summaries.find((row) => row.node.san === chosen?.first)
  const choiceRight =
    chosenSummary !== undefined &&
    best !== undefined &&
    best.score - chosenSummary.score <= CHOICE_TOLERANCE_CP
  const foundBest = pickedSans.has(bestSan)

  const verdictShare =
    reviews.length === 0
      ? 0
      : reviews.filter((review) => review.verdictRight).length / reviews.length
  const entered = lines.reduce((sum, line) => sum + line.length, 0)
  const matched = reviews.reduce((sum, review) => sum + review.matchedIds.length, 0)
  const lineShare = entered === 0 ? 0 : matched / entered

  const score = Math.round(
    (foundBest ? 30 : 0) + 30 * verdictShare + 20 * lineShare + (choiceRight ? 20 : 0),
  )
  return {
    picks: reviews,
    missed,
    bestSan,
    chosenSan: chosen?.first ?? null,
    choiceRight,
    foundBest,
    score,
    overlay: new Set(reviews.flatMap((review) => review.matchedIds)),
  }
}
