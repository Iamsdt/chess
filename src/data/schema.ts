import { z } from 'zod'

import {
  DurationMsSchema,
  GameMetaSchema,
  LessonIdSchema,
  LessonStepIdSchema,
  LocalDateSchema,
  PackIdSchema,
  SessionIdSchema,
  SessionKindSchema,
  SettingsSchema,
  TimestampSchema,
} from '@/domain'

/**
 * The shapes this layer owns, plus the singleton wrappers.
 *
 * Why they live here and not in `@/domain`: S03 froze the shapes features share
 * with each other. These three are storage bookkeeping — nobody passes a
 * `LessonProgress` to the engine or puts a `KvRow` in a share link — and the
 * sprint plan names them as tables (`lessonsProgress`, `sessions`, `kv`) rather
 * than as contracts. They are still zod-first, so writes validate like every
 * other table's.
 */

/**
 * A row of the `games` table: the header the library lists, plus the PGN.
 *
 * Why the PGN rides along instead of living in its own table: the sprint plan
 * fixes the table list, and a `Game`'s third field has to go somewhere. It is a
 * string of a couple of kilobytes and only `exportPgn` and a re-import read it,
 * so it costs the library screen a little memory and saves a second round trip.
 * The move array, which is the expensive part, stays in `moves`.
 */
export const GameRowSchema = GameMetaSchema.extend({
  pgn: z.string().optional(),
})
export type GameRow = z.infer<typeof GameRowSchema>

export const LESSON_PROGRESS_STATUSES = ['not-started', 'in-progress', 'completed'] as const
export const LessonProgressStatusSchema = z.enum(LESSON_PROGRESS_STATUSES)
export type LessonProgressStatus = z.infer<typeof LessonProgressStatusSchema>

/**
 * How far the player has got through one lesson.
 *
 * Why `lessonVersion` is stored: a pack author can republish a lesson, and the
 * course map must be able to say "this changed since you finished it" rather
 * than silently marking a rewritten lesson complete.
 */
export const LessonProgressSchema = z.object({
  lessonId: LessonIdSchema,
  packId: PackIdSchema,
  status: LessonProgressStatusSchema,
  /** The `Lesson.version` the progress was recorded against. */
  lessonVersion: z.number().int().min(1),
  /** Where "resume where you left off" puts the player back. */
  currentStepIndex: z.number().int().min(0).default(0),
  completedStepIds: z.array(LessonStepIdSchema).default(() => []),
  hintsUsed: z.number().int().min(0).default(0),
  wrongMoves: z.number().int().min(0).default(0),
  timeSpentMs: DurationMsSchema.default(0),
  startedAt: TimestampSchema,
  updatedAt: TimestampSchema,
  completedAt: TimestampSchema.nullable().default(null),
})
export type LessonProgress = z.infer<typeof LessonProgressSchema>

export const PRACTICE_SESSION_STATES = ['active', 'completed', 'abandoned'] as const
export const PracticeSessionStateSchema = z.enum(PRACTICE_SESSION_STATES)
export type PracticeSessionState = z.infer<typeof PracticeSessionStateSchema>

/**
 * One sitting: a puzzle run, a mistake review, a lesson, a drill.
 *
 * Why `resumeState` is an opaque record: every runner (S14 rush, S15 review,
 * S16 lesson player) resumes differently, and the storage layer must not carry
 * each feature's shape. The runner validates it with its own schema when it
 * picks the session back up, exactly as the job queue does with its payload.
 */
export const PracticeSessionSchema = z.object({
  id: SessionIdSchema,
  kind: SessionKindSchema,
  state: PracticeSessionStateSchema,
  /** The local calendar day the session belongs to; the heatmap groups by it. */
  day: LocalDateSchema,
  startedAt: TimestampSchema,
  updatedAt: TimestampSchema,
  endedAt: TimestampSchema.nullable().default(null),
  durationMs: DurationMsSchema.default(0),
  itemsAttempted: z.number().int().min(0).default(0),
  itemsCorrect: z.number().int().min(0).default(0),
  resumeState: z.record(z.string(), z.unknown()).default(() => ({})),
})
export type PracticeSession = z.infer<typeof PracticeSessionSchema>

/** The one row of the `settings` table. Settings itself carries no key, so it gets a wrapper. */
export const SETTINGS_ROW_ID = 'settings'
export const SettingsRowSchema = z.object({
  id: z.literal(SETTINGS_ROW_ID),
  value: SettingsSchema,
})
export type SettingsRow = z.infer<typeof SettingsRowSchema>

/**
 * A key/value row.
 *
 * Why the value stays `unknown` in the table but typed at the call site: the
 * table is shared by every sprint, and a union of everyone's shapes would make
 * `@/data` depend on all of them. `KvKey<T>` carries the schema instead.
 */
export const KvRowSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: TimestampSchema,
})
export type KvRow = z.infer<typeof KvRowSchema>
