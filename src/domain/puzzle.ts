import { z } from 'zod'

import {
  DifficultySchema,
  HintLevelSchema,
  PuzzleBandSchema,
  PuzzleSourceSchema,
  SessionKindSchema,
} from './enums'
import { AttemptIdSchema, PackIdSchema, PuzzleIdSchema, SessionIdSchema } from './ids'
import { DurationMsSchema, FenSchema, RatingSchema, TimestampSchema, UciSchema } from './primitives'

/**
 * Puzzles and attempts.
 *
 * `Puzzle` is a one-to-one mapping of a row of `public/quiz/band_*.csv` — 10,000
 * puzzles from the Lichess open puzzle database (CC0), curated into six bands.
 * Each field below names the column it comes from, so the S10 importer is a
 * rename and a type conversion and nothing more.
 */

/** The CSV header, in file order. The importer asserts the real header matches. */
export const PUZZLE_CSV_COLUMNS = [
  'id',
  'fen',
  'solution_ucis',
  'category',
  'sub_level',
  'difficulty',
  'title',
  'theme',
  'prompt',
  'rating',
  'rating_label',
  'tags',
  'explanation',
  'active',
  'source',
  'lichess_id',
  'nb_plays',
  'popularity',
  'opening_tags',
] as const
export type PuzzleCsvColumn = (typeof PUZZLE_CSV_COLUMNS)[number]

export const PuzzleSchema = z.object({
  /** CSV `id`, e.g. `lc_pTK5y`. */
  id: PuzzleIdSchema,
  /** CSV `fen` — the position *before* the first solution move. */
  fen: FenSchema,
  /**
   * CSV `solution_ucis`, a brace list such as `{"f6f3","g2g1","f3e2"}`. Odd
   * indexes are the opponent's forced replies, so the solver plays them back.
   */
  solution: z.array(UciSchema).min(1),
  /** CSV `category` — the curriculum band the puzzle was filed under. */
  band: PuzzleBandSchema,
  /** CSV `sub_level`, 1–10 within the band. */
  subLevel: z.number().int().min(1).max(10),
  /** CSV `difficulty`. */
  difficulty: DifficultySchema,
  /** CSV `title`, e.g. `Bishop 1 · Fork`. */
  title: z.string().min(1),
  /**
   * CSV `theme` — the primary Lichess theme (`fork`, `mateIn2`, `pin`, …). Kept
   * as a free string: 35 appear in the dataset today and content packs add more.
   */
  theme: z.string().min(1),
  /** CSV `prompt`, e.g. `Black to move.` */
  prompt: z.string().min(1),
  /** CSV `rating`, 789–2297 in the shipped set. */
  rating: RatingSchema,
  /** CSV `rating_label` — `Novice`, `Casual`, `Club`, … */
  ratingLabel: z.string().min(1),
  /** CSV `tags`, a brace list of every Lichess theme on the puzzle. */
  tags: z.array(z.string()).default(() => []),
  /** CSV `explanation` — the one-line "why this works" the solver reveals. */
  explanation: z.string().min(1),
  /** CSV `active`; an inactive puzzle stays importable but is never selected. */
  active: z.boolean().default(true),
  /** CSV `source`; every shipped row is `lichess`. */
  source: PuzzleSourceSchema.default('lichess'),
  /** CSV `lichess_id`. Attribution is a licence obligation: the solver links to it. */
  lichessId: z.string().min(1).optional(),
  /** CSV `nb_plays`. */
  plays: z.number().int().min(0).default(0),
  /** CSV `popularity`, the Lichess −100…100 up/down score. */
  popularity: z.number().int().min(-100).max(100).default(0),
  /** CSV `opening_tags`, a brace list such as `{"Caro-Kann_Defense"}`. */
  openingTags: z.array(z.string()).default(() => []),
  /** Set only for puzzles that arrived inside a content pack. */
  packId: PackIdSchema.optional(),
})
export type Puzzle = z.infer<typeof PuzzleSchema>

/** Why: the solver plays the opponent's replies, so it needs the split spelled out. */
export function puzzleUserMoves(puzzle: Puzzle): Puzzle['solution'] {
  return puzzle.solution.filter((_move, index) => index % 2 === 0)
}

/** `lichess.org/training/<id>`, the attribution link the solver must show. */
export function lichessPuzzleUrl(puzzle: Puzzle): string | null {
  return puzzle.lichessId === undefined ? null : `https://lichess.org/training/${puzzle.lichessId}`
}

/**
 * One go at one puzzle.
 *
 * Why the rating snapshots rather than a delta: Glicko-2 needs the deviation and
 * volatility that produced the change, and a stored delta cannot be re-derived.
 */
export const PuzzleAttemptSchema = z.object({
  id: AttemptIdSchema,
  puzzleId: PuzzleIdSchema,
  sessionId: SessionIdSchema.optional(),
  mode: SessionKindSchema,
  startedAt: TimestampSchema,
  endedAt: TimestampSchema,
  durationMs: DurationMsSchema,
  solved: z.boolean(),
  /** Solved with no wrong move and no hint — what "first try" on the summary means. */
  firstTry: z.boolean(),
  skipped: z.boolean().default(false),
  /** Every move the user actually played, wrong ones included. */
  movesPlayed: z.array(UciSchema).default(() => []),
  /** The highest rung of the ladder reached; `null` means no hint was taken. */
  hintUsed: HintLevelSchema.nullable().default(null),
  hintCount: z.number().int().min(0).max(3).default(0),
  /** The puzzle's own rating at the time, so later re-ratings do not rewrite history. */
  puzzleRating: RatingSchema,
  ratingBefore: RatingSchema,
  ratingAfter: RatingSchema,
  ratingDeviationBefore: z.number().min(0),
  ratingDeviationAfter: z.number().min(0),
  /** False when a hint or a reveal made the attempt unrated. */
  rated: z.boolean().default(true),
})
export type PuzzleAttempt = z.infer<typeof PuzzleAttemptSchema>
