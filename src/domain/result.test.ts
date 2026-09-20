import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  andThen,
  collectResults,
  domainError,
  err,
  isErr,
  isOk,
  mapErr,
  mapOk,
  ok,
  partitionResults,
  unwrapOr,
  type DomainError,
  type Err,
  type Ok,
  type Result,
} from './result'

describe('Result', () => {
  it('carries a value on the success channel', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 })
  })

  it('carries an error on the failure channel', () => {
    expect(err('nope')).toEqual({ ok: false, error: 'nope' })
  })

  it('guards narrow in both directions', () => {
    const success: Result<number, string> = ok(1)
    const failure: Result<number, string> = err('bad')
    expect(isOk(success)).toBe(true)
    expect(isErr(success)).toBe(false)
    expect(isOk(failure)).toBe(false)
    expect(isErr(failure)).toBe(true)
  })

  it('falls back only on failure', () => {
    expect(unwrapOr<number, string>(ok(1), 9)).toBe(1)
    expect(unwrapOr<number, string>(err('bad'), 9)).toBe(9)
  })

  it('maps only the channel it was asked to map', () => {
    expect(mapOk<number, number, string>(ok(2), (n) => n * 2)).toEqual({ ok: true, value: 4 })
    expect(mapOk<number, number, string>(err('bad'), (n) => n * 2)).toEqual({
      ok: false,
      error: 'bad',
    })
    expect(mapErr<number, string, string>(err('bad'), (e) => `${e}!`)).toEqual({
      ok: false,
      error: 'bad!',
    })
    expect(mapErr<number, string, string>(ok(2), (e) => `${e}!`)).toEqual({ ok: true, value: 2 })
  })

  it('short-circuits a chain at the first failure', () => {
    const double = (n: number): Result<number, string> => ok(n * 2)
    expect(andThen<number, number, string>(ok(2), double)).toEqual({ ok: true, value: 4 })
    expect(andThen<number, number, string>(err('bad'), double)).toEqual({ ok: false, error: 'bad' })
  })

  it('collects all-or-nothing', () => {
    expect(collectResults<number, string>([ok(1), ok(2)])).toEqual({ ok: true, value: [1, 2] })
    expect(collectResults<number, string>([ok(1), err('bad'), ok(2)])).toEqual({
      ok: false,
      error: 'bad',
    })
  })

  it('partitions so an importer can skip a bad row and report it', () => {
    expect(partitionResults<number, string>([ok(1), err('bad'), ok(2)])).toEqual({
      values: [1, 2],
      errors: ['bad'],
    })
  })
})

describe('domainError', () => {
  it('names the source so a log line is actionable', () => {
    const error = domainError('validation', 'Invalid row', {
      where: 'puzzle CSV row 42',
      details: ['fen — Not a well-formed six-field FEN'],
    })
    expect(error.code).toBe('validation')
    expect(error.where).toBe('puzzle CSV row 42')
    expect(error.details).toEqual(['fen — Not a well-formed six-field FEN'])
  })
})

describe('Result types', () => {
  it('narrows to Ok and Err through the discriminant', () => {
    // Why a function: a `const` initialised with `ok()` is narrowed by TypeScript
    // before the guard ever runs, which would make the test prove nothing.
    const load = (): Result<number, string> => ok(1)
    const value = load()
    if (value.ok) {
      expectTypeOf(value).toEqualTypeOf<Ok<number>>()
      expectTypeOf(value.value).toEqualTypeOf<number>()
    } else {
      expectTypeOf(value).toEqualTypeOf<Err<string>>()
      expectTypeOf(value.error).toEqualTypeOf<string>()
    }
  })

  it('does not expose a value on the failure branch', () => {
    expectTypeOf<Err<string>>().not.toHaveProperty('value')
    expectTypeOf<Ok<number>>().not.toHaveProperty('error')
  })

  it('defaults its error channel to DomainError', () => {
    expectTypeOf<Result<number>>().toEqualTypeOf<Ok<number> | Err<DomainError>>()
  })
})
