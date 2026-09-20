/**
 * S14 · Puzzles — the adaptive loop.
 *
 * Four screens (`prototype/puzzles.html`, `puzzle.html`, `puzzle-rush.html`,
 * `session-summary.html`) over one runner, and under that a layer of pure functions that
 * hold everything worth arguing about:
 *
 * - `glicko2.ts` — the rating system, checked against Glickman's published example.
 * - `rating.ts` — what an attempt is worth, what a hint costs, and the rating that gives
 *   this user a 75% chance, which is the whole of "tuned to you".
 * - `selection.ts` — the band curriculum, the sliced rating window and the weighted draw.
 * - `solution.ts` / `hints.ts` — playing the dataset's line, and the three rungs of help.
 * - `session.ts` — one reducer behind adaptive sets, the daily puzzle, Rush and Survival,
 *   whose whole state is serialisable, which is what makes a reload survivable.
 *
 * Everything that touches storage goes through `puzzle-store.ts`, and the only outward
 * dependency is `ports.ts` — the seam S11's job queue will take over.
 *
 * The screens are exported as zero-prop components for the route table; the same screens
 * take a `navigate` callback underneath, so they render in a test without a router.
 */

/* The four routed screens. `SCREEN_COMPONENTS` in S04 expects exactly these names. */
export {
  PuzzleRushScreen,
  PuzzleSolverScreen,
  PuzzlesHubScreen,
  SessionSummaryScreen,
} from './screens/routed'

/* The screens themselves, for tests and for any sprint that wants to embed one. */
export { PuzzlesHub, type PuzzlesHubProps } from './screens/puzzles-hub'
export { PuzzleSolver, type PuzzleSolverProps } from './screens/puzzle-solver'
export { SessionSummary, type SessionSummaryProps } from './screens/session-summary'
export type { NavigateTo, PuzzlePath } from './screens/navigation'

/* The rating system. S22's growth charts and S25's placement puzzles need these. */
export {
  DEFAULT_DEVIATION,
  DEFAULT_RATING,
  DEFAULT_VOLATILITY,
  decayDeviation,
  expectedScore,
  ratingInterval,
  updateRating,
  type GlickoRating,
  type GlickoResult,
} from './glicko2'
export {
  applyAttempt,
  attemptScore,
  DEFAULT_RATING_STATE,
  expectedSuccess,
  HINT_CREDIT,
  PUZZLE_DEVIATION,
  ratingForSuccess,
  toStoredRating,
  type AttemptOutcome,
  type RatingChange,
} from './rating'

/* Selection. S24's "today's path" and S25's placement flow draw sets the same way. */
export {
  candidateWeight,
  curriculumRung,
  dailyPuzzleIndex,
  dailySeed,
  expectedSetSuccess,
  pickSession,
  ratingWindow,
  selectionLadder,
  SESSION_SIZE,
  TARGET_SUCCESS,
  themeWeights,
  type CurriculumRung,
  type LadderRung,
  type RatingWindow,
} from './selection'
export { hashSeed, seededRng, shuffle, systemRng, weightedSample, type Rng } from './rng'

/* Theme mastery, which S22's skill radar reads. */
export {
  recentSolveRate,
  themeMastery,
  weakestThemes,
  type MasteryTone,
  type ThemeAttemptRecord,
  type ThemeMastery,
} from './mastery'

/* Solving a puzzle: S16's lessons and S27's shared challenges replay the same lines. */
export {
  createSolve,
  expectedMove,
  isPromotionMove,
  isUserTurn,
  legalMoveMap,
  markMissed,
  playOpponentReply,
  playUserMove,
  solutionSan,
  solveShapes,
  withHint,
  type AttemptedMove,
  type MoveVerdict,
  type SolveState,
  type SolveStatus,
} from './solution'
export { HINT_RUNGS, hintFor, nextRung, type HintRung, type RevealedHint } from './hints'

/* The session runner. S24's habit loop reads these summaries. */
export {
  configFor,
  currentPuzzleId,
  fromResumeState,
  livesLeft,
  progressDots,
  PUZZLE_SESSION_KINDS,
  RUSH_DURATIONS_MS,
  RUSH_LIVES,
  sessionReducer,
  sessionSummary,
  startSession,
  timeLeftMs,
  toResumeState,
  type ProgressDot,
  type PuzzleResult,
  type PuzzleSessionKind,
  type RushDuration,
  type SessionConfig,
  type SessionState,
  type SessionSummary as PuzzleSessionSummary,
} from './session'

/* Storage and the runner hook, for a sprint that wants to drive the loop itself. */
export {
  loadAttemptHistory,
  loadDailyPuzzle,
  readBests,
  readRatingState,
  recordAttempt,
  type PuzzleBests,
  type RecordAttemptInput,
} from './puzzle-store'
export { buildQueue, startNewSession, type PreparedSession } from './queue'
export { usePuzzleSession, type PuzzleRunner, type SessionOptions } from './use-puzzle-session'
export { usePuzzleHub, usePuzzleImport, type HubData } from './use-puzzle-hub'
export { createContentImportPort, type PuzzleImportPort } from './ports'
