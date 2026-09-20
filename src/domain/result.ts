/**
 * Boundary results.
 *
 * Why: the quality bar makes errors *values* at every boundary, so a caller that
 * can fail is forced by the type system to handle the failure path instead of
 * discovering it as an exception in production. Exceptions stay reserved for
 * programmer errors.
 */

/** Coarse machine-readable reason, so callers can branch without string matching. */
export const DOMAIN_ERROR_CODES = [
  'validation',
  'not-found',
  'conflict',
  'cancelled',
  'timeout',
  'unsupported',
  'io',
  'engine',
  'network',
  'unknown',
] as const

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number]

/**
 * The error value every domain boundary returns.
 *
 * Why the explicit `| undefined` on optional members: `exactOptionalPropertyTypes`
 * is on, and callers routinely build these with conditional spreads.
 */
export interface DomainError {
  readonly code: DomainErrorCode
  readonly message: string
  /** Human name of the source the bad data came from, e.g. `"puzzle CSV row 42"`. */
  readonly where?: string | undefined
  /** One readable line per problem, already field-qualified. */
  readonly details?: readonly string[] | undefined
  readonly cause?: unknown
}

/** Why: one constructor keeps every boundary's error shape identical and greppable. */
export function domainError(
  code: DomainErrorCode,
  message: string,
  options: {
    where?: string | undefined
    details?: readonly string[] | undefined
    cause?: unknown
  } = {},
): DomainError {
  return {
    code,
    message,
    where: options.where,
    details: options.details,
    cause: options.cause,
  }
}

export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

export interface Err<E> {
  readonly ok: false
  readonly error: E
}

export type Result<T, E = DomainError> = Ok<T> | Err<E>

/** Why: a success carrier that narrows through `result.ok` without a class. */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value })

/** Why: a failure carrier that narrows through `result.ok` without a class. */
export const err = <E>(error: E): Err<E> => ({ ok: false, error })

/** Why: type guard so `if (isOk(r))` narrows in places a property access reads badly. */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok

/** Why: mirror of `isOk` for early returns. */
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok

/** Why: the common "I have a sensible default" case, without an `if` at every call site. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback
}

/** Why: transform the success channel while leaving a failure untouched. */
export function mapOk<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result
}

/** Why: translate a lower layer's error into this layer's vocabulary. */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(fn(result.error))
}

/** Why: chain fallible steps without nesting `if (result.ok)` blocks. */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result
}

/**
 * Turn many results into one, failing on the first error.
 *
 * Why: importers (CSV rows, PGN games, backup records) need an all-or-nothing
 * answer far more often than they need a partial one.
 */
export function collectResults<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = []
  for (const result of results) {
    if (!result.ok) return result
    values.push(result.value)
  }
  return ok(values)
}

/**
 * Split many results into the parts that worked and the parts that did not.
 *
 * Why: the puzzle import must skip and *report* a bad row rather than abort the
 * whole band, which `collectResults` cannot express.
 */
export function partitionResults<T, E>(
  results: readonly Result<T, E>[],
): { values: T[]; errors: E[] } {
  const values: T[] = []
  const errors: E[] = []
  for (const result of results) {
    if (result.ok) values.push(result.value)
    else errors.push(result.error)
  }
  return { values, errors }
}
