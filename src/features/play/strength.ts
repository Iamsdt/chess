import { legalMoves, staticExchangeEvaluation } from '@/chess'
import type { ChessGame } from '@/chess'
import type { Uci } from '@/domain'
import { MAX_UCI_ELO, MIN_STRENGTH_ELO } from '@/engine'

/**
 * How a rating on the setup slider becomes an opponent.
 *
 * Stockfish has exactly two strength dials and neither of them, on its own, plays
 * like a human of a given rating:
 *
 * - `UCI_Elo` is Stockfish's own scale and **stops at 1320**. Below that,
 *   `@/engine`'s `strengthOptions` pins the limiter to its floor and hands the
 *   rest of the handicap to `Skill Level`, which makes the engine sometimes
 *   prefer a worse move. That is closer to a beginner than a weak but flawless
 *   player, yet it still never leaves a queen on a square.
 * - **Search time** is the other half. A 150 ms search is shallow, and shallow is
 *   what produces the *tactical* oversights a human makes, rather than the
 *   uniformly grey moves a depth-limited-but-perfect engine makes. It also keeps
 *   the low levels feeling friendly: a 400 opponent answers in about a fifth of a
 *   second instead of making the learner wait to be beaten.
 * - **Deliberate inaccuracy** is the third, because neither of the first two ever
 *   produces the thing that actually decides games at club level: a hung piece.
 *   With probability {@link EngineStrengthPlan.inaccuracyChance} the opponent
 *   ignores the engine and plays another legal move, drawn only from moves whose
 *   static exchange evaluation stays above
 *   {@link EngineStrengthPlan.inaccuracyCeilingCp} — so a 400 may drop a queen and
 *   a 2000 may, at worst and rarely, drop a pawn.
 *
 * The numbers below are a **dial, not a calibration**. They were chosen to make
 * each band feel right and to interpolate smoothly; no one has played a thousand
 * games at each anchor to verify the resulting Elo. `@/engine/options.ts` says the
 * same thing about `UCI_Elo` itself, and this module inherits that honesty.
 */

export const OPPONENT_RATING_MIN = 400
export const OPPONENT_RATING_MAX = 2400
/** The slider's granularity, matching `prototype/play-setup.html`. */
export const OPPONENT_RATING_STEP = 50

/** Anything this far below the exchange-neutral line counts as dropping material. */
export const HANGING_THRESHOLD_CP = 150

export interface StrengthAnchor {
  /** The rating printed on the slider. */
  readonly rating: number
  /** Passed straight to `engine.bestMove({ elo })`; `@/engine` turns it into UCI. */
  readonly elo: number
  readonly movetimeMs: number
  /** 0–1. How often the opponent plays something other than the engine's choice. */
  readonly inaccuracyChance: number
  /** The worst exchange, in centipawns, an inaccuracy is allowed to walk into. */
  readonly inaccuracyCeilingCp: number
}

/**
 * The anchors the mapping interpolates between.
 *
 * `elo` is the rating itself from 1200 up, because from there `@/engine` passes it
 * to `UCI_Elo` unchanged and restating it as some other number would only hide
 * where the handicap comes from. Below 1200 it ramps down to Stockfish's floor of
 * 600, where `@/engine` converts it into a Skill Level (`round((elo - 600) / 72)`,
 * capped at 10): 400 → skill 0, 800 → skill 3, 1200 → skill 8.
 */
const GENTLEST: StrengthAnchor = {
  rating: 400,
  elo: 600,
  movetimeMs: 150,
  inaccuracyChance: 0.3,
  inaccuracyCeilingCp: 900,
}

const SHARPEST: StrengthAnchor = {
  rating: 2400,
  elo: 2400,
  movetimeMs: 1200,
  inaccuracyChance: 0,
  inaccuracyCeilingCp: 0,
}

export const STRENGTH_ANCHORS: readonly StrengthAnchor[] = [
  GENTLEST,
  { rating: 800, elo: 800, movetimeMs: 200, inaccuracyChance: 0.18, inaccuracyCeilingCp: 500 },
  { rating: 1200, elo: 1200, movetimeMs: 300, inaccuracyChance: 0.1, inaccuracyCeilingCp: 320 },
  { rating: 1600, elo: 1600, movetimeMs: 500, inaccuracyChance: 0.05, inaccuracyCeilingCp: 180 },
  { rating: 2000, elo: 2000, movetimeMs: 800, inaccuracyChance: 0.02, inaccuracyCeilingCp: 120 },
  SHARPEST,
]

export interface EngineStrengthPlan extends StrengthAnchor {
  /** What `engine.bestMove` should be asked for; a personality needs 3 lines. */
  readonly multiPv: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

/** Why: every field of the plan interpolates the same way; only rounding differs. */
function interpolate(rating: number): StrengthAnchor {
  if (rating <= GENTLEST.rating) return GENTLEST
  if (rating >= SHARPEST.rating) return SHARPEST
  for (let index = 1; index < STRENGTH_ANCHORS.length; index += 1) {
    const upper = STRENGTH_ANCHORS[index]
    const lower = STRENGTH_ANCHORS[index - 1]
    if (upper === undefined || lower === undefined) continue
    if (rating > upper.rating) continue
    const t = (rating - lower.rating) / (upper.rating - lower.rating)
    return {
      rating,
      elo: Math.round(lerp(lower.elo, upper.elo, t)),
      movetimeMs: Math.round(lerp(lower.movetimeMs, upper.movetimeMs, t)),
      inaccuracyChance: lerp(lower.inaccuracyChance, upper.inaccuracyChance, t),
      inaccuracyCeilingCp: Math.round(
        lerp(lower.inaccuracyCeilingCp, upper.inaccuracyCeilingCp, t),
      ),
    }
  }
  return SHARPEST
}

/** The opponent the slider describes, as three numbers the engine and the move
 *  picker can act on. Pure, so the mapping is testable without an engine. */
export function planStrength(rating: number, multiPv = 1): EngineStrengthPlan {
  const wanted = clamp(Math.round(rating), OPPONENT_RATING_MIN, OPPONENT_RATING_MAX)
  const anchor = interpolate(wanted)
  return {
    ...anchor,
    rating: wanted,
    elo: clamp(anchor.elo, MIN_STRENGTH_ELO, MAX_UCI_ELO),
    inaccuracyChance: Number(anchor.inaccuracyChance.toFixed(4)),
    multiPv,
  }
}

/** The five bands the setup screen labels the slider with. */
export type StrengthBand = 'gentle' | 'learning' | 'club' | 'strong' | 'expert'

export function strengthBand(rating: number): StrengthBand {
  if (rating < 800) return 'gentle'
  if (rating < 1200) return 'learning'
  if (rating < 1700) return 'club'
  if (rating < 2100) return 'strong'
  return 'expert'
}

/**
 * Expected score for the player, on the standard Elo logistic.
 *
 * Why it is here and not in the screen: the setup screen prints it ("≈55% win
 * chance"), the summary card repeats it, and a number the user reads twice should
 * be computed once.
 */
export function expectedScore(yourRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - yourRating) / 400))
}

export interface OpponentMoveChoice {
  readonly uci: Uci
  /** True when the opponent played something the engine did not choose. */
  readonly deliberateInaccuracy: boolean
}

/**
 * Let the opponent be human for a move.
 *
 * `random` is injected so the behaviour is a pure function of its inputs and the
 * tests never have to stub a global. The candidate filter is the whole point: an
 * inaccuracy at 2000 is a misjudged pawn, and at 400 it is a hung queen, and the
 * only difference between them is `inaccuracyCeilingCp`.
 */
export function chooseOpponentMove(
  game: ChessGame,
  engineMove: Uci,
  plan: EngineStrengthPlan,
  random: () => number,
): OpponentMoveChoice {
  if (plan.inaccuracyChance <= 0 || random() >= plan.inaccuracyChance) {
    return { uci: engineMove, deliberateInaccuracy: false }
  }
  const candidates = legalMoves(game).filter((move) => {
    if (move.uci === engineMove) return false
    const exchange = staticExchangeEvaluation(game.fen, move.uci)
    return exchange.ok && exchange.value >= -plan.inaccuracyCeilingCp
  })
  const pick = candidates[Math.floor(random() * candidates.length)]
  if (pick === undefined) return { uci: engineMove, deliberateInaccuracy: false }
  return { uci: pick.uci, deliberateInaccuracy: true }
}

/**
 * Whether the engine opponent takes a draw.
 *
 * A real engine has no opinion about draw offers, so this is the app's opinion,
 * written down where it can be tested. It accepts when its own evaluation says it
 * is worse, and in a long, dead-level game where playing on would only be
 * stubborn. With no evaluation to hand — the engine has not searched yet — it
 * declines, because "I have not looked" is not a reason to agree.
 *
 * `evalCp` is centipawns **from the engine's own point of view**.
 */
export const DRAW_ACCEPT_WORSE_CP = -100
export const DRAW_ACCEPT_LEVEL_CP = 25
export const DRAW_ACCEPT_LEVEL_PLY = 60

export function respondToDrawOffer(evalCp: number | null, ply: number): boolean {
  if (evalCp === null) return false
  if (evalCp <= DRAW_ACCEPT_WORSE_CP) return true
  return Math.abs(evalCp) <= DRAW_ACCEPT_LEVEL_CP && ply >= DRAW_ACCEPT_LEVEL_PLY
}
