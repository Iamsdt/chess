import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  GameIdSchema,
  type PuzzleIdSchema,
  toAttemptId,
  toGameId,
  toJobId,
  toLessonId,
  toLessonStepId,
  toMessageId,
  toMistakeId,
  toPackId,
  toProfileId,
  toPuzzleId,
  toRepertoireNodeId,
  toSessionId,
  toSrsCardId,
  toThreadId,
  toTrackId,
  toUnitId,
  type GameId,
  type PuzzleId,
} from './ids'

const constructors = [
  ['GameId', toGameId],
  ['PuzzleId', toPuzzleId],
  ['AttemptId', toAttemptId],
  ['LessonId', toLessonId],
  ['LessonStepId', toLessonStepId],
  ['PackId', toPackId],
  ['TrackId', toTrackId],
  ['UnitId', toUnitId],
  ['RepertoireNodeId', toRepertoireNodeId],
  ['SrsCardId', toSrsCardId],
  ['MistakeId', toMistakeId],
  ['ProfileId', toProfileId],
  ['JobId', toJobId],
  ['SessionId', toSessionId],
  ['ThreadId', toThreadId],
  ['MessageId', toMessageId],
] as const satisfies readonly (readonly [string, (value: string) => string])[]

describe('branded ids', () => {
  it.each(constructors)('%s round-trips its string value', (_name, construct) => {
    expect(construct('abc-1')).toBe('abc-1')
  })

  it.each(constructors)('%s rejects an empty string', (_name, construct) => {
    expect(() => construct('')).toThrow()
  })

  it('rejects a non-string at run time', () => {
    expect(GameIdSchema.safeParse(7).success).toBe(false)
  })

  it('survives JSON round-tripping, because ids live in IndexedDB and backups', () => {
    const id = toGameId('game-1')
    const revived = GameIdSchema.parse(JSON.parse(JSON.stringify(id)))
    expect(revived).toBe(id)
  })
})

describe('branded id types', () => {
  it('keeps two id brands apart', () => {
    expectTypeOf<GameId>().not.toEqualTypeOf<PuzzleId>()
    expectTypeOf<GameId>().not.toExtend<PuzzleId>()
    expectTypeOf<PuzzleId>().not.toExtend<GameId>()
  })

  it('refuses a bare string where an id is required', () => {
    expectTypeOf<string>().not.toExtend<GameId>()
  })

  it('still behaves as a string where a string is enough', () => {
    expectTypeOf<GameId>().toExtend<string>()
  })

  it('derives the type from the schema, so the two cannot drift', () => {
    expectTypeOf<GameId>().toEqualTypeOf<(typeof GameIdSchema)['_zod']['output']>()
    expectTypeOf<PuzzleId>().toEqualTypeOf<(typeof PuzzleIdSchema)['_zod']['output']>()
  })
})
