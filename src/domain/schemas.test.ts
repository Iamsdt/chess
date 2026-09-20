import { describe, expect, it } from 'vitest'
import { type z } from 'zod'

import { toValidationIssues } from './assert'
import { ArrowSchema, BoardShapesSchema, emptyBoardShapes } from './board'
import { CoachContextSchema, CoachMessageSchema } from './coach'
import { ContentPackSchema, contentPackItemCountMatches } from './content'
import { EngineEvalSchema, EngineLineSchema } from './engine'
import {
  makeCoachContext,
  makeCoachMessage,
  makeContentPack,
  makeEngineEval,
  makeEngineLine,
  makeGame,
  makeGameMeta,
  makeJob,
  makeLesson,
  makeLessonStep,
  makeMistakeEntry,
  makeMoveRecord,
  makeProfile,
  makePuzzle,
  makePuzzleAttempt,
  makeRepertoireNode,
  makeReviewOutcome,
  makeSettings,
  makeShareAnnotatedGame,
  makeShareCorrespondenceMove,
  makeSharePayload,
  makeSharePuzzleChallenge,
  makeSrsCard,
  makeStreakState,
} from './fixtures'
import { GameMetaSchema, GameSchema, MoveRecordSchema } from './game'
import { JobSchema } from './jobs'
import { LessonSchema, LessonStepSchema } from './lesson'
import { RepertoireNodeSchema } from './openings'
import { ProfileSchema, SettingsSchema, StreakStateSchema } from './profile'
import { PuzzleAttemptSchema, PuzzleSchema } from './puzzle'
import { SharePayloadSchema } from './share'
import { MistakeEntrySchema, ReviewOutcomeSchema, SrsCardSchema } from './srs'

/** Why through JSON: everything here is stored in IndexedDB or a backup file. */
function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function broken(fixture: unknown, patch: Record<string, unknown>): unknown {
  return { ...(roundTrip(fixture) as Record<string, unknown>), ...patch }
}

interface SchemaCase {
  readonly name: string
  readonly schema: z.ZodType
  readonly fixture: unknown
  readonly patch: Record<string, unknown>
  readonly expectedPath: string
}

const cases: readonly SchemaCase[] = [
  {
    name: 'EngineLine',
    schema: EngineLineSchema,
    fixture: makeEngineLine(),
    patch: { pv: [] },
    expectedPath: 'pv',
  },
  {
    name: 'EngineEval',
    schema: EngineEvalSchema,
    fixture: makeEngineEval(),
    patch: { depth: -1 },
    expectedPath: 'depth',
  },
  {
    name: 'MoveRecord',
    schema: MoveRecordSchema,
    fixture: makeMoveRecord(),
    patch: { san: 'Xf3' },
    expectedPath: 'san',
  },
  {
    name: 'GameMeta',
    schema: GameMetaSchema,
    fixture: makeGameMeta(),
    patch: { result: 'win' },
    expectedPath: 'result',
  },
  {
    name: 'Game',
    schema: GameSchema,
    fixture: makeGame(),
    patch: { moves: 'none' },
    expectedPath: 'moves',
  },
  {
    name: 'Puzzle',
    schema: PuzzleSchema,
    fixture: makePuzzle(),
    patch: { fen: 'not a fen' },
    expectedPath: 'fen',
  },
  {
    name: 'PuzzleAttempt',
    schema: PuzzleAttemptSchema,
    fixture: makePuzzleAttempt(),
    patch: { ratingAfter: -5 },
    expectedPath: 'ratingAfter',
  },
  {
    name: 'LessonStep',
    schema: LessonStepSchema,
    fixture: makeLessonStep(),
    patch: { expectedMoves: ['Xf3'] },
    expectedPath: 'expectedMoves[0]',
  },
  {
    name: 'Lesson',
    schema: LessonSchema,
    fixture: makeLesson(),
    patch: { steps: [] },
    expectedPath: 'steps',
  },
  {
    name: 'ContentPack',
    schema: ContentPackSchema,
    fixture: makeContentPack(),
    patch: { licence: '' },
    expectedPath: 'licence',
  },
  {
    name: 'RepertoireNode',
    schema: RepertoireNodeSchema,
    fixture: makeRepertoireNode(),
    patch: { ply: -1 },
    expectedPath: 'ply',
  },
  {
    name: 'SrsCard',
    schema: SrsCardSchema,
    fixture: makeSrsCard(),
    patch: { difficulty: 11 },
    expectedPath: 'difficulty',
  },
  {
    name: 'ReviewOutcome',
    schema: ReviewOutcomeSchema,
    fixture: makeReviewOutcome(),
    patch: { grade: 'meh' },
    expectedPath: 'grade',
  },
  {
    name: 'MistakeEntry',
    schema: MistakeEntrySchema,
    fixture: makeMistakeEntry(),
    patch: { quality: 'best' },
    expectedPath: 'quality',
  },
  {
    name: 'Profile',
    schema: ProfileSchema,
    fixture: makeProfile(),
    patch: { displayName: '' },
    expectedPath: 'displayName',
  },
  {
    name: 'Settings',
    schema: SettingsSchema,
    fixture: makeSettings(),
    patch: { dailyGoalMinutes: 20 },
    expectedPath: 'dailyGoalMinutes',
  },
  {
    name: 'StreakState',
    schema: StreakStateSchema,
    fixture: makeStreakState(),
    patch: { current: -1 },
    expectedPath: 'current',
  },
  {
    name: 'Job',
    schema: JobSchema,
    fixture: makeJob(),
    patch: { progress: 120 },
    expectedPath: 'progress',
  },
  {
    name: 'CoachMessage',
    schema: CoachMessageSchema,
    fixture: makeCoachMessage(),
    patch: { role: 'assistant' },
    expectedPath: 'role',
  },
  {
    name: 'CoachContext',
    schema: CoachContextSchema,
    fixture: makeCoachContext(),
    patch: { tokenBudget: 0 },
    expectedPath: 'tokenBudget',
  },
  {
    name: 'SharePayload · position',
    schema: SharePayloadSchema,
    fixture: makeSharePayload(),
    patch: { orientation: 'w' },
    expectedPath: 'orientation',
  },
  {
    name: 'SharePayload · puzzle challenge',
    schema: SharePayloadSchema,
    fixture: makeSharePuzzleChallenge(),
    patch: { puzzles: [] },
    expectedPath: 'puzzles',
  },
  {
    name: 'SharePayload · annotated game',
    schema: SharePayloadSchema,
    fixture: makeShareAnnotatedGame(),
    patch: { moves: [] },
    expectedPath: 'moves',
  },
  {
    name: 'SharePayload · correspondence move',
    schema: SharePayloadSchema,
    fixture: makeShareCorrespondenceMove(),
    patch: { senderColor: 'b' },
    expectedPath: 'senderColor',
  },
  {
    name: 'BoardShapes',
    schema: BoardShapesSchema,
    fixture: emptyBoardShapes(),
    patch: { check: 'e9' },
    expectedPath: 'check',
  },
  {
    name: 'Arrow',
    schema: ArrowSchema,
    fixture: { from: 'g1', to: 'f3', kind: 'best' },
    patch: { kind: 'wiggly' },
    expectedPath: 'kind',
  },
]

describe.each(cases)('$name', ({ schema, fixture, patch, expectedPath }) => {
  it('validates its fixture', () => {
    expect(schema.safeParse(fixture).success).toBe(true)
  })

  it('round-trips through JSON unchanged', () => {
    const parsed = schema.parse(roundTrip(fixture))
    expect(parsed).toEqual(fixture)
  })

  it('is idempotent: parsing a parsed value changes nothing', () => {
    const once = schema.parse(roundTrip(fixture))
    expect(schema.parse(roundTrip(once))).toEqual(once)
  })

  it(`rejects bad data and names ${expectedPath}`, () => {
    const result = schema.safeParse(broken(fixture, patch))
    expect(result.success).toBe(false)
    const issues = result.error === undefined ? [] : toValidationIssues(result.error)
    expect(issues.map((issue) => issue.path)).toContain(expectedPath)
  })

  it('rejects a value of the wrong kind entirely', () => {
    expect(schema.safeParse('nonsense').success).toBe(false)
    expect(schema.safeParse(null).success).toBe(false)
  })
})

describe('SharePayload union', () => {
  it('rejects an unknown kind at the discriminant', () => {
    const result = SharePayloadSchema.safeParse(broken(makeSharePayload(), { kind: 'telepathy' }))
    expect(result.success).toBe(false)
    const issues = result.error === undefined ? [] : toValidationIssues(result.error)
    expect(issues.map((issue) => issue.path)).toContain('kind')
  })
})

describe('ContentPack', () => {
  it('spots a pack whose item count lies about its contents', () => {
    expect(contentPackItemCountMatches(makeContentPack())).toBe(true)
    expect(contentPackItemCountMatches(makeContentPack({ itemCount: 99 }))).toBe(false)
  })
})
