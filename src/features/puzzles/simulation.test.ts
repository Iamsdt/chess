import { describe, expect, it } from 'vitest'

import type { PuzzleSelection } from '@/data'
import { makePuzzle, toPuzzleId, type Puzzle, type PuzzleId } from '@/domain'

import { applyAttempt, DEFAULT_RATING_STATE, expectedSuccess } from './rating'
import { seededRng, type Rng } from './rng'
import { curriculumRung, pickSession, selectionLadder } from './selection'

import type { GlickoRating } from './glicko2'

/**
 * Does the loop actually work?
 *
 * The unit tests say Glicko-2 matches the paper and that the selector aims at 75%. This
 * file runs the two together the way the app does — select, solve or miss, re-rate,
 * select again — a thousand times, against a simulated player of *known* strength, and
 * asserts that the rating finds them and that they enjoyed the ride.
 *
 * The generator is seeded and every case names its seed, so a failure here is replayable
 * rather than a flake to be re-run until it passes.
 */

const ATTEMPTS = 1000

/**
 * The shipped catalogue's real shape, in miniature.
 *
 * The counts are the hundred-point buckets of `public/quiz/*.csv` divided by ten: 10,000
 * puzzles rated 789–2297 with a mean of 1547 and a thin low tail — only about 250 of them
 * are rated under 1100. That tail is the reason one of the tests below is about what the
 * selector does when the catalogue simply cannot go low enough.
 */
const RATING_BUCKETS: readonly (readonly [number, number])[] = [
  [700, 1],
  [900, 11],
  [1000, 15],
  [1100, 49],
  [1200, 73],
  [1300, 85],
  [1400, 198],
  [1500, 112],
  [1600, 164],
  [1700, 202],
  [1800, 64],
  [1900, 18],
  [2000, 6],
  [2100, 2],
  [2200, 1],
]

function catalogue(): Puzzle[] {
  const themes = ['fork', 'mateIn2', 'pin', 'discoveredAttack', 'endgame']
  const puzzles: Puzzle[] = []
  for (const [floor, count] of RATING_BUCKETS) {
    for (let step = 0; step < count; step += 1) {
      const index = puzzles.length
      puzzles.push(
        makePuzzle({
          id: toPuzzleId(`sim-${String(index)}`),
          rating: floor + Math.round((step / Math.max(count, 1)) * 99),
          theme: themes[index % themes.length] ?? 'fork',
          band: 'rook',
          subLevel: (index % 10) + 1,
        }),
      )
    }
  }
  return puzzles
}

/**
 * The repository's `select`, as a pure function, so the loop needs no database.
 *
 * It copies the one behaviour that matters to the selector: rows come back in
 * rating order and `limit` truncates them, so a limit always keeps the easy end.
 */
function query(pool: readonly Puzzle[], selection: PuzzleSelection): Puzzle[] {
  const excluded = new Set<PuzzleId>(selection.excludeIds ?? [])
  const matched = pool.filter((puzzle) => {
    if (!puzzle.active) return false
    if (excluded.has(puzzle.id)) return false
    if (selection.minRating !== undefined && puzzle.rating < selection.minRating) return false
    if (selection.maxRating !== undefined && puzzle.rating > selection.maxRating) return false
    if (selection.band !== undefined && puzzle.band !== selection.band) return false
    if (selection.subLevel !== undefined && puzzle.subLevel !== selection.subLevel) return false
    if (selection.theme !== undefined && puzzle.theme !== selection.theme) return false
    return true
  })
  const ordered = [...matched].sort((left, right) => left.rating - right.rating)
  return selection.limit === undefined ? ordered : ordered.slice(0, selection.limit)
}

function nextPuzzle(pool: readonly Puzzle[], player: GlickoRating, seen: Set<PuzzleId>, rng: Rng) {
  for (const rung of selectionLadder({
    player,
    rung: curriculumRung({ rook: 999 }),
    excludeIds: [...seen],
    count: 1,
  })) {
    const candidates = rung.queries.flatMap((selection) => query(pool, selection))
    const [picked] = pickSession(candidates, { player, rng, count: 1 })
    if (picked !== undefined) return picked
  }
  return undefined
}

interface Run {
  readonly player: GlickoRating
  readonly solved: number
  readonly attempts: number
  readonly recentSolveRate: number
  /** Mean rating of the puzzles the selector actually served. */
  readonly meanServedRating: number
}

/** One simulated learner of fixed true strength, solving `ATTEMPTS` puzzles. */
function simulate(trueRating: number, seed: number, attempts = ATTEMPTS): Run {
  const pool = catalogue()
  const truth: GlickoRating = { rating: trueRating, deviation: 30, volatility: 0.06 }
  const rng = seededRng(seed)
  const seen = new Set<PuzzleId>()
  const outcomes: boolean[] = []
  const served: number[] = []
  let player = DEFAULT_RATING_STATE

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const puzzle = nextPuzzle(pool, player, seen, rng)
    if (puzzle === undefined) break
    // Forget a puzzle after a while, exactly as the repository's "not seen lately" does.
    seen.add(puzzle.id)
    if (seen.size > 200) seen.delete(seen.values().next().value ?? puzzle.id)

    served.push(puzzle.rating)
    const solved = rng() < expectedSuccess(truth, puzzle.rating)
    outcomes.push(solved)
    player = applyAttempt(player, { puzzleRating: puzzle.rating, solved, hintUsed: null }).after
  }

  const recent = outcomes.slice(-500)
  return {
    player,
    solved: outcomes.filter(Boolean).length,
    attempts: outcomes.length,
    recentSolveRate: recent.filter(Boolean).length / Math.max(recent.length, 1),
    meanServedRating: served.reduce((sum, rating) => sum + rating, 0) / Math.max(served.length, 1),
  }
}

const SEEDS = [1, 7, 12_345, 98_765] as const
const STRENGTHS = [1150, 1350, 1600, 1900] as const

/** Strengths the catalogue can actually serve a 75% set to; see the low-tail test below. */
const SERVABLE_STRENGTHS = [1350, 1600, 1900] as const

describe(`rating convergence over ${String(ATTEMPTS)} attempts`, () => {
  const cases = SEEDS.flatMap((seed) => STRENGTHS.map((strength) => ({ seed, strength })))

  it.each(cases)(
    'finds a player rated $strength from a cold start (seed $seed)',
    ({ seed, strength }) => {
      const run = simulate(strength, seed)

      expect(run.attempts).toBe(ATTEMPTS)
      // 120 points is inside the Glicko-2 confidence band a settled rating carries, so
      // anything tighter would be asserting on noise rather than on convergence.
      expect(Math.abs(run.player.rating - strength)).toBeLessThan(120)
      expect(run.player.deviation).toBeLessThan(120)
    },
  )

  it.each(SEEDS.flatMap((seed) => SERVABLE_STRENGTHS.map((strength) => ({ seed, strength }))))(
    'keeps a player rated $strength solving about three in four (seed $seed)',
    ({ seed, strength }) => {
      const run = simulate(strength, seed)

      expect(run.recentSolveRate).toBeGreaterThan(0.65)
      expect(run.recentSolveRate).toBeLessThan(0.85)
    },
  )

  it.each(SEEDS)(
    'serves a player below the catalogue floor the easiest it has (seed %i)',
    (seed) => {
      // The dataset bottoms out at 789 and is thin under 1100, so a 1000-rated solver
      // cannot be given a 75% set — there are not enough easy puzzles to give. What the
      // selector must still do is find their rating and stay at the bottom of the
      // catalogue rather than wandering up it.
      const run = simulate(1000, seed)

      expect(Math.abs(run.player.rating - 1000)).toBeLessThan(120)
      // Everything it serves comes from the bottom of the catalogue…
      expect(run.meanServedRating).toBeLessThan(1250)
      // …and it still cannot reach the target, which is a gap in the content, not in the
      // selector: only about 2.6% of the shipped puzzles are rated under 1100.
      expect(run.recentSolveRate).toBeLessThan(0.6)
    },
  )

  it.each(SEEDS)('settles rather than drifting once it has arrived (seed %i)', (seed) => {
    const short = simulate(1500, seed, 200)
    const long = simulate(1500, seed, ATTEMPTS)

    // The deviation reaches an equilibrium rather than shrinking forever: the floor in
    // `glicko2.ts` and the volatility keep the rating able to move if the player does.
    expect(long.player.deviation).toBeLessThan(short.player.deviation + 10)
    expect(long.player.deviation).toBeLessThan(90)
    expect(Math.abs(long.player.rating - 1500)).toBeLessThan(120)
  })

  it('moves toward a player who is stronger than the app first assumed', () => {
    const climbing = simulate(2000, 4242, 300)

    expect(climbing.player.rating).toBeGreaterThan(1700)
  })

  it('moves toward a player who is weaker than the app first assumed', () => {
    const settling = simulate(1000, 4242, 300)

    expect(settling.player.rating).toBeLessThan(1300)
  })
})
