import { z } from 'zod'

/**
 * Closed sets, as const unions.
 *
 * Why the `_VALUES` array beside every schema: the UI needs to iterate the
 * options (filter chips, radio groups, settings selects) and the tests need to
 * assert exhaustiveness. Deriving the type from the array keeps the three in step.
 */

/**
 * Move quality. These keys are the contract with the design system: `globals.css`
 * defines `--q-brilliant` … `--q-blunder` and `QualityGlyph` colours by exactly
 * these names, so renaming one silently unstyles the app.
 */
export const MOVE_QUALITIES = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
] as const
export const MoveQualitySchema = z.enum(MOVE_QUALITIES)
export type MoveQuality = z.infer<typeof MoveQualitySchema>

/** The qualities that earn a position a place in the Mistake Bank. */
export const MISTAKE_QUALITIES = ['inaccuracy', 'mistake', 'miss', 'blunder'] as const
export const MistakeQualitySchema = z.enum(MISTAKE_QUALITIES)
export type MistakeQuality = z.infer<typeof MistakeQualitySchema>

export const COLORS = ['white', 'black'] as const
export const ColorSchema = z.enum(COLORS)
export type Color = z.infer<typeof ColorSchema>

/** Why: flipping sides is written in a dozen places; write it once. */
export const oppositeColor = (color: Color): Color => (color === 'white' ? 'black' : 'white')

/** FEN piece letters, so promotion and material code never invents its own set. */
export const PIECE_TYPES = ['p', 'n', 'b', 'r', 'q', 'k'] as const
export const PieceTypeSchema = z.enum(PIECE_TYPES)
export type PieceType = z.infer<typeof PieceTypeSchema>

export const PROMOTION_PIECES = ['n', 'b', 'r', 'q'] as const
export const PromotionPieceSchema = z.enum(PROMOTION_PIECES)
export type PromotionPiece = z.infer<typeof PromotionPieceSchema>

export const GAME_RESULTS = ['1-0', '0-1', '1/2-1/2', '*'] as const
export const GameResultSchema = z.enum(GAME_RESULTS)
export type GameResult = z.infer<typeof GameResultSchema>

export const GAME_TERMINATIONS = [
  'checkmate',
  'resignation',
  'timeout',
  'stalemate',
  'insufficient-material',
  'threefold-repetition',
  'fifty-move-rule',
  'agreement',
  'abandoned',
  'in-progress',
  'unknown',
] as const
export const GameTerminationSchema = z.enum(GAME_TERMINATIONS)
export type GameTermination = z.infer<typeof GameTerminationSchema>

/** Where a game came from; drives the library filter chips and the import dedupe. */
export const GAME_SOURCES = [
  'sparring',
  'friend-link',
  'lichess',
  'chesscom',
  'pgn-import',
  'analysis',
] as const
export const GameSourceSchema = z.enum(GAME_SOURCES)
export type GameSource = z.infer<typeof GameSourceSchema>

export const PLAYER_KINDS = ['you', 'engine', 'human'] as const
export const PlayerKindSchema = z.enum(PLAYER_KINDS)
export type PlayerKind = z.infer<typeof PlayerKindSchema>

export const ENGINE_PERSONALITIES = ['solid', 'aggressive', 'tricky'] as const
export const EnginePersonalitySchema = z.enum(ENGINE_PERSONALITIES)
export type EnginePersonality = z.infer<typeof EnginePersonalitySchema>

/** Engine priority lanes: a background review must never delay a live move. */
export const ENGINE_LANES = ['play', 'interactive', 'batch'] as const
export const EngineLaneSchema = z.enum(ENGINE_LANES)
export type EngineLane = z.infer<typeof EngineLaneSchema>

/** How far a game has travelled through the review pipeline. */
export const REVIEW_STATES = ['not-reviewed', 'queued', 'analysing', 'reviewed', 'failed'] as const
export const ReviewStateSchema = z.enum(REVIEW_STATES)
export type ReviewState = z.infer<typeof ReviewStateSchema>

/** The curriculum order, weakest piece first; the `category` column of the band CSVs. */
export const PUZZLE_BANDS = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'] as const
export const PuzzleBandSchema = z.enum(PUZZLE_BANDS)
export type PuzzleBand = z.infer<typeof PuzzleBandSchema>

/** Shared by puzzles and lessons; the `difficulty` column of the band CSVs. */
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export const DifficultySchema = z.enum(DIFFICULTIES)
export type Difficulty = z.infer<typeof DifficultySchema>

export const PUZZLE_SOURCES = ['lichess', 'pack', 'mistake', 'custom'] as const
export const PuzzleSourceSchema = z.enum(PUZZLE_SOURCES)
export type PuzzleSource = z.infer<typeof PuzzleSourceSchema>

/**
 * The hint ladder, in order. Each rung costs rating; the third ends the attempt
 * as unrated.
 */
export const HINT_LEVELS = ['nudge', 'square', 'move'] as const
export const HintLevelSchema = z.enum(HINT_LEVELS)
export type HintLevel = z.infer<typeof HintLevelSchema>

/** What a practice session was; every attempt and every summary carries one. */
export const SESSION_KINDS = [
  'adaptive-puzzles',
  'daily-puzzle',
  'puzzle-rush',
  'puzzle-survival',
  'theme-puzzles',
  'mistake-review',
  'lesson',
  'opening-drill',
  'endgame-drill',
  'vision-drill',
  'sparring',
  'placement',
] as const
export const SessionKindSchema = z.enum(SESSION_KINDS)
export type SessionKind = z.infer<typeof SessionKindSchema>

/** FSRS card states; `mastered` is this app's terminal state, not FSRS's. */
export const SRS_STATES = ['new', 'learning', 'review', 'relearning', 'mastered'] as const
export const SrsStateSchema = z.enum(SRS_STATES)
export type SrsState = z.infer<typeof SrsStateSchema>

/** The four FSRS grades, in the order the scheduler expects them. */
export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const
export const ReviewGradeSchema = z.enum(REVIEW_GRADES)
export type ReviewGrade = z.infer<typeof ReviewGradeSchema>

export const MISTAKE_SOURCES = ['game-review', 'puzzle', 'lesson', 'drill', 'manual'] as const
export const MistakeSourceSchema = z.enum(MISTAKE_SOURCES)
export type MistakeSource = z.infer<typeof MistakeSourceSchema>

export const JOB_TYPES = [
  'analyse-game',
  'import-pgn',
  'import-puzzles',
  'recompute-srs',
  'prefetch-pack',
  'rebuild-stats',
] as const
export const JobTypeSchema = z.enum(JOB_TYPES)
export type JobType = z.infer<typeof JobTypeSchema>

export const JOB_STATES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'quarantined',
] as const
export const JobStateSchema = z.enum(JOB_STATES)
export type JobState = z.infer<typeof JobStateSchema>

/** Matches the engine lanes on purpose: a job's priority is the lane it will use. */
export const JOB_PRIORITIES = ['high', 'normal', 'low'] as const
export const JobPrioritySchema = z.enum(JOB_PRIORITIES)
export type JobPriority = z.infer<typeof JobPrioritySchema>

export const COACH_ROLES = ['system', 'user', 'sage'] as const
export const CoachRoleSchema = z.enum(COACH_ROLES)
export type CoachRole = z.infer<typeof CoachRoleSchema>

export const COACH_PROVIDERS = ['gemini', 'openai', 'anthropic'] as const
export const CoachProviderSchema = z.enum(COACH_PROVIDERS)
export type CoachProvider = z.infer<typeof CoachProviderSchema>

export const COACH_TONES = ['friendly', 'blunt', 'socratic'] as const
export const CoachToneSchema = z.enum(COACH_TONES)
export type CoachTone = z.infer<typeof CoachToneSchema>

export const COACH_MESSAGE_STATUSES = ['pending', 'streaming', 'complete', 'error'] as const
export const CoachMessageStatusSchema = z.enum(COACH_MESSAGE_STATUSES)
export type CoachMessageStatus = z.infer<typeof CoachMessageStatusSchema>

export const THEME_MODES = ['light', 'dark', 'system'] as const
export const ThemeModeSchema = z.enum(THEME_MODES)
export type ThemeMode = z.infer<typeof ThemeModeSchema>

/** Board themes as named by the prototype's CSS scopes. */
export const BOARD_THEMES = ['green', 'walnut', 'slate', 'dusk', 'sand'] as const
export const BoardThemeSchema = z.enum(BOARD_THEMES)
export type BoardTheme = z.infer<typeof BoardThemeSchema>

export const PIECE_SETS = ['california', 'staunty', 'maestro', 'alpha'] as const
export const PieceSetSchema = z.enum(PIECE_SETS)
export type PieceSet = z.infer<typeof PieceSetSchema>

export const ANIMATION_SPEEDS = ['off', 'normal', 'slow'] as const
export const AnimationSpeedSchema = z.enum(ANIMATION_SPEEDS)
export type AnimationSpeed = z.infer<typeof AnimationSpeedSchema>

export const SOUND_STYLES = ['wood', 'soft', 'minimal'] as const
export const SoundStyleSchema = z.enum(SOUND_STYLES)
export type SoundStyle = z.infer<typeof SoundStyleSchema>

/** The three daily-goal options the onboarding and settings screens offer. */
export const DAILY_GOAL_MINUTES = [5, 15, 30] as const
export const DailyGoalMinutesSchema = z.literal(DAILY_GOAL_MINUTES)
export type DailyGoalMinutes = z.infer<typeof DailyGoalMinutesSchema>

export const SKILL_LEVELS = ['beginner', 'club', 'strong'] as const
export const SkillLevelSchema = z.enum(SKILL_LEVELS)
export type SkillLevel = z.infer<typeof SkillLevelSchema>

/** Garden stages, in growth order. */
export const GARDEN_STAGES = ['seed', 'sprout', 'sapling', 'bloom', 'tree'] as const
export const GardenStageSchema = z.enum(GARDEN_STAGES)
export type GardenStage = z.infer<typeof GardenStageSchema>

/** What a cell of the week strip and the practice heatmap can show. */
export const DAY_STATES = ['practised', 'partial', 'freeze', 'missed', 'future'] as const
export const DayStateSchema = z.enum(DAY_STATES)
export type DayState = z.infer<typeof DayStateSchema>

export const CONTENT_PACK_KINDS = ['lessons', 'puzzles', 'openings', 'drills'] as const
export const ContentPackKindSchema = z.enum(CONTENT_PACK_KINDS)
export type ContentPackKind = z.infer<typeof ContentPackKindSchema>

export const CONTENT_PACK_SOURCES = ['builtin', 'community', 'imported'] as const
export const ContentPackSourceSchema = z.enum(CONTENT_PACK_SOURCES)
export type ContentPackSource = z.infer<typeof ContentPackSourceSchema>

export const LESSON_STEP_KINDS = ['info', 'move', 'choice', 'quiz'] as const
export const LessonStepKindSchema = z.enum(LESSON_STEP_KINDS)
export type LessonStepKind = z.infer<typeof LessonStepKindSchema>

/** The four things a share link can carry, all inside the URL fragment. */
export const SHARE_KINDS = [
  'position',
  'puzzle-challenge',
  'annotated-game',
  'correspondence-move',
] as const
export const ShareKindSchema = z.enum(SHARE_KINDS)
export type ShareKind = z.infer<typeof ShareKindSchema>
