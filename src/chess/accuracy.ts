import {
  domainError,
  err,
  ok,
  scoreToWhiteCentipawns,
  type Color,
  type EngineEval,
  type EngineScore,
  type Percent,
  type Result,
} from '@/domain'

import { sideToMoveOf } from './fen'

/**
 * Turning evaluations into the two numbers a player actually looks at: how likely they
 * were to win, and how accurately they played.
 *
 * **Where these formulas come from.** They are Lichess's, reproduced constant for
 * constant from the published source rather than invented here:
 *
 * - the win-percentage curve is `chess.eval.WinPercent` in `lichess-org/scalachess`
 *   (`core/src/main/scala/eval.scala`), whose multiplier was fitted on Lichess's own game
 *   database in lichess-org/lila#11148;
 * - the per-move and whole-game accuracy are `lila.analyse.AccuracyPercent` in
 *   `lichess-org/lila` (`modules/analyse/src/main/AccuracyPercent.scala`), which carries
 *   the curve fit that produced its three constants in a comment;
 * - the means are `scalalib.Maths`, including its two quirks: the standard deviation is
 *   the *population* one, and the harmonic mean floors each term at 1.
 *
 * **Why borrow rather than invent.** An accuracy percentage is meaningless on its own —
 * it only means something if a player can compare it with the number the rest of the
 * chess world shows them. Matching Lichess exactly means a player can open the same game
 * on lichess.org and see the same figure, and it means the golden-file tests in this
 * sprint check against numbers this project did not choose.
 */

/** Evaluations beyond this are all "winning"; the curve is flat out here anyway. */
export const EVAL_CEILING_CP = 1000

/** The logistic steepness Lichess fitted to its own games. */
export const WIN_PERCENT_MULTIPLIER = 0.00368208

/**
 * White's nominal edge in the starting position.
 *
 * Why it is not zero: game accuracy compares each position with the one before it, and the
 * first move needs something to be compared *to*. Lichess uses +15 centipawns, so the
 * first move of a game is not scored against an artificially level position.
 */
export const INITIAL_CENTIPAWNS = 15

const ACCURACY_SCALE = 103.1668100711649
const ACCURACY_DECAY = 0.04354415386753951
const ACCURACY_OFFSET = -3.166924740191411
/** Analysis is imperfect, so a move is never punished for the last point of a percent. */
const ACCURACY_UNCERTAINTY_BONUS = 1

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value))

/** How much of the full point a side expects to score, on `[-1, +1]`. */
export function winningChances(centipawns: number): number {
  const ceiled = clamp(centipawns, -EVAL_CEILING_CP, EVAL_CEILING_CP)
  return clamp(2 / (1 + Math.exp(-WIN_PERCENT_MULTIPLIER * ceiled)) - 1, -1, 1)
}

/** The same thing as a percentage on `[0, 100]`, which is what the eval bar draws. */
export function winPercent(centipawns: number): number {
  return 50 + 50 * winningChances(centipawns)
}

/**
 * The win percentage for one side, from any engine score.
 *
 * `sideToMove` is whose turn it is in the position the score describes, because an engine
 * always reports from the mover's point of view; `pov` is whose chances you want.
 */
export function winPercentFromScore(score: EngineScore, sideToMove: Color, pov: Color): number {
  const white = winPercent(scoreToWhiteCentipawns(score, sideToMove))
  return pov === 'white' ? white : 100 - white
}

/**
 * How accurate one move was, given the mover's winning chances before and after it.
 *
 * A move that does not lose anything scores 100; from there accuracy decays exponentially
 * with the win percentage given away, so the first few points cost far more than the last
 * few — losing 5% takes you to about 84, losing 30% to about 29.
 */
export function moveAccuracy(winPercentBefore: number, winPercentAfter: number): Percent {
  if (winPercentAfter >= winPercentBefore) return 100
  const lost = winPercentBefore - winPercentAfter
  const raw = ACCURACY_SCALE * Math.exp(-ACCURACY_DECAY * lost) + ACCURACY_OFFSET
  return clamp(raw + ACCURACY_UNCERTAINTY_BONUS, 0, 100)
}

export interface AccuracyByColor {
  readonly white: Percent
  readonly black: Percent
}

export interface AccuracyOptions {
  /** Whose move the first evaluation follows. Only a game set up from a FEN differs. */
  readonly startColor?: Color
  /** The evaluation of the starting position, if it is not the standard array. */
  readonly initialCentipawns?: number
}

/** One half-move's contribution, which the review screen lists beside the move. */
export interface PlyAccuracy {
  readonly ply: number
  readonly color: Color
  readonly accuracy: Percent
  /** Volatility of the surrounding window; quiet positions weigh less than sharp ones. */
  readonly weight: number
  readonly winPercentBefore: number
  readonly winPercentAfter: number
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}

/** Population standard deviation, matching `scalalib.Maths.standardDeviation`. */
function standardDeviation(values: readonly number[]): number {
  const average = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)))
}

/** Floors each term at 1, matching `scalalib.Maths.harmonicMean`, so a 0 cannot swallow it. */
function harmonicMean(values: readonly number[]): number {
  return values.length / values.reduce((total, value) => total + 1 / Math.max(1, value), 0)
}

function weightedMean(pairs: readonly (readonly [number, number])[]): number | null {
  let weightedTotal = 0
  let weightTotal = 0
  for (const [value, weight] of pairs) {
    weightedTotal += value * weight
    weightTotal += weight
  }
  return weightTotal === 0 ? null : weightedTotal / weightTotal
}

/**
 * The volatility weight of each half-move.
 *
 * A window of consecutive win percentages is taken around each move and its standard
 * deviation becomes the weight, clamped to `[0.5, 12]`. Why: a tenth of a percent given
 * away in a dead-drawn rook ending is not the same mistake as a tenth of a percent in a
 * sharp middlegame, and weighting by how much the evaluation was moving anyway is what
 * stops a long, quiet technical phase from dominating a player's score.
 *
 * The first few moves have no window behind them, so they reuse the first full one — which
 * is the `List.fill` in Lichess's implementation, reproduced here.
 */
function volatilityWeights(allWinPercents: readonly number[], moveCount: number): number[] {
  const windowSize = clamp(Math.trunc(moveCount / 10), 2, 8)
  const windows: number[][] = []
  const leadIn = Math.min(windowSize, allWinPercents.length) - 2
  for (let index = 0; index < leadIn; index += 1) {
    windows.push(allWinPercents.slice(0, windowSize))
  }
  if (allWinPercents.length < windowSize) {
    windows.push([...allWinPercents])
  } else {
    for (let index = 0; index + windowSize <= allWinPercents.length; index += 1) {
      windows.push(allWinPercents.slice(index, index + windowSize))
    }
  }
  return windows.map((window) => clamp(standardDeviation(window), 0.5, 12))
}

/**
 * Score every half-move of a game.
 *
 * `whitePovCentipawns[i]` is the evaluation of the position reached *after* half-move `i`,
 * always from White's point of view. That convention is deliberate: an engine reports from
 * the mover's side, which alternates, and a list that silently alternates its own frame of
 * reference is the single easiest thing in this codebase to get backwards.
 */
export function plyAccuracies(
  whitePovCentipawns: readonly number[],
  options: AccuracyOptions = {},
): Result<PlyAccuracy[]> {
  if (whitePovCentipawns.length === 0) {
    return err(
      domainError('validation', 'A game with no evaluated moves has no accuracy', {
        where: 'accuracy',
      }),
    )
  }
  const startColor = options.startColor ?? 'white'
  const initial = options.initialCentipawns ?? INITIAL_CENTIPAWNS
  const all = [initial, ...whitePovCentipawns].map(winPercent)
  const weights = volatilityWeights(all, whitePovCentipawns.length)

  const out: PlyAccuracy[] = []
  for (let index = 0; index + 1 < all.length; index += 1) {
    const before = all[index]
    const after = all[index + 1]
    if (before === undefined || after === undefined) continue
    const movedByWhite = (index % 2 === 0) === (startColor === 'white')
    out.push({
      ply: index,
      color: movedByWhite ? 'white' : 'black',
      accuracy: movedByWhite ? moveAccuracy(before, after) : moveAccuracy(after, before),
      weight: weights[index] ?? 0.5,
      winPercentBefore: movedByWhite ? before : 100 - before,
      winPercentAfter: movedByWhite ? after : 100 - after,
    })
  }
  return ok(out)
}

/**
 * A whole game's accuracy, per side.
 *
 * The published figure is the mean of two means: the volatility-weighted mean, which says
 * how well you played when it mattered, and the harmonic mean, which refuses to let a
 * string of easy recaptures paper over one catastrophe. Neither alone reads honestly.
 */
export function gameAccuracy(
  whitePovCentipawns: readonly number[],
  options: AccuracyOptions = {},
): Result<AccuracyByColor> {
  const plies = plyAccuracies(whitePovCentipawns, options)
  if (!plies.ok) return plies

  const byColor = (color: Color): Percent | null => {
    const own = plies.value.filter((ply) => ply.color === color)
    if (own.length === 0) return null
    const weighted = weightedMean(own.map((ply) => [ply.accuracy, ply.weight] as const))
    if (weighted === null) return null
    const harmonic = harmonicMean(own.map((ply) => ply.accuracy))
    return clamp((weighted + harmonic) / 2, 0, 100)
  }

  const white = byColor('white')
  const black = byColor('black')
  if (white === null || black === null) {
    return err(
      domainError('validation', 'Both sides need at least one evaluated move', {
        where: 'accuracy',
      }),
    )
  }
  return ok({ white, black })
}

/**
 * The same, from the engine's own output.
 *
 * Each `EngineEval` carries the FEN it describes, so the side to move — and therefore the
 * frame of reference of its score — is read from the data rather than assumed.
 */
export function gameAccuracyFromEvals(
  evals: readonly EngineEval[],
  options: AccuracyOptions = {},
): Result<AccuracyByColor> {
  return gameAccuracy(
    evals.map((item) => scoreToWhiteCentipawns(item.score, sideToMoveOf(item.fen))),
    options,
  )
}
