import { z } from 'zod'

/**
 * Branded identifiers.
 *
 * Why: every aggregate key in this app is a short string. Without a nominal type
 * a `PuzzleId` silently satisfies a `GameId` parameter and the bug only shows up
 * as an empty screen. The brand costs nothing at run time and is checked at every
 * call site.
 *
 * Mint one only through its `toXId()` constructor or through a schema that
 * contains it; those are the single validated places where the brand is applied.
 */

export const GameIdSchema = z.string().min(1).brand<'GameId'>()
export type GameId = z.infer<typeof GameIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `GameId`. */
export const toGameId = (value: string): GameId => GameIdSchema.parse(value)

export const PuzzleIdSchema = z.string().min(1).brand<'PuzzleId'>()
export type PuzzleId = z.infer<typeof PuzzleIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `PuzzleId`. */
export const toPuzzleId = (value: string): PuzzleId => PuzzleIdSchema.parse(value)

export const AttemptIdSchema = z.string().min(1).brand<'AttemptId'>()
export type AttemptId = z.infer<typeof AttemptIdSchema>
/** Why: the only sanctioned way to turn a plain string into an `AttemptId`. */
export const toAttemptId = (value: string): AttemptId => AttemptIdSchema.parse(value)

export const LessonIdSchema = z.string().min(1).brand<'LessonId'>()
export type LessonId = z.infer<typeof LessonIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `LessonId`. */
export const toLessonId = (value: string): LessonId => LessonIdSchema.parse(value)

export const LessonStepIdSchema = z.string().min(1).brand<'LessonStepId'>()
export type LessonStepId = z.infer<typeof LessonStepIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `LessonStepId`. */
export const toLessonStepId = (value: string): LessonStepId => LessonStepIdSchema.parse(value)

export const PackIdSchema = z.string().min(1).brand<'PackId'>()
export type PackId = z.infer<typeof PackIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `PackId`. */
export const toPackId = (value: string): PackId => PackIdSchema.parse(value)

export const TrackIdSchema = z.string().min(1).brand<'TrackId'>()
export type TrackId = z.infer<typeof TrackIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `TrackId`. */
export const toTrackId = (value: string): TrackId => TrackIdSchema.parse(value)

export const UnitIdSchema = z.string().min(1).brand<'UnitId'>()
export type UnitId = z.infer<typeof UnitIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `UnitId`. */
export const toUnitId = (value: string): UnitId => UnitIdSchema.parse(value)

export const RepertoireNodeIdSchema = z.string().min(1).brand<'RepertoireNodeId'>()
export type RepertoireNodeId = z.infer<typeof RepertoireNodeIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `RepertoireNodeId`. */
export const toRepertoireNodeId = (value: string): RepertoireNodeId =>
  RepertoireNodeIdSchema.parse(value)

export const SrsCardIdSchema = z.string().min(1).brand<'SrsCardId'>()
export type SrsCardId = z.infer<typeof SrsCardIdSchema>
/** Why: the only sanctioned way to turn a plain string into an `SrsCardId`. */
export const toSrsCardId = (value: string): SrsCardId => SrsCardIdSchema.parse(value)

export const MistakeIdSchema = z.string().min(1).brand<'MistakeId'>()
export type MistakeId = z.infer<typeof MistakeIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `MistakeId`. */
export const toMistakeId = (value: string): MistakeId => MistakeIdSchema.parse(value)

export const ProfileIdSchema = z.string().min(1).brand<'ProfileId'>()
export type ProfileId = z.infer<typeof ProfileIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `ProfileId`. */
export const toProfileId = (value: string): ProfileId => ProfileIdSchema.parse(value)

export const JobIdSchema = z.string().min(1).brand<'JobId'>()
export type JobId = z.infer<typeof JobIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `JobId`. */
export const toJobId = (value: string): JobId => JobIdSchema.parse(value)

export const SessionIdSchema = z.string().min(1).brand<'SessionId'>()
export type SessionId = z.infer<typeof SessionIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `SessionId`. */
export const toSessionId = (value: string): SessionId => SessionIdSchema.parse(value)

export const ThreadIdSchema = z.string().min(1).brand<'ThreadId'>()
export type ThreadId = z.infer<typeof ThreadIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `ThreadId`. */
export const toThreadId = (value: string): ThreadId => ThreadIdSchema.parse(value)

export const MessageIdSchema = z.string().min(1).brand<'MessageId'>()
export type MessageId = z.infer<typeof MessageIdSchema>
/** Why: the only sanctioned way to turn a plain string into a `MessageId`. */
export const toMessageId = (value: string): MessageId => MessageIdSchema.parse(value)
