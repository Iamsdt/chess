import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import {
  ValidationError,
  assertValid,
  formatIssuePath,
  formatValidationDetail,
  formatValidationSummary,
  isValid,
  isValidationError,
  parseValid,
  setValidationReporter,
  toValidationIssues,
} from './assert'
import { makePuzzle } from './fixtures/puzzle'
import { PuzzleSchema } from './puzzle'

const RowSchema = z.object({
  fen: z.string().min(1),
  moves: z.array(z.object({ san: z.string().min(1) })),
})

afterEach(() => {
  vi.unstubAllEnvs()
  setValidationReporter(null)
  vi.restoreAllMocks()
})

describe('formatIssuePath', () => {
  it.each([
    [[], '(root)'],
    [['fen'], 'fen'],
    [['moves', 0, 'san'], 'moves[0].san'],
    [[0], '[0]'],
    [['a', 'b', 'c'], 'a.b.c'],
  ] as const)('formats %j as %s', (path, expected) => {
    expect(formatIssuePath(path)).toBe(expected)
  })
})

describe('assertValid', () => {
  it('returns the parsed value when the data is good', () => {
    const puzzle = makePuzzle()
    expect(assertValid(PuzzleSchema, JSON.parse(JSON.stringify(puzzle)), 'test')).toEqual(puzzle)
  })

  it('throws in development with the field path and the source', () => {
    vi.stubEnv('DEV', true)
    let thrown: unknown
    try {
      assertValid(RowSchema, { fen: '', moves: [{ san: 1 }] }, 'puzzle CSV row 42')
    } catch (error) {
      thrown = error
    }
    expect(isValidationError(thrown)).toBe(true)
    const error = thrown as ValidationError
    expect(error.where).toBe('puzzle CSV row 42')
    expect(error.message).toContain('puzzle CSV row 42')
    expect(error.message).toContain('fen')
    expect(error.message).toContain('moves[0].san')
    expect(error.issues.map((issue) => issue.path)).toEqual(['fen', 'moves[0].san'])
  })

  it('reports a short message in production and never the offending value', () => {
    vi.stubEnv('DEV', false)
    const reported: ValidationError[] = []
    setValidationReporter((error) => reported.push(error))

    expect(() =>
      assertValid(RowSchema, { fen: '', moves: [{ san: 1 }] }, 'worker message: analyse-game'),
    ).toThrow(ValidationError)

    const error = reported[0]
    expect(error).toBeDefined()
    expect(error?.message).toBe(
      'Invalid data from "worker message: analyse-game" (2 problems: fen, moves[0].san)',
    )
    expect(error?.message).not.toContain('\n')
    // The detail is still on the error as data, for a diagnostics dump.
    expect(error?.issues).toHaveLength(2)
  })

  it('falls back to the console reporter when none is installed', () => {
    vi.stubEnv('DEV', false)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => assertValid(RowSchema, {}, 'backup file v3')).toThrow(ValidationError)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not call the reporter in development, where the throw is the report', () => {
    vi.stubEnv('DEV', true)
    const reported: ValidationError[] = []
    setValidationReporter((error) => reported.push(error))
    expect(() => assertValid(RowSchema, {}, 'dev boundary')).toThrow(ValidationError)
    expect(reported).toHaveLength(0)
  })
})

describe('parseValid', () => {
  it('returns the value on the success channel', () => {
    const result = parseValid(RowSchema, { fen: 'x', moves: [] }, 'test')
    expect(result).toEqual({ ok: true, value: { fen: 'x', moves: [] } })
  })

  it('returns a DomainError naming the field and the source, without throwing', () => {
    const result = parseValid(RowSchema, { fen: '', moves: [{ san: 1 }] }, 'puzzle CSV row 42')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a failure')
    expect(result.error.code).toBe('validation')
    expect(result.error.where).toBe('puzzle CSV row 42')
    expect(result.error.message).toContain('puzzle CSV row 42')
    expect(result.error.details?.[0]).toContain('fen')
    expect(result.error.details?.[1]).toContain('moves[0].san')
  })
})

describe('message formatting', () => {
  const issues = [
    { path: 'fen', message: 'Required', code: 'invalid_type' },
    { path: 'rating', message: 'Too big', code: 'too_big' },
    { path: 'tags[0]', message: 'Required', code: 'invalid_type' },
    { path: 'theme', message: 'Required', code: 'invalid_type' },
  ]

  it('lists every field in the detailed form', () => {
    const detail = formatValidationDetail('puzzle CSV row 42', issues)
    expect(detail).toBe(
      [
        'Invalid data from "puzzle CSV row 42":',
        '  • fen — Required',
        '  • rating — Too big',
        '  • tags[0] — Required',
        '  • theme — Required',
      ].join('\n'),
    )
  })

  it('truncates the field list in the short form', () => {
    expect(formatValidationSummary('puzzle CSV row 42', issues)).toBe(
      'Invalid data from "puzzle CSV row 42" (4 problems: fen, rating, tags[0], +1 more)',
    )
  })

  it('says "1 problem" for a single issue', () => {
    expect(formatValidationSummary('worker message', [issues[0]!])).toBe(
      'Invalid data from "worker message" (1 problem: fen)',
    )
  })

  it('calls the root by a name a human recognises', () => {
    const error = RowSchema.safeParse('not an object').error
    expect(error).toBeDefined()
    expect(toValidationIssues(error!)[0]?.path).toBe('(root)')
  })
})

describe('isValid', () => {
  it('answers without building an error', () => {
    expect(isValid(PuzzleSchema, makePuzzle())).toBe(true)
    expect(isValid(PuzzleSchema, {})).toBe(false)
  })
})
