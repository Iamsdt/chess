import {
  classifyMoveDetailed,
  countMoveQualities,
  createGame,
  gameAccuracyFromEvals,
  isBookPosition,
  uciToSan,
  winPercentFromScore,
  type AccuracyByColor,
} from '@/chess'
import {
  domainError,
  err,
  MATE_SCORE_CP,
  ok,
  oppositeColor,
  type Color,
  type EngineEval,
  type EngineScore,
  type Fen,
  type Game,
  type MistakeEntry,
  type MoveQuality,
  type MoveQualityCounts,
  type MoveRecord,
  type Result,
  type San,
  type Uci,
} from '@/domain'

import { explainMove } from './explain'

/**
 * S13 · Reviewing a game: evaluations in, a verdict on every move out.
 *
 * Pure apart from the evaluator it is handed, so the same code runs in the background job
 * against Stockfish and in a test against a table of numbers. Every sentence it writes is
 * built from those numbers and the rules of chess and never from a model, so an
 * explanation cannot disagree with the engine line it sits next to.
 */

export { explainMove, type ExplainInput } from './explain'

/** Asks the engine about one position; the review never knows which engine, or where. */
export type Evaluator = (fen: Fen) => Promise<Result<EngineEval>>

/** A move the review wants remembered, before it has an id or a spaced-repetition card. */
export type MistakeDraft = Omit<MistakeEntry, 'id' | 'createdAt' | 'updatedAt' | 'srsCardId'>

export interface KeyMoment {
  readonly ply: number
  readonly color: Color
  readonly san: San
  readonly quality: MoveQuality
  readonly bestSan: San | undefined
  /** Win percentage the mover gave away. */
  readonly swing: number
  readonly explanation: string
}

export interface GameReview {
  /** The game's moves, each with its evaluation, verdict and explanation filled in. */
  readonly moves: readonly MoveRecord[]
  /** `undefined` for a game too short for both sides to have an accuracy. */
  readonly accuracy: AccuracyByColor | undefined
  readonly counts: { readonly white: MoveQualityCounts; readonly black: MoveQualityCounts }
  /** The user's own worst moments, worth giving back to them. */
  readonly mistakes: readonly MistakeDraft[]
  readonly keyMoments: readonly KeyMoment[]
}

export interface ReviewOptions {
  readonly signal?: AbortSignal | undefined
  readonly onProgress?: ((done: number, total: number) => void) | undefined
  /** How many mistakes at most go to the Mistake Bank from one game. */
  readonly maxMistakes?: number | undefined
  readonly maxKeyMoments?: number | undefined
}

const DEFAULT_MAX_MISTAKES = 5
const DEFAULT_MAX_KEY_MOMENTS = 4

/** Moves that earn a place in the Mistake Bank; an inaccuracy is not worth a card. */
const BANK_QUALITIES: ReadonlySet<MoveQuality> = new Set(['mistake', 'miss', 'blunder'])
/** And the ones the review calls out as turning points. */
const MOMENT_QUALITIES: ReadonlySet<MoveQuality> = new Set(['mistake', 'miss', 'blunder'])

/** A finished game has no moves left to evaluate, but it still has a result to score. */
function terminalEval(fen: Fen): EngineEval | undefined {
  const game = createGame(fen)
  if (!game.ok) return undefined
  const { status } = game.value
  if (status.kind === 'in-progress') return undefined
  const score: EngineScore =
    status.kind === 'checkmate' ? { kind: 'cp', value: -MATE_SCORE_CP } : { kind: 'cp', value: 0 }
  return {
    fen,
    depth: 0,
    score,
    bestMove: null,
    ponder: null,
    lines: [],
    lane: 'batch',
    computedAt: Date.now() as EngineEval['computedAt'],
  }
}

async function evaluatePosition(fen: Fen, evaluate: Evaluator): Promise<Result<EngineEval>> {
  const terminal = terminalEval(fen)
  return terminal === undefined ? evaluate(fen) : ok(terminal)
}

/** A short caption for a board position, for the bank card: what to find, not the answer. */
function originOf(game: Game): string {
  const opponent = game.meta.youPlay === 'white' ? game.meta.black : game.meta.white
  return `vs ${opponent.name}`
}

export async function reviewGame(
  game: Game,
  evaluate: Evaluator,
  options: ReviewOptions = {},
): Promise<Result<GameReview>> {
  // A move that was taken back is not part of the game that was actually played.
  const played = game.moves.filter((move) => !move.wasTakenBack)
  const first = played[0]
  if (first === undefined) {
    return err(domainError('validation', 'There are no moves to review', { where: 'review' }))
  }

  const fens: Fen[] = [first.fenBefore, ...played.map((move) => move.fenAfter)]
  const evals: EngineEval[] = []
  for (const [index, fen] of fens.entries()) {
    if (options.signal?.aborted === true) {
      return err(domainError('cancelled', 'The review was cancelled', { where: 'review' }))
    }
    const evaluated = await evaluatePosition(fen, evaluate)
    if (!evaluated.ok) return evaluated
    evals.push(evaluated.value)
    options.onProgress?.(index + 1, fens.length)
  }

  const reviewed: MoveRecord[] = []
  const moments: KeyMoment[] = []
  const drafts: { readonly swing: number; readonly draft: MistakeDraft }[] = []

  for (const [index, move] of played.entries()) {
    const before = evals[index]
    const after = evals[index + 1]
    if (before === undefined || after === undefined) continue

    const detail = classifyMoveDetailed({
      mover: move.color,
      scoreBefore: before.score,
      scoreAfter: after.score,
      playedUci: move.uci,
      bestUci: before.bestMove ?? undefined,
      secondBestScore: before.lines[1]?.score,
      fenBefore: move.fenBefore,
      isBook: isBookPosition(move.fenAfter),
    })

    const bestUci: Uci | undefined =
      before.bestMove !== null && before.bestMove !== move.uci ? before.bestMove : undefined
    const bestSanResult = bestUci === undefined ? undefined : uciToSan(move.fenBefore, bestUci)
    const bestSan = bestSanResult?.ok === true ? bestSanResult.value : undefined

    const matedAfter =
      after.score.kind === 'mate'
        ? // After the move the opponent is to move: a positive count is the opponent mating.
          after.score.moves > 0
        : false
    const explanation = explainMove({
      san: move.san,
      quality: detail.quality,
      bestSan,
      winBefore: detail.winPercentBefore,
      winAfter: detail.winPercentAfter,
      matedAfter,
    })

    reviewed.push({
      ...move,
      evalBefore: before.score,
      evalAfter: after.score,
      quality: detail.quality,
      ...(bestUci === undefined ? {} : { bestMove: bestUci }),
      ...(bestSan === undefined ? {} : { bestMoveSan: bestSan }),
      ...(bestUci === undefined || before.lines[0] === undefined
        ? {}
        : { bestLine: before.lines[0].pv.slice(0, 5) }),
      explanation,
      isBook: detail.quality === 'book',
    })

    const yours = move.color === game.meta.youPlay
    if (yours && MOMENT_QUALITIES.has(detail.quality)) {
      moments.push({
        ply: move.ply,
        color: move.color,
        san: move.san,
        quality: detail.quality,
        bestSan,
        swing: detail.winPercentLost,
        explanation,
      })
    }
    if (
      yours &&
      BANK_QUALITIES.has(detail.quality) &&
      bestUci !== undefined &&
      bestSan !== undefined
    ) {
      const quality = detail.quality as MistakeEntry['quality']
      drafts.push({
        swing: detail.winPercentLost,
        draft: {
          source: 'game-review',
          gameId: game.meta.id,
          ply: move.ply,
          moveNumber: move.moveNumber,
          fen: move.fenBefore,
          yourColor: move.color,
          playedSan: move.san,
          playedUci: move.uci,
          bestSan,
          bestUci,
          solution: [bestUci],
          quality,
          evalBefore: before.score,
          evalAfter: after.score,
          themes: [],
          explanation,
          originLabel: originOf(game),
        },
      })
    }
  }

  // Accuracy counts positions *after* each move and supplies the starting one itself, so the
  // start position's evaluation must not also be in the list: it would shift every move
  // onto the wrong side.
  const accuracy = gameAccuracyFromEvals(evals.slice(1), { startColor: first.color })
  const withQuality = reviewed.flatMap((move) =>
    move.quality === undefined ? [] : [{ color: move.color, quality: move.quality }],
  )

  return ok({
    moves: reviewed,
    accuracy: accuracy.ok ? accuracy.value : undefined,
    counts: countMoveQualities(withQuality),
    mistakes: drafts
      .sort((a, b) => b.swing - a.swing)
      .slice(0, options.maxMistakes ?? DEFAULT_MAX_MISTAKES)
      .map((entry) => entry.draft)
      // The bank reads best in the order things happened, like the game did.
      .sort((a, b) => (a.ply ?? 0) - (b.ply ?? 0)),
    keyMoments: moments
      .sort((a, b) => b.swing - a.swing)
      .slice(0, options.maxKeyMoments ?? DEFAULT_MAX_KEY_MOMENTS)
      .sort((a, b) => a.ply - b.ply),
  })
}

/** Win percentage for White after each position, for the eval graph; length is moves + 1. */
export function whiteWinSeries(moves: readonly MoveRecord[]): number[] {
  const first = moves[0]
  if (first?.evalBefore === undefined) return []
  const series = [winPercentFromScore(first.evalBefore, first.color, 'white')]
  for (const move of moves) {
    if (move.evalAfter === undefined) break
    series.push(winPercentFromScore(move.evalAfter, oppositeColor(move.color), 'white'))
  }
  return series
}
