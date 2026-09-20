import {
  emptyMoveQualityCounts,
  oppositeColor,
  type Color,
  type EngineScore,
  type Fen,
  type MoveQuality,
  type MoveQualityCounts,
  type Uci,
} from '@/domain'

import { winPercentFromScore } from './accuracy'
import { staticExchangeEvaluation } from './material'

/**
 * Turning "the evaluation went from here to there" into one of the ten words the review
 * screen puts beside a move.
 *
 * The ten words are `MOVE_QUALITIES` in `@/domain`, and `--q-brilliant … --q-blunder` in
 * `globals.css` colour them. This module is the only thing that decides which one a move
 * gets, and it is pure: evaluations in, a word out. No engine, no board state beyond the
 * position the move was played from.
 *
 * ## How a move is measured
 *
 * Not in centipawns. A centipawn is not a constant unit of anything — going from +900 to
 * +600 is a rounding error and going from +30 to −270 is losing the game, and both are
 * "300 centipawns". Every threshold below is instead stated in **win percentage given
 * away**, on the curve in `accuracy.ts`, which is roughly linear where games are actually
 * decided and flat where they are not.
 *
 * ## The thresholds, and why each one is where it is
 *
 * The three that punish are Lichess's, so that this app and the rest of the chess world
 * call the same move a blunder. They were confirmed against 40 Lichess-analysed games:
 * every move Lichess called an inaccuracy had given away between 5.0 and 10.0 win
 * percent, every mistake between 10.0 and 15.0, and every blunder more than 15.0.
 *
 * | Verdict      | Rule                                                                   |
 * | ------------ | ---------------------------------------------------------------------- |
 * | `book`       | the position is still in the bundled opening table                      |
 * | `miss`       | ≥ 10 lost, *and* a won game is no longer won                            |
 * | `blunder`    | more than 15 lost                                                       |
 * | `mistake`    | more than 10 lost                                                       |
 * | `inaccuracy` | more than 5 lost                                                        |
 * | `brilliant`  | ≤ 2 lost, a sound sacrifice, in a game not already won — or one that forces mate |
 * | `great`      | ≤ 2 lost, and every other move would have lost ≥ 10                     |
 * | `best`       | ≤ 2 lost, and it is the move the engine chose                           |
 * | `excellent`  | ≤ 2 lost                                                                |
 * | `good`       | anything left, which is more than 2 and at most 5 lost                  |
 *
 * The rules are tried in that order, so the earlier ones win. Two of those orderings are
 * deliberate and worth stating:
 *
 * - **`miss` outranks `blunder`.** Throwing away a won game and walking into a lost one
 *   are different mistakes and want different coaching. A player who was at 95% and is now
 *   at 40% needs to be shown the win they had, not told off.
 * - **`brilliant` and `great` outrank `best`.** A sacrifice the engine also likes is more
 *   interesting than a recapture the engine also likes, and the badge should say so.
 *
 * And two that are about honesty rather than order:
 *
 * - **`book` is not praise.** It means "theory played this for you", which is why it is
 *   first: a player deserves neither credit nor blame for a move out of a table.
 * - **`brilliant` needs proof, not enthusiasm.** A move is only brilliant if it gives up
 *   real material by exchange (`staticExchangeEvaluation`), keeps the evaluation, and is
 *   played in a game still worth winning. Without the position it was played from this
 *   module cannot check any of that, and so never awards it.
 */

/** Win percentage given away, above which a move stops being merely imperfect. */
export const INACCURACY_LOSS = 5
export const MISTAKE_LOSS = 10
export const BLUNDER_LOSS = 15

/**
 * How much may be given away and still count as playing well.
 *
 * Why 2 and not 0: the engine's own evaluation moves by a point or two between depths, and
 * blaming a player for noise teaches them nothing.
 */
export const FORGIVEN_LOSS = 2

/** Above this, the mover was winning; below the other, they no longer are. */
export const WON_GAME_WIN_PERCENT = 85
export const LOST_THE_WIN_WIN_PERCENT = 60

/** A move is only "great" if the alternatives were this much worse — i.e. it was the move. */
export const ONLY_MOVE_MARGIN = 10

/**
 * Material a move must give up by exchange before it can be called a sacrifice, in
 * centipawns. Two pawns: a piece for a pawn, an exchange, a clean pawn-and-a-bit — enough
 * that no one would play it by accident.
 */
export const SACRIFICE_CENTIPAWNS = -200

/**
 * A sacrifice in a game that is already won is a flourish, not a brilliancy, and one that
 * leaves the mover worse is not sound however pretty it looks.
 *
 * The exception is a sacrifice that forces mate. That is precisely the move people mean
 * by "brilliant" — Morphy's 16.Qb8+ in the Opera Game comes from a position that was
 * already winning, and calling it merely excellent would be absurd.
 */
export const ALREADY_WON_WIN_PERCENT = 90
export const SOUND_SACRIFICE_WIN_PERCENT = 50

/** Everything the classifier is allowed to know. Missing pieces narrow the verdict, never guess it. */
export interface MoveClassificationInput {
  readonly mover: Color
  /** The engine's evaluation of the position the move was played from, mover to move. */
  readonly scoreBefore: EngineScore
  /** The engine's evaluation of the position the move produced, opponent to move. */
  readonly scoreAfter: EngineScore
  readonly playedUci: Uci
  /** The engine's own choice in the position before. Needed for `best`. */
  readonly bestUci?: Uci | undefined
  /** MultiPV line 2 in the position before, mover to move. Needed for `great`. */
  readonly secondBestScore?: EngineScore | undefined
  /** The position the move was played from. Needed for `brilliant`. */
  readonly fenBefore?: Fen | undefined
  /** True when the position is still in the opening table; see `isBookPosition`. */
  readonly isBook?: boolean | undefined
}

/** The reasoning behind a verdict, so the review can explain itself without re-deriving it. */
export interface MoveClassification {
  readonly quality: MoveQuality
  /** Win percentage the mover had before the move. */
  readonly winPercentBefore: number
  /** Win percentage the mover had after it. */
  readonly winPercentAfter: number
  /** How much was given away; negative when the evaluation improved. */
  readonly winPercentLost: number
  /** Material given up by exchange, in centipawns, when the position was supplied. */
  readonly exchangeCentipawns?: number
}

function isSoundSacrifice(
  input: MoveClassificationInput,
  winPercentBefore: number,
  winPercentAfter: number,
  exchange: number | undefined,
): boolean {
  if (exchange === undefined || exchange > SACRIFICE_CENTIPAWNS) return false
  if (winPercentAfter < SOUND_SACRIFICE_WIN_PERCENT) return false
  // `scoreAfter` is from the opponent, so a mate against them is a negative distance.
  const forcesMate = input.scoreAfter.kind === 'mate' && input.scoreAfter.moves <= 0
  return forcesMate || winPercentBefore < ALREADY_WON_WIN_PERCENT
}

function isOnlyMove(input: MoveClassificationInput, winPercentBefore: number): boolean {
  if (input.secondBestScore === undefined) return false
  const second = winPercentFromScore(input.secondBestScore, input.mover, input.mover)
  return winPercentBefore - second >= ONLY_MOVE_MARGIN
}

/** The full verdict, with the numbers it was reached from. */
export function classifyMoveDetailed(input: MoveClassificationInput): MoveClassification {
  const winPercentBefore = winPercentFromScore(input.scoreBefore, input.mover, input.mover)
  const winPercentAfter = winPercentFromScore(
    input.scoreAfter,
    oppositeColor(input.mover),
    input.mover,
  )
  const winPercentLost = winPercentBefore - winPercentAfter

  const exchangeResult =
    input.fenBefore === undefined
      ? undefined
      : staticExchangeEvaluation(input.fenBefore, input.playedUci)
  const exchange = exchangeResult?.ok === true ? exchangeResult.value : undefined
  const detail = {
    winPercentBefore,
    winPercentAfter,
    winPercentLost,
    ...(exchange === undefined ? {} : { exchangeCentipawns: exchange }),
  }

  const quality = ((): MoveQuality => {
    if (input.isBook === true) return 'book'
    if (
      winPercentLost >= MISTAKE_LOSS &&
      winPercentBefore >= WON_GAME_WIN_PERCENT &&
      winPercentAfter < LOST_THE_WIN_WIN_PERCENT
    ) {
      return 'miss'
    }
    if (winPercentLost > BLUNDER_LOSS) return 'blunder'
    if (winPercentLost > MISTAKE_LOSS) return 'mistake'
    if (winPercentLost > INACCURACY_LOSS) return 'inaccuracy'
    if (winPercentLost <= FORGIVEN_LOSS) {
      if (isSoundSacrifice(input, winPercentBefore, winPercentAfter, exchange)) return 'brilliant'
      if (isOnlyMove(input, winPercentBefore)) return 'great'
      if (input.bestUci !== undefined && input.bestUci === input.playedUci) return 'best'
      return 'excellent'
    }
    return 'good'
  })()

  return { quality, ...detail }
}

/** The verdict alone, which is all most callers store. */
export function classifyMove(input: MoveClassificationInput): MoveQuality {
  return classifyMoveDetailed(input).quality
}

/** Why: the review's Summary table is a count per side, and building it by hand invites a typo. */
export function countMoveQualities(
  moves: readonly { readonly color: Color; readonly quality: MoveQuality }[],
): { readonly white: MoveQualityCounts; readonly black: MoveQualityCounts } {
  const white = emptyMoveQualityCounts()
  const black = emptyMoveQualityCounts()
  for (const move of moves) {
    const counts = move.color === 'white' ? white : black
    counts[move.quality] += 1
  }
  return { white, black }
}
