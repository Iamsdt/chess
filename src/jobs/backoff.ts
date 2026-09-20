import { isValidationError, type JobError, type Timestamp } from '@/domain'

/**
 * When a failed job runs again, and when it stops being allowed to.
 *
 * Why this is its own file: the retry curve and the poison-job rule are the two
 * pieces of the queue most likely to be argued about, and they are pure functions
 * of `(attempt, error)`. Keeping them out of the scheduler means they can be read,
 * tested and changed without reading the scheduler.
 */

export interface BackoffPolicy {
  readonly baseMs: number
  readonly factor: number
  readonly maxMs: number
  /**
   * Random spread, as a ±ratio of the delay.
   *
   * Why jitter at all in a single-user app: two tabs recover from the same crash at
   * the same instant, and without spread they would retry in lockstep for ever.
   */
  readonly jitter: number
}

/** 1 s, 4 s, 16 s, … capped at five minutes: long enough to outlast a flaky import. */
export const DEFAULT_BACKOFF: BackoffPolicy = {
  baseMs: 1_000,
  factor: 4,
  maxMs: 300_000,
  jitter: 0.2,
}

/** Three tries is the `Job` schema's own default; the queue agrees with it. */
export const DEFAULT_MAX_ATTEMPTS = 3

/**
 * How long to wait before attempt number `attempt` (1-based).
 *
 * Attempt 1 is the first *re*-run, so the curve starts at `baseMs` rather than 0.
 */
export function backoffDelayMs(
  attempt: number,
  policy: BackoffPolicy = DEFAULT_BACKOFF,
  random: () => number = Math.random,
): number {
  const exponent = Math.max(0, attempt - 1)
  const plain = Math.min(policy.baseMs * policy.factor ** exponent, policy.maxMs)
  const spread = plain * policy.jitter * (random() * 2 - 1)
  return Math.max(0, Math.round(plain + spread))
}

/**
 * Thrown by a handler that knows retrying is pointless — a malformed payload, a
 * game that no longer exists, a pack the user deleted.
 *
 * Why an error class rather than a return value: `JobHandler` returns `Promise<void>`
 * by the seam four other sprints already code against, so "this failed and here is
 * how" has nowhere else to go.
 */
export class NonRetryableJobError extends Error {
  override readonly name = 'NonRetryableJobError'
  readonly code: string

  constructor(message: string, code = 'non-retryable') {
    super(message)
    this.code = code
  }
}

/**
 * What to do with a job whose handler just threw.
 *
 * - `cancelled` — somebody aborted it; not a failure, no retry.
 * - `failed` — the work can never succeed, so spending two more attempts on it is
 *   waste. A bad payload is the common case, and `ValidationError` says so.
 * - `quarantine` — it has used up its attempts. It stops being scheduled and waits
 *   for a human in `/dev/jobs`; `pruneFinished` deliberately leaves it alone.
 * - `retry` — everything else, after `backoffDelayMs`.
 */
export type FailureDisposition = 'cancelled' | 'failed' | 'quarantine' | 'retry'

export function classifyFailure(
  error: unknown,
  attempts: number,
  maxAttempts: number,
): FailureDisposition {
  if (isAbortError(error)) return 'cancelled'
  if (isValidationError(error) || error instanceof NonRetryableJobError) return 'failed'
  return attempts >= maxAttempts ? 'quarantine' : 'retry'
}

/**
 * Why this reads the shape instead of using `instanceof Error`: an abort arrives as
 * a `DOMException`, which is not reliably an `Error` in every runtime the tests and
 * the app run in — jsdom's is not.
 */
export function isAbortError(error: unknown): boolean {
  return readName(error) === 'AbortError'
}

/** Why: `lastError` is what `/dev/jobs` shows, so it must survive any thrown shape. */
export function toJobError(error: unknown, occurredAt: Timestamp): JobError {
  const read = readMessage(error)
  const message = read === undefined || read === '' ? 'Job failed' : read
  const code = error instanceof NonRetryableJobError ? error.code : errorCode(error)
  return code === undefined ? { message, occurredAt } : { message, code, occurredAt }
}

function errorCode(error: unknown): string | undefined {
  const name = readName(error)
  return name === undefined || name === 'Error' ? undefined : name
}

/** Why read the shape: an `Error`, a `DOMException` and a thrown literal all arrive here. */
function readName(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('name' in value)) return undefined
  return typeof value.name === 'string' ? value.name : undefined
}

function readMessage(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('message' in value)) return undefined
  return typeof value.message === 'string' ? value.message : undefined
}
