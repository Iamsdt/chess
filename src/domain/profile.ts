import { z } from 'zod'

import {
  AnimationSpeedSchema,
  BoardThemeSchema,
  CoachProviderSchema,
  CoachToneSchema,
  ColorSchema,
  DailyGoalMinutesSchema,
  EnginePersonalitySchema,
  GardenStageSchema,
  PieceSetSchema,
  SkillLevelSchema,
  SoundStyleSchema,
  ThemeModeSchema,
} from './enums'
import { TimeControlSchema } from './game'
import { ProfileIdSchema } from './ids'
import {
  ClockTimeSchema,
  DurationMsSchema,
  LocalDateSchema,
  RatingSchema,
  TimestampSchema,
} from './primitives'

/**
 * The single local user, their settings and their streak.
 *
 * Why there is no account: the app has no server database. `Profile` is one row,
 * `Settings` is one row, and both go into the JSON backup — which is why neither
 * may ever hold key material.
 */
export const ProfileSchema = z.object({
  id: ProfileIdSchema,
  displayName: z.string().min(1).max(40),
  skillLevel: SkillLevelSchema,
  /** Glicko-2 for puzzles: the rating only means something with its deviation. */
  puzzleRating: RatingSchema,
  puzzleRatingDeviation: z.number().min(0),
  puzzleRatingVolatility: z.number().min(0),
  /** Elo from games against the calibrated engine opponent. */
  sparringRating: RatingSchema,
  /** What the user said they were here for, during onboarding. */
  goals: z.array(z.string()).default(() => []),
  /** IANA zone. Streaks and the heatmap are calendar questions, so they need it. */
  timeZone: z.string().min(1),
  gardenLevel: z.number().int().min(0).default(0),
  gardenStage: GardenStageSchema.default('seed'),
  onboardingCompletedAt: TimestampSchema.nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})
export type Profile = z.infer<typeof ProfileSchema>

/** Board and piece appearance; changing any of these takes effect immediately. */
export const BoardSettingsSchema = z.object({
  theme: BoardThemeSchema.default('grove'),
  pieceSet: PieceSetSchema.default('california'),
  coordinates: z.boolean().default(true),
  highlightLastMove: z.boolean().default(true),
  animation: AnimationSpeedSchema.default('normal'),
  premoves: z.boolean().default(false),
  /** Off means auto-queen. */
  alwaysAskOnPromotion: z.boolean().default(true),
})
export type BoardSettings = z.infer<typeof BoardSettingsSchema>

export const SoundSettingsSchema = z.object({
  moveSounds: z.boolean().default(true),
  volume: z.number().int().min(0).max(100).default(60),
  style: SoundStyleSchema.default('wood'),
  lowTimeWarning: z.boolean().default(true),
  celebrations: z.boolean().default(false),
})
export type SoundSettings = z.infer<typeof SoundSettingsSchema>

/**
 * Coach preferences — and deliberately nothing else.
 *
 * Why `hasKey` instead of the key: the API key lives encrypted in its own vault
 * and never enters this object, because this object is what the backup exports.
 */
export const CoachSettingsSchema = z.object({
  provider: CoachProviderSchema.default('gemini'),
  model: z.string().min(1).default('gemini-2.5-flash'),
  tone: CoachToneSchema.default('friendly'),
  /** On puzzles and lessons Sage nudges and never tells. */
  spoilerGuard: z.boolean().default(true),
  allowEngineLines: z.boolean().default(true),
  /** The soft cap the usage meter fills against, in tokens per month. */
  monthlyTokenCap: z.number().int().min(0).default(500_000),
  /** Whether a key exists at all; the vault, not this row, holds it. */
  hasKey: z.boolean().default(false),
  passphraseLock: z.boolean().default(false),
})
export type CoachSettings = z.infer<typeof CoachSettingsSchema>

export const PlaySettingsSchema = z.object({
  defaultOpponentRating: RatingSchema.default(1200),
  defaultPersonality: EnginePersonalitySchema.default('solid'),
  defaultColor: ColorSchema.nullable().default(null),
  defaultTimeControl: TimeControlSchema.default({
    kind: 'increment',
    initialMs: 600_000,
    incrementMs: 5_000,
  }),
  /** Sage warns before a hanging move; runs on the `interactive` engine lane. */
  trainingWheels: z.boolean().default(true),
  showEvaluation: z.boolean().default(false),
  allowTakebacks: z.boolean().default(true),
})
export type PlaySettings = z.infer<typeof PlaySettingsSchema>

export const SettingsSchema = z.object({
  /** Bumped when a backup written by an older build needs migrating on import. */
  version: z.number().int().min(1).default(1),
  theme: ThemeModeSchema.default('system'),
  dailyGoalMinutes: DailyGoalMinutesSchema.default(15),
  reminderEnabled: z.boolean().default(true),
  reminderTime: ClockTimeSchema.default('20:00'),
  board: BoardSettingsSchema,
  sound: SoundSettingsSchema,
  coach: CoachSettingsSchema,
  play: PlaySettingsSchema,
  updatedAt: TimestampSchema,
})
export type Settings = z.infer<typeof SettingsSchema>

/**
 * The streak, the freeze and today's progress against the goal.
 *
 * Why `LocalDate` and not `Timestamp` here: "did you practise today" is a
 * calendar question. Using instants makes the streak break when the user flies
 * east, and makes it double-count on the night the clocks go back.
 */
export const StreakStateSchema = z.object({
  current: z.number().int().min(0).default(0),
  longest: z.number().int().min(0).default(0),
  /** The last day that counted, freezes included. */
  lastPracticeDay: LocalDateSchema.nullable().default(null),
  /** One freeze is earned per week and spends itself on a missed day. */
  freezesAvailable: z.number().int().min(0).max(1).default(0),
  freezeEarnedOn: LocalDateSchema.nullable().default(null),
  /** Days a freeze covered; the heatmap paints these differently. */
  freezeDaysUsed: z.array(LocalDateSchema).default(() => []),
  /** Progress against today's goal; resets when `day` is no longer today. */
  today: z.object({
    day: LocalDateSchema,
    practisedMs: DurationMsSchema,
    goalMs: DurationMsSchema,
    /** Actions finished out of the ones "today's path" planned. */
    pathDone: z.number().int().min(0).default(0),
    pathTotal: z.number().int().min(0).default(0),
  }),
  updatedAt: TimestampSchema,
})
export type StreakState = z.infer<typeof StreakStateSchema>
