import type { PuzzleSelection } from '@/data'
import { PUZZLE_BANDS } from '@/domain'
import type { LocalDate, Puzzle, PuzzleBand, PuzzleId } from '@/domain'

import { expectedSuccess, ratingForSuccess } from './rating'
import { hashSeed, weightedSample, type Rng } from './rng'

import type { GlickoRating } from './glicko2'
import type { ThemeMastery } from './mastery'

/**
 * Which puzzles to offer next.
 *
 * The sprint's target is a set the user solves about three times in four: hard enough
 * that finding the move is worth something, easy enough that the session is a pleasure
 * rather than a wall. That target is met in two steps, and both are pure functions so the
 * distribution can be asserted rather than hoped for:
 *
 * 1. **A rating window.** `ratingForSuccess(player, 0.75)` inverts the Glicko-2
 *    expectation, giving the puzzle rating this user solves 75% of the time —
 *    about 190 points below their own. The window is centred there.
 * 2. **A weighted draw inside it.** Candidates are scored on how close their expected
 *    success is to the target and on how much the user needs that theme, then sampled
 *    with those scores as weights, so the same ten puzzles are not served every day.
 *
 * The band curriculum (pawn → knight → bishop → rook → queen → king, ten rungs each)
 * decides *where in the catalogue* to look first; the rating window decides *how hard*.
 * When the curriculum's corner of the catalogue cannot fill a set, the ladder in
 * {@link selectionLadder} widens the query rather than shipping a three-puzzle session.
 */

/** The solve rate the whole selector aims at. */
export const TARGET_SUCCESS = 0.75

/** A set, as the hub's progress dots show it. */
export const SESSION_SIZE = 10

/** Half-width of the rating window around the target, in rating points. */
export const RATING_SPREAD = 150

/** First-try solves inside a band before the curriculum moves up a rung. */
export const SOLVES_PER_RUNG = 8

/** `sub_level` runs 1–10 within every band. */
export const RUNGS_PER_BAND = 10

/** How many candidates to pull per puzzle wanted, so the weighted draw has room. */
export const POOL_FACTOR = 6

/**
 * How sharply a candidate is penalised for being off-target.
 *
 * 0.18 means a puzzle the user is 55% or 95% likely to solve still gets picked sometimes
 * — variety the user can feel — while the middle of the distribution stays at 75%.
 */
export const SUCCESS_TOLERANCE = 0.18

/** Where the user is in the band curriculum. */
export interface CurriculumRung {
  readonly band: PuzzleBand
  readonly subLevel: number
  readonly solvedInBand: number
  /** Solves still needed before the next rung opens; 0 on the last rung of the last band. */
  readonly solvesToNextRung: number
  /** True once every band has been worked through; selection then drops the band filter. */
  readonly complete: boolean
}

const SOLVES_PER_BAND = SOLVES_PER_RUNG * RUNGS_PER_BAND

/**
 * The rung the user is on, from their solves per band.
 *
 * Why solves and not attempts: the curriculum is a record of what has been learned, and a
 * puzzle that was missed has not taught its pattern yet. Missing one never moves the user
 * backwards either — nothing here is a punishment.
 */
export function curriculumRung(solvedByBand: Partial<Record<PuzzleBand, number>>): CurriculumRung {
  for (const band of PUZZLE_BANDS) {
    const solved = Math.max(solvedByBand[band] ?? 0, 0)
    if (solved < SOLVES_PER_BAND) {
      const subLevel = Math.min(Math.floor(solved / SOLVES_PER_RUNG) + 1, RUNGS_PER_BAND)
      return {
        band,
        subLevel,
        solvedInBand: solved,
        solvesToNextRung: SOLVES_PER_RUNG - (solved % SOLVES_PER_RUNG),
        complete: false,
      }
    }
  }
  const last = PUZZLE_BANDS[PUZZLE_BANDS.length - 1] ?? 'king'
  return {
    band: last,
    subLevel: RUNGS_PER_BAND,
    solvedInBand: solvedByBand[last] ?? 0,
    solvesToNextRung: 0,
    complete: true,
  }
}

/** The rating window a set is drawn from, centred on the 75% point. */
export interface RatingWindow {
  readonly target: number
  readonly min: number
  readonly max: number
}

export function ratingWindow(
  player: GlickoRating,
  options: {
    readonly targetSuccess?: number | undefined
    readonly spread?: number | undefined
  } = {},
): RatingWindow {
  const target = ratingForSuccess(player, options.targetSuccess ?? TARGET_SUCCESS)
  const spread = options.spread ?? RATING_SPREAD
  return { target, min: Math.round(target - spread), max: Math.round(target + spread) }
}

export interface SelectionPlanInput {
  readonly player: GlickoRating
  readonly rung: CurriculumRung
  /** The theme the hub is featuring today, if any. */
  readonly theme?: string | undefined
  readonly excludeIds?: readonly PuzzleId[] | undefined
  readonly count?: number | undefined
  readonly targetSuccess?: number | undefined
  readonly spread?: number | undefined
}

/**
 * One rung of the ladder: a label for why these puzzles were offered, and the queries
 * whose results are pooled together.
 */
export interface LadderRung {
  readonly label: string
  readonly queries: readonly PuzzleSelection[]
}

/**
 * How many narrow slices a rating window is asked for.
 *
 * Why the window is not one query: `puzzlesRepo.select` returns rows in the order of the
 * index it used, which is rating-ascending, and `limit` truncates. Asking for "the first
 * 60 puzzles between 1160 and 1460" therefore returns the *easiest* 60 — a selector that
 * claims 75% and quietly serves 85%. Slicing the window and taking a few from each slice
 * keeps the pool spread across the window, so the weighting below decides the difficulty
 * rather than the storage layer's iteration order. The simulation in `simulation.test.ts`
 * is what caught this.
 */
export const WINDOW_SLICES = 4

/** At least this many candidates per slice, so a thin slice still offers a choice. */
const MIN_SLICE_LIMIT = 4

function slicedQueries(
  base: PuzzleSelection,
  window: { readonly min: number; readonly max: number },
  limit: number,
): PuzzleSelection[] {
  const width = (window.max - window.min) / WINDOW_SLICES
  const perSlice = Math.max(Math.ceil(limit / WINDOW_SLICES), MIN_SLICE_LIMIT)
  return Array.from({ length: WINDOW_SLICES }, (_unused, index) => ({
    ...base,
    minRating: Math.round(window.min + index * width),
    maxRating: Math.round(window.min + (index + 1) * width),
    limit: perSlice,
  }))
}

/**
 * Rungs to try in order, widening until one fills the pool.
 *
 * Why a ladder rather than one clever query: the catalogue is not evenly spread — the
 * pawn band holds 200 puzzles and the king band 4,400 — so a beginner's rung plus a
 * narrow rating window can legitimately hold nothing. Widening in a fixed, inspectable
 * order keeps "why did I get this puzzle?" answerable, which a single fuzzy scoring query
 * over the whole table would not.
 */
export function selectionLadder(input: SelectionPlanInput): LadderRung[] {
  const spread = input.spread ?? RATING_SPREAD
  const window = ratingWindow(input.player, {
    targetSuccess: input.targetSuccess,
    spread,
  })
  const limit = (input.count ?? SESSION_SIZE) * POOL_FACTOR
  const base: PuzzleSelection = {
    ...(input.excludeIds === undefined ? {} : { excludeIds: input.excludeIds }),
    limit,
  }
  const wide = {
    min: Math.round(window.target - spread * 2.5),
    max: Math.round(window.target + spread * 2.5),
  }

  const rungs: LadderRung[] = []
  if (input.theme !== undefined) {
    rungs.push({
      label: `${input.theme} at your level`,
      queries: slicedQueries({ ...base, theme: input.theme }, window, limit),
    })
  }
  if (!input.rung.complete) {
    rungs.push({
      label: `${input.rung.band} ${String(input.rung.subLevel)} at your level`,
      queries: slicedQueries(
        { ...base, band: input.rung.band, subLevel: input.rung.subLevel },
        window,
        limit,
      ),
    })
    rungs.push({
      label: `the ${input.rung.band} band at your level`,
      queries: slicedQueries({ ...base, band: input.rung.band }, window, limit),
    })
  }
  rungs.push({ label: 'your level', queries: slicedQueries(base, window, limit) })
  if (input.theme !== undefined) {
    rungs.push({
      label: `${input.theme}, a wider range`,
      queries: slicedQueries({ ...base, theme: input.theme }, wide, limit),
    })
  }
  rungs.push({ label: 'a wider range', queries: slicedQueries(base, wide, limit) })
  // The last rung asks only that the puzzle is one the user has not just seen: an empty
  // session is the one outcome the runner cannot recover from.
  rungs.push({ label: 'anything new', queries: [base] })
  return rungs
}

/**
 * How much each theme should be favoured, from 0.5 (solid) to 2.5 (barely seen through).
 *
 * A theme with no history sits at 1: neither pushed nor avoided, which is how a new user
 * gets shown the whole board rather than the two themes they happened to meet first.
 */
export function themeWeights(mastery: readonly ThemeMastery[]): Map<string, number> {
  const weights = new Map<string, number>()
  for (const entry of mastery) {
    weights.set(entry.theme, 0.5 + 2 * (1 - Math.min(Math.max(entry.mastery, 0), 1)))
  }
  return weights
}

export interface PickInput {
  readonly player: GlickoRating
  readonly count?: number | undefined
  readonly rng: Rng
  readonly weights?: ReadonlyMap<string, number> | undefined
  readonly targetSuccess?: number | undefined
}

/** How well one candidate fits the target success rate, 0–1. */
export function ratingFit(
  player: GlickoRating,
  puzzle: Puzzle,
  targetSuccess = TARGET_SUCCESS,
): number {
  const distance = (expectedSuccess(player, puzzle.rating) - targetSuccess) / SUCCESS_TOLERANCE
  return Math.exp(-(distance * distance))
}

/** The weight a candidate carries into the draw: how well it fits, times how needed it is. */
export function candidateWeight(puzzle: Puzzle, input: PickInput): number {
  const fit = ratingFit(input.player, puzzle, input.targetSuccess)
  const themeWeight = input.weights?.get(puzzle.theme) ?? 1
  return fit * themeWeight
}

/**
 * The set itself: a weighted draw from the candidates, easiest first.
 *
 * Ordering by rating rather than by weight is deliberate. A set that opens with its
 * hardest puzzle reads as a wall; one that warms up reads as a session.
 */
export function pickSession(candidates: readonly Puzzle[], input: PickInput): Puzzle[] {
  const count = input.count ?? SESSION_SIZE
  const seen = new Set<PuzzleId>()
  const unique = candidates.filter((puzzle) => {
    if (seen.has(puzzle.id)) return false
    seen.add(puzzle.id)
    return puzzle.active
  })
  const drawn = weightedSample(unique, (puzzle) => candidateWeight(puzzle, input), count, input.rng)
  return drawn.sort((left, right) => left.rating - right.rating)
}

/** The mean success rate a set is expected to produce — what the 75% claim is checked against. */
export function expectedSetSuccess(
  player: GlickoRating,
  puzzles: readonly Puzzle[],
): number | null {
  if (puzzles.length === 0) return null
  const total = puzzles.reduce((sum, puzzle) => sum + expectedSuccess(player, puzzle.rating), 0)
  return total / puzzles.length
}

/**
 * The index of the day's puzzle in the catalogue's stable id order.
 *
 * Deterministic by date and nothing else: the same day gives the same puzzle on every
 * device, before any account or sync exists, which is the only way a "daily puzzle" can
 * mean anything in an offline, single-user app.
 */
export function dailyPuzzleIndex(day: LocalDate, total: number): number {
  if (total <= 0) return 0
  return hashSeed(`chess-king-daily:${day}`) % total
}

/** The seed a daily session draws with, so its order is the same everywhere too. */
export function dailySeed(day: LocalDate): number {
  return hashSeed(`chess-king-daily-seed:${day}`)
}
