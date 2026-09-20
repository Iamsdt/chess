/**
 * Glicko-2, written out in full.
 *
 * Why here and not in a package: the algorithm is eighty lines, it has published
 * reference values to test against, and every dependency-free implementation on npm
 * either carries a rating-period model this app does not have (one puzzle at a time,
 * whenever the user feels like it) or hides the deviation, which is the number that
 * makes the first twenty puzzles move the rating quickly and the next two hundred move
 * it slowly.
 *
 * The maths follows Mark Glickman's paper "Example of the Glicko-2 system"
 * (glicko.net/glicko/glicko2.pdf) exactly, including the Illinois root finder for the
 * volatility, so `glicko2.test.ts` can assert against the worked example in it.
 *
 * Everything here is pure arithmetic: no storage, no React, no chess.
 */

/** The paper's conversion factor between the Glicko and Glicko-2 scales. */
export const GLICKO2_SCALE = 173.7178

/** An unrated player. 1500/350 is the paper's own starting point. */
export const DEFAULT_RATING = 1500
export const DEFAULT_DEVIATION = 350
export const DEFAULT_VOLATILITY = 0.06

/**
 * τ, the system constant: how much the volatility may move in one update.
 *
 * Glickman suggests 0.3–1.2, smaller for a system that should not swing on one
 * surprising result. Puzzles arrive in ones, so this app sits at the cautious end.
 */
export const DEFAULT_SYSTEM_CONSTANT = 0.5

/** ε in the paper — the convergence tolerance of the volatility iteration. */
export const CONVERGENCE_TOLERANCE = 0.000_001

/** Guard for the root finder; the paper's iteration converges in well under ten steps. */
const MAX_ITERATIONS = 100

/** A rating that has stopped meaning anything is not useful; the paper caps at 350. */
export const MAX_DEVIATION = DEFAULT_DEVIATION

/**
 * A floor under the deviation.
 *
 * Why: with no floor a few hundred puzzles drive RD low enough that the rating stops
 * responding to a genuine change in strength, which is exactly what a learning app must
 * not do. 30 is the value Glickman uses for the same reason.
 */
export const MIN_DEVIATION = 30

/** A player's full state. The rating alone is not enough to update it. */
export interface GlickoRating {
  readonly rating: number
  readonly deviation: number
  readonly volatility: number
}

/** One result inside a rating period: who it was against, and how it went. */
export interface GlickoResult {
  readonly rating: number
  readonly deviation: number
  /** 1 win, 0 loss, anything between for a partial credit (this app: hinted solves). */
  readonly score: number
}

export interface Glicko2Options {
  /** τ. Defaults to {@link DEFAULT_SYSTEM_CONSTANT}. */
  readonly tau?: number | undefined
  readonly tolerance?: number | undefined
  readonly minDeviation?: number | undefined
  readonly maxDeviation?: number | undefined
}

interface Settings {
  readonly tau: number
  readonly tolerance: number
  readonly minDeviation: number
  readonly maxDeviation: number
}

function settingsOf(options: Glicko2Options | undefined): Settings {
  return {
    tau: options?.tau ?? DEFAULT_SYSTEM_CONSTANT,
    tolerance: options?.tolerance ?? CONVERGENCE_TOLERANCE,
    minDeviation: options?.minDeviation ?? MIN_DEVIATION,
    maxDeviation: options?.maxDeviation ?? MAX_DEVIATION,
  }
}

/** Step 2 of the paper: the Glicko scale (rating, RD) → the Glicko-2 scale (µ, φ). */
const toMu = (rating: number): number => (rating - DEFAULT_RATING) / GLICKO2_SCALE
const toPhi = (deviation: number): number => deviation / GLICKO2_SCALE

/** g(φ): how much weight an opponent's result carries, given how sure we are of them. */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI))
}

/** E(µ, µⱼ, φⱼ): the expected score against one opponent. */
function expectation(mu: number, opponentMu: number, opponentPhi: number): number {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)))
}

/**
 * The expected score, on the Glicko scale everything else in the app speaks.
 *
 * Why exported: the selector inverts this to choose a puzzle the user solves about three
 * times in four, and the solver shows the resulting rating change before it is written.
 */
export function expectedScore(
  player: GlickoRating,
  opponent: { readonly rating: number; readonly deviation: number },
): number {
  return expectation(toMu(player.rating), toMu(opponent.rating), toPhi(opponent.deviation))
}

/**
 * Step 5's f(x), whose root is ln(σ'²).
 *
 * Kept as its own function because the Illinois iteration below evaluates it at three
 * different points and the paper's own presentation does the same.
 */
function volatilityFunction(
  x: number,
  delta: number,
  phi: number,
  v: number,
  a: number,
  tau: number,
): number {
  const exp = Math.exp(x)
  const phiSquared = phi * phi
  const numerator = exp * (delta * delta - phiSquared - v - exp)
  const denominator = 2 * (phiSquared + v + exp) * (phiSquared + v + exp)
  return numerator / denominator - (x - a) / (tau * tau)
}

/** Step 5: the new volatility, by the paper's Illinois (regula falsi) algorithm. */
function newVolatility(
  volatility: number,
  delta: number,
  phi: number,
  v: number,
  settings: Settings,
): number {
  const a = Math.log(volatility * volatility)
  let A = a
  let B: number
  const deltaSquared = delta * delta
  const phiSquared = phi * phi

  if (deltaSquared > phiSquared + v) {
    B = Math.log(deltaSquared - phiSquared - v)
  } else {
    let k = 1
    while (
      volatilityFunction(a - k * settings.tau, delta, phi, v, a, settings.tau) < 0 &&
      k < MAX_ITERATIONS
    ) {
      k += 1
    }
    B = a - k * settings.tau
  }

  let fA = volatilityFunction(A, delta, phi, v, a, settings.tau)
  let fB = volatilityFunction(B, delta, phi, v, a, settings.tau)

  for (let step = 0; Math.abs(B - A) > settings.tolerance && step < MAX_ITERATIONS; step += 1) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = volatilityFunction(C, delta, phi, v, a, settings.tau)
    if (fC * fB <= 0) {
      A = B
      fA = fB
    } else {
      fA /= 2
    }
    B = C
    fB = fC
  }

  return Math.exp(A / 2)
}

/**
 * One rating period.
 *
 * Passing an empty `results` is the paper's step 6 "did not compete" case: the rating
 * stands and the deviation grows, which is how a month away from the app makes the next
 * session count for more.
 */
export function updateRating(
  player: GlickoRating,
  results: readonly GlickoResult[],
  options?: Glicko2Options,
): GlickoRating {
  const settings = settingsOf(options)
  const mu = toMu(player.rating)
  const phi = toPhi(Math.min(player.deviation, settings.maxDeviation))

  if (results.length === 0) {
    const phiStar = Math.sqrt(phi * phi + player.volatility * player.volatility)
    return {
      rating: player.rating,
      deviation: clampDeviation(phiStar * GLICKO2_SCALE, settings),
      volatility: player.volatility,
    }
  }

  // Step 3 and 4: the estimated variance, and the estimated improvement.
  let variancePart = 0
  let deltaPart = 0
  for (const result of results) {
    const opponentMu = toMu(result.rating)
    const opponentPhi = toPhi(result.deviation)
    const gj = g(opponentPhi)
    const e = expectation(mu, opponentMu, opponentPhi)
    variancePart += gj * gj * e * (1 - e)
    deltaPart += gj * (result.score - e)
  }
  const v = 1 / variancePart
  const delta = v * deltaPart

  // Step 5, 6 and 7: volatility, pre-period deviation, then the new rating.
  const volatility = newVolatility(player.volatility, delta, phi, v, settings)
  const phiStar = Math.sqrt(phi * phi + volatility * volatility)
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const newMu = mu + newPhi * newPhi * deltaPart

  return {
    rating: newMu * GLICKO2_SCALE + DEFAULT_RATING,
    deviation: clampDeviation(newPhi * GLICKO2_SCALE, settings),
    volatility,
  }
}

function clampDeviation(deviation: number, settings: Settings): number {
  return Math.min(Math.max(deviation, settings.minDeviation), settings.maxDeviation)
}

/**
 * The deviation after `periods` rating periods with nothing played.
 *
 * Why it is its own function: the app has no fixed rating period, so idleness is applied
 * when the user comes back rather than on a schedule. A "period" here is a day of not
 * solving anything.
 */
export function decayDeviation(
  player: GlickoRating,
  periods: number,
  options?: Glicko2Options,
): GlickoRating {
  if (periods <= 0) return player
  const settings = settingsOf(options)
  const phi = toPhi(player.deviation)
  const grown = Math.sqrt(phi * phi + periods * player.volatility * player.volatility)
  return { ...player, deviation: clampDeviation(grown * GLICKO2_SCALE, settings) }
}

/** The ±2 RD band the UI prints as "somewhere around here"; 95% under the model. */
export function ratingInterval(player: GlickoRating): {
  readonly low: number
  readonly high: number
} {
  return { low: player.rating - 2 * player.deviation, high: player.rating + 2 * player.deviation }
}
