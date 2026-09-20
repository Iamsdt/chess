import { describe, expect, it } from 'vitest'

import { toTimestamp } from '@/domain'

import {
  backoffDelayMs,
  classifyFailure,
  DEFAULT_BACKOFF,
  isAbortError,
  NonRetryableJobError,
  toJobError,
  type BackoffPolicy,
} from './backoff'

const NO_JITTER: BackoffPolicy = { baseMs: 100, factor: 3, maxMs: 1_000, jitter: 0 }
const AT = toTimestamp(1_700_000_000_000)

describe('backoffDelayMs', () => {
  it('grows by the factor on every attempt', () => {
    expect(backoffDelayMs(1, NO_JITTER)).toBe(100)
    expect(backoffDelayMs(2, NO_JITTER)).toBe(300)
    expect(backoffDelayMs(3, NO_JITTER)).toBe(900)
  })

  it('never exceeds the ceiling, however many attempts there have been', () => {
    expect(backoffDelayMs(4, NO_JITTER)).toBe(1_000)
    expect(backoffDelayMs(40, NO_JITTER)).toBe(1_000)
  })

  it('spreads the delay by the jitter ratio in both directions', () => {
    const policy: BackoffPolicy = { ...NO_JITTER, jitter: 0.5 }
    expect(backoffDelayMs(1, policy, () => 0)).toBe(50)
    expect(backoffDelayMs(1, policy, () => 1)).toBe(150)
    expect(backoffDelayMs(1, policy, () => 0.5)).toBe(100)
  })

  it('never returns a negative delay', () => {
    const policy: BackoffPolicy = { ...NO_JITTER, jitter: 4 }
    expect(backoffDelayMs(1, policy, () => 0)).toBe(0)
  })

  it('starts the default curve at a second and tops out at five minutes', () => {
    expect(backoffDelayMs(1, { ...DEFAULT_BACKOFF, jitter: 0 })).toBe(1_000)
    expect(backoffDelayMs(99, { ...DEFAULT_BACKOFF, jitter: 0 })).toBe(300_000)
  })
})

describe('classifyFailure', () => {
  it('treats an abort as a cancellation, not a failure', () => {
    const aborted = new Error('Aborted')
    aborted.name = 'AbortError'
    expect(classifyFailure(aborted, 1, 3)).toBe('cancelled')
    expect(isAbortError(aborted)).toBe(true)
  })

  it('does not spend attempts on work that can never succeed', () => {
    expect(classifyFailure(new NonRetryableJobError('bad payload'), 1, 3)).toBe('failed')
  })

  it('retries while attempts remain and quarantines once they do not', () => {
    expect(classifyFailure(new Error('flaky'), 1, 3)).toBe('retry')
    expect(classifyFailure(new Error('flaky'), 2, 3)).toBe('retry')
    expect(classifyFailure(new Error('flaky'), 3, 3)).toBe('quarantine')
  })

  it('recognises an abort that is not an Error instance', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(true)
    expect(isAbortError('AbortError')).toBe(false)
    expect(isAbortError(null)).toBe(false)
  })
})

describe('toJobError', () => {
  it('keeps the message and the error name as a code', () => {
    const error = new TypeError('fen is not a string')
    expect(toJobError(error, AT)).toEqual({
      message: 'fen is not a string',
      code: 'TypeError',
      occurredAt: AT,
    })
  })

  it('uses the handler-supplied code for a non-retryable failure', () => {
    expect(toJobError(new NonRetryableJobError('nope', 'bad-pgn'), AT).code).toBe('bad-pgn')
  })

  it('leaves out the code for a plain Error', () => {
    expect(toJobError(new Error('boom'), AT)).toEqual({ message: 'boom', occurredAt: AT })
  })

  it('survives something that is not an error at all', () => {
    expect(toJobError('a thrown string', AT)).toEqual({ message: 'Job failed', occurredAt: AT })
  })
})
