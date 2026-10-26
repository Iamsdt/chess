import { z } from 'zod'

import {
  applyMove,
  classifyMove,
  createGame,
  legalMoves,
  sideToMoveOf,
  uciLineToSan,
  type ChessGame,
} from '@/chess'
import { buildCalculationTree, toCoachEval } from '@/coach/calculation/build-tree'
import {
  childrenMap,
  finalEvalOf,
  formatEval,
  mainLineFrom,
  summariseCandidates,
  verdictOf,
  type Verdict,
} from '@/coach/calculation/tree-model'
import {
  CalculationAttachmentSchema,
  domainError,
  err,
  ok,
  MATE_SCORE_CP,
  scoreToWhiteCentipawns,
  type CalcNode,
  type CoachEval,
  type DomainError,
  type Color,
  type EngineLine,
  type Fen,
  type MoveQuality,
  type Result,
} from '@/domain'

import { isToolFailure, resolveFen, toolFailure, toolSignal, type CoachToolFailure } from './shared'
import { defineTool, type CoachToolEnv, type CoachToolGroup, type CoachToolOutput } from './types'

/**
 * S21b · Engine (§5): analysePosition, evaluateMove, compareMoves, findBestPlan,
 * buildCalculationTree, and openCalculationTree (listed with the board tools in §5, but it
 * needs the tree builder, so it lives here).
 *
 * Why every number is quoted twice: "+0.8" means nothing until you know who is to move, and a
 * model that is handed only one of the two will get the sign wrong for Black. Each eval comes
 * as White's view (the convention on the eval bar) and as the side to move's.
 *
 * Why every line is replayed before it is returned (§7): the engine speaks UCI and the model
 * speaks SAN, and a line that cannot be replayed from its position must never reach either
 * the model or the learner.
 */

const ANALYSE_DEPTH = 16
const ANALYSE_TIMEOUT_MS = 12_000
const DEFAULT_LINES = 3
const MAX_LINES = 5
const MAX_PV_PLIES = 10

/** Grandmaster mode's longer look: deeper, more time, longer variations. */
const PLAN_DEPTH = 22
const PLAN_TIMEOUT_MS = 25_000
const PLAN_LINES = 2
const PLAN_PV_PLIES = 16

const MOVE_DEPTH = 14
const MIN_COMPARED = 2
const MAX_COMPARED = 5
/** Keeps "−9.5" readable when a mate is on the board: past this, the size of the loss is moot. */
const LOSS_CEILING_CP = 1_000
const REPLY_PLIES = 6

const FEN_FIELD = z
  .string()
  .optional()
  .describe("FEN to analyse. Omit to use the position on the learner's screen.")

const sideName = (color: Color): string => (color === 'white' ? 'White' : 'Black')

/** A white-centred eval as seen from `color`. */
function viewFrom(value: CoachEval, color: Color): CoachEval {
  if (color === 'white') return value
  return {
    ...(value.cp === undefined ? {} : { cp: -value.cp }),
    ...(value.mate === undefined ? {} : { mate: -value.mate }),
  }
}

/** "slightly better for White", "Black mates in 3": the words to use for a white-centred eval. */
function assess(value: CoachEval): string {
  if (value.mate !== undefined) {
    const winner: Color = value.mate >= 0 ? 'white' : 'black'
    return `${sideName(winner)} mates in ${String(Math.abs(value.mate))}`
  }
  const cp = value.cp ?? 0
  const size = Math.abs(cp)
  if (size < 20) return 'equal'
  const winner = sideName(cp > 0 ? 'white' : 'black')
  if (size < 60) return `slightly better for ${winner}`
  if (size < 150) return `better for ${winner}`
  if (size < 400) return `clearly better for ${winner}`
  return `winning for ${winner}`
}

/** Both views of one eval, as the strings the model will quote. */
function evalFacts(
  value: CoachEval,
  sideToMove: Color,
): { eval: string; evalSideToMove: string; assessment: string } {
  return {
    eval: formatEval(value),
    evalSideToMove: formatEval(viewFrom(value, sideToMove)),
    assessment: assess(value),
  }
}

interface LineFacts {
  readonly rank: number
  readonly eval: string
  readonly evalSideToMove: string
  readonly depth: number
  /** SAN, replayed legally from the position. */
  readonly moves: readonly string[]
}

/** `undefined` when the engine's line does not replay: the line is dropped, not repaired. */
function lineFacts(fen: Fen, line: EngineLine, maxPlies: number): LineFacts | undefined {
  const replayed = uciLineToSan(fen, line.pv)
  if (!replayed.ok) return undefined
  const sideToMove = sideToMoveOf(fen)
  const facts = evalFacts(toCoachEval(line.score, sideToMove), sideToMove)
  return {
    rank: line.multipv,
    eval: facts.eval,
    evalSideToMove: facts.evalSideToMove,
    depth: line.depth,
    moves: replayed.value.slice(0, maxPlies),
  }
}

/** Bad input is the model's to fix; anything else is the engine's. */
function failureOf(error: DomainError): CoachToolFailure {
  return error.code === 'validation'
    ? toolFailure(error.message)
    : toolFailure(`The engine could not analyse this: ${error.message}`)
}

/* ── analysePosition / findBestPlan ──────────────────────────────────────── */

interface AnalysisOutput extends CoachToolOutput {
  readonly fen: Fen
  readonly sideToMove: Color
  readonly depth: number
  readonly eval: string
  readonly evalSideToMove: string
  readonly assessment: string
  readonly bestMove: string
  readonly lines: readonly LineFacts[]
}

interface SearchPlan {
  readonly multiPv: number
  readonly depth: number
  readonly timeoutMs: number
  readonly pvPlies: number
}

async function analyse(
  env: CoachToolEnv,
  fen: string | undefined,
  plan: SearchPlan,
): Promise<AnalysisOutput | CoachToolFailure> {
  const resolved = resolveFen(env, fen)
  if (isToolFailure(resolved)) return resolved
  const evaluated = await env.engine.evaluate(resolved, {
    depth: plan.depth,
    multiPv: plan.multiPv,
    lane: 'interactive',
    timeoutMs: plan.timeoutMs,
    signal: toolSignal(env, plan.timeoutMs + 3_000),
  })
  if (!evaluated.ok) return failureOf(evaluated.error)

  const lines = evaluated.value.lines
    .map((line) => lineFacts(resolved, line, plan.pvPlies))
    .filter((line): line is LineFacts => line !== undefined)
  const best = lines[0]
  if (best === undefined)
    return toolFailure('The engine returned no playable line for this position.')

  const sideToMove = sideToMoveOf(resolved)
  const headline = evalFacts(toCoachEval(evaluated.value.score, sideToMove), sideToMove)
  const bestMove = best.moves[0] ?? ''
  return {
    fen: resolved,
    sideToMove,
    depth: evaluated.value.depth,
    ...headline,
    bestMove,
    lines,
    summary: `depth ${String(evaluated.value.depth)} · ${headline.eval} · ${bestMove} best`,
  }
}

const analysePositionInput = z.object({
  fen: FEN_FIELD,
  multiPv: z
    .number()
    .int()
    .min(1)
    .max(MAX_LINES)
    .default(DEFAULT_LINES)
    .describe(`How many candidate lines to return (1 to ${String(MAX_LINES)}).`),
})

const findBestPlanInput = z.object({ fen: FEN_FIELD })

/* ── evaluateMove / compareMoves ─────────────────────────────────────────── */

/** What one move does to the position, as seen by the engine from the replying side. */
interface JudgedMove {
  readonly san: string
  readonly game: ChessGame
  readonly mover: Color
  /** Centipawns for the mover after the move; a mate is `MATE_SCORE_CP`-sized. */
  readonly moverCp: number
  readonly whiteEval: CoachEval | 'checkmate'
  readonly depth: number
  /** The engine's best answer, in SAN, replayed from the position after the move. */
  readonly reply: readonly string[]
  readonly line: EngineLine | undefined
}

async function judgeMove(
  env: CoachToolEnv,
  before: ChessGame,
  move: string,
  signal: AbortSignal,
): Promise<Result<JudgedMove>> {
  const next = applyMove(before, move)
  const played = next.ok ? next.value.history.at(-1) : undefined
  if (!next.ok || played === undefined) {
    const options = legalMoves(before)
      .map((legal) => legal.san)
      .join(', ')
    return err(
      domainError('validation', `"${move}" is not legal here. Legal moves: ${options}`, {
        where: 'engine tool',
      }),
    )
  }
  const mover = before.turn
  const base = { san: played.san, game: next.value, mover, reply: [], line: undefined }
  if (next.value.status.kind === 'checkmate') {
    return ok({ ...base, moverCp: MATE_SCORE_CP, whiteEval: 'checkmate', depth: 0 })
  }
  if (next.value.status.kind === 'draw') {
    return ok({ ...base, moverCp: 0, whiteEval: { cp: 0 }, depth: 0 })
  }
  const evaluated = await env.engine.evaluate(next.value.fen, {
    depth: MOVE_DEPTH,
    multiPv: 1,
    lane: 'interactive',
    signal,
  })
  if (!evaluated.ok) return err(evaluated.error)
  const line = evaluated.value.lines[0]
  const reply = line === undefined ? undefined : lineFacts(next.value.fen, line, REPLY_PLIES)
  return ok({
    ...base,
    moverCp: -scoreToWhiteCentipawns(evaluated.value.score, 'white'),
    whiteEval: toCoachEval(evaluated.value.score, next.value.turn),
    depth: evaluated.value.depth,
    reply: reply?.moves ?? [],
    line,
  })
}

const lossPawns = (bestCp: number, cp: number): number =>
  Math.max(0, Math.min(bestCp, LOSS_CEILING_CP) - Math.min(cp, LOSS_CEILING_CP)) / 100

const evalText = (value: CoachEval | 'checkmate'): string =>
  value === 'checkmate' ? 'checkmate' : formatEval(value)

interface EvaluateMoveOutput extends CoachToolOutput {
  readonly fen: Fen
  readonly move: string
  readonly mover: Color
  readonly evalBefore: string
  readonly evalAfter: string
  /** Pawns the move gives away compared with the engine's choice; 0 when it is the best move. */
  readonly pawnsLost: number
  readonly quality: MoveQuality
  readonly bestMove: string
  readonly bestLine: readonly string[]
  /** What the engine expects next, after this move. */
  readonly expectedReply: readonly string[]
  readonly depth: number
}

const evaluateMoveInput = z.object({
  fen: FEN_FIELD,
  move: z.string().min(1).describe('The move to judge, SAN ("Nf3") or UCI ("g1f3").'),
})

interface RankedMove {
  readonly rank: number
  readonly move: string
  readonly eval: string
  readonly evalForMover: string
  readonly pawnsBehindBest: number
  readonly expectedReply: readonly string[]
}

interface CompareMovesOutput extends CoachToolOutput {
  readonly fen: Fen
  readonly sideToMove: Color
  readonly depth: number
  readonly best: string
  readonly ranking: readonly RankedMove[]
}

const compareMovesInput = z.object({
  fen: FEN_FIELD,
  moves: z
    .array(z.string().min(1))
    .min(MIN_COMPARED)
    .max(MAX_COMPARED)
    .describe('Candidate moves to rank, SAN or UCI.'),
})

/* ── calculation tree ────────────────────────────────────────────────────── */

interface TreeCandidate {
  readonly move: string
  readonly tag: CalcNode['tag']
  /** The eval at the end of the candidate's main line, White's view. */
  readonly finalEval: string
  readonly line: readonly string[]
  readonly isBest: boolean
}

interface TreeSummaryOutput extends CoachToolOutput {
  readonly fen: Fen
  readonly sideToMove: Color
  readonly verdict: Verdict
  readonly nodeCount: number
  readonly candidates: readonly TreeCandidate[]
}

interface BuiltTree {
  readonly summary: TreeSummaryOutput
  readonly nodes: CalcNode[]
}

const buildTreeInput = z.object({ fen: FEN_FIELD })

const openTreeInput = z.object({
  fen: FEN_FIELD,
  title: z
    .string()
    .min(1)
    .max(80)
    .optional()
    .describe('Card title; defaults to "What should White play?".'),
})

async function buildTree(
  env: CoachToolEnv,
  fen: string | undefined,
): Promise<{ built: BuiltTree; fen: Fen } | CoachToolFailure> {
  const resolved = resolveFen(env, fen)
  if (isToolFailure(resolved)) return resolved
  const game = createGame(resolved)
  if (!game.ok) return toolFailure(game.error.message)

  const nodes = await buildCalculationTree(env.engine, resolved, { signal: toolSignal(env) })
  if (!nodes.ok) return toolFailure(`Could not build a tree: ${nodes.error.message}`)

  const sideToMove = game.value.turn
  const attachment = {
    kind: 'calculation' as const,
    title: 'tree',
    fen: resolved,
    orientation: sideToMove,
    nodes: nodes.value,
  }
  const kids = childrenMap(nodes.value)
  const ranked = summariseCandidates(attachment, sideToMove)
  const candidates = ranked.map((candidate): TreeCandidate => ({
    move: candidate.node.san,
    tag: candidate.node.tag,
    finalEval: formatEval(finalEvalOf(kids, candidate.node)),
    line: [candidate.node, ...mainLineFrom(kids, candidate.node.id)].map((node) => node.san),
    isBest: candidate.isBest,
  }))
  const top = ranked.find((candidate) => candidate.isBest)
  const best = candidates.find((candidate) => candidate.isBest)
  return {
    fen: resolved,
    built: {
      nodes: nodes.value,
      summary: {
        fen: resolved,
        sideToMove,
        verdict: verdictOf(top?.score ?? 0),
        nodeCount: nodes.value.length,
        candidates,
        summary: `${String(candidates.length)} candidates · ${best?.move ?? 'none'} best · ${String(nodes.value.length)} nodes`,
      },
    },
  }
}

export const engineTools: CoachToolGroup = (env) => ({
  analysePosition: defineTool({
    description:
      "Top engine lines for a position with evaluation (White's view and the side to move's), depth and SAN variations. Quote these numbers; never state an engine evaluation you were not given.",
    inputSchema: analysePositionInput,
    execute: ({ fen, multiPv }) =>
      analyse(env, fen, {
        multiPv,
        depth: ANALYSE_DEPTH,
        timeoutMs: ANALYSE_TIMEOUT_MS,
        pvPlies: MAX_PV_PLIES,
      }),
  }),

  evaluateMove: defineTool({
    description:
      "What a specific move does to the evaluation: the eval before and after, how much it gives away compared with the engine's choice, and the engine's best move.",
    inputSchema: evaluateMoveInput,
    execute: async ({ fen, move }): Promise<EvaluateMoveOutput | CoachToolFailure> => {
      const resolved = resolveFen(env, fen)
      if (isToolFailure(resolved)) return resolved
      const start = createGame(resolved)
      if (!start.ok) return toolFailure(start.error.message)
      const signal = toolSignal(env)

      const [judged, baseline] = await Promise.all([
        judgeMove(env, start.value, move, signal),
        env.engine.evaluate(resolved, {
          depth: MOVE_DEPTH,
          multiPv: 2,
          lane: 'interactive',
          signal,
        }),
      ])
      if (!judged.ok) return failureOf(judged.error)
      if (!baseline.ok) return failureOf(baseline.error)

      const mover = start.value.turn
      const bestLine = baseline.value.lines[0]
      const best = bestLine === undefined ? undefined : lineFacts(resolved, bestLine, MAX_PV_PLIES)
      if (bestLine === undefined || best === undefined) {
        return toolFailure('The engine returned no playable line for this position.')
      }
      const bestCp = scoreToWhiteCentipawns(baseline.value.score, 'white')
      const lost = lossPawns(bestCp, judged.value.moverCp)
      const evalBefore = toCoachEval(baseline.value.score, mover)
      const bestSan = best.moves[0] ?? ''
      const playedUci = judged.value.game.history.at(-1)?.uci
      const quality: MoveQuality =
        judged.value.whiteEval === 'checkmate' || playedUci === undefined
          ? 'best'
          : classifyMove({
              mover,
              scoreBefore: baseline.value.score,
              scoreAfter: judged.value.line?.score ?? { kind: 'cp', value: 0 },
              playedUci,
              bestUci: bestLine.pv[0],
              secondBestScore: baseline.value.lines[1]?.score,
              fenBefore: resolved,
            })
      const after = evalText(judged.value.whiteEval)
      return {
        fen: resolved,
        move: judged.value.san,
        mover,
        evalBefore: formatEval(evalBefore),
        evalAfter: after,
        pawnsLost: lost,
        quality,
        bestMove: bestSan,
        bestLine: best.moves,
        expectedReply: judged.value.reply,
        depth: judged.value.depth,
        summary:
          judged.value.san === bestSan
            ? `depth ${String(judged.value.depth)} · ${after} · ${quality} (engine's choice)`
            : `depth ${String(judged.value.depth)} · ${after} · ${quality}, ${bestSan} best`,
      }
    },
  }),

  compareMoves: defineTool({
    description:
      "Rank two to five candidate moves side by side by the evaluation each leads to, with the engine's expected reply to each.",
    inputSchema: compareMovesInput,
    execute: async ({ fen, moves }): Promise<CompareMovesOutput | CoachToolFailure> => {
      const resolved = resolveFen(env, fen)
      if (isToolFailure(resolved)) return resolved
      const start = createGame(resolved)
      if (!start.ok) return toolFailure(start.error.message)
      const signal = toolSignal(env)

      const results = await Promise.all(
        moves.map((move) => judgeMove(env, start.value, move, signal)),
      )
      const judged: JudgedMove[] = []
      for (const result of results) {
        if (!result.ok) return failureOf(result.error)
        // The same move written two ways would rank against itself.
        if (!judged.some((other) => other.san === result.value.san)) judged.push(result.value)
      }
      if (judged.length < MIN_COMPARED)
        return toolFailure('Give at least two different moves to compare.')

      const sideToMove = start.value.turn
      const ranked = [...judged].sort((a, b) => b.moverCp - a.moverCp)
      const bestCp = ranked[0]?.moverCp ?? 0
      const ranking = ranked.map((entry, index): RankedMove => {
        const white = entry.whiteEval
        return {
          rank: index + 1,
          move: entry.san,
          eval: evalText(white),
          evalForMover:
            white === 'checkmate' ? 'checkmate' : formatEval(viewFrom(white, sideToMove)),
          pawnsBehindBest: lossPawns(bestCp, entry.moverCp),
          expectedReply: entry.reply,
        }
      })
      const depth = Math.min(...judged.map((entry) => entry.depth))
      const best = ranking[0]?.move ?? ''
      return {
        fen: resolved,
        sideToMove,
        depth,
        best,
        ranking,
        summary: `depth ${String(depth)} · ${best} best of ${String(ranking.length)}`,
      }
    },
  }),

  findBestPlan: defineTool({
    description:
      'A longer, deeper search with long variations, for planning rather than tactics. Slow: use it only when the learner wants the plan, not a quick check.',
    inputSchema: findBestPlanInput,
    execute: ({ fen }) =>
      analyse(env, fen, {
        multiPv: PLAN_LINES,
        depth: PLAN_DEPTH,
        timeoutMs: PLAN_TIMEOUT_MS,
        pvPlies: PLAN_PV_PLIES,
      }),
  }),

  buildCalculationTree: defineTool({
    description:
      'Build the pruned candidate/reply tree for a position (top engine moves, plus tempting moves that fail) and return its main lines and verdict. To show it to the learner, use openCalculationTree.',
    inputSchema: buildTreeInput,
    execute: async ({ fen }): Promise<TreeSummaryOutput | CoachToolFailure> => {
      const result = await buildTree(env, fen)
      return isToolFailure(result) ? result : result.built.summary
    },
  }),

  openCalculationTree: defineTool({
    description:
      'Pin a calculation card in the chat that opens the full-screen tree for a position, and return the same summary as buildCalculationTree.',
    inputSchema: openTreeInput,
    execute: async ({ fen, title }): Promise<TreeSummaryOutput | CoachToolFailure> => {
      const result = await buildTree(env, fen)
      if (isToolFailure(result)) return result
      const { summary, nodes } = result.built
      const card = CalculationAttachmentSchema.safeParse({
        kind: 'calculation',
        title: title ?? `What should ${sideName(summary.sideToMove)} play?`,
        fen: result.fen,
        orientation:
          fen === undefined
            ? (env.context.position?.orientation ?? summary.sideToMove)
            : summary.sideToMove,
        nodes,
      })
      if (!card.success) return toolFailure('The calculation tree could not be shown.')
      env.emit(card.data)
      return summary
    },
  }),
})
