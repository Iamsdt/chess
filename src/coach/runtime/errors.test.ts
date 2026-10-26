import { describe, expect, it } from 'vitest'

import { CoachError } from '../port'

import { toCoachError } from './errors'

const SECRET = 'sk-test-SECRET-1234567890'

function apiError(statusCode: number): Error {
  // Mimics the AI SDK's APICallError, including a body that echoes the key.
  return Object.assign(new Error(`HTTP ${String(statusCode)}`), {
    statusCode,
    responseBody: `{"error":"bad key ${SECRET}"}`,
    requestBodyValues: { authorization: SECRET },
  })
}

const ctx = { provider: 'openai', model: 'gpt-5-mini' } as const

describe('toCoachError', () => {
  it('maps 401 and 403 to a non-retryable key message that never shows the key', () => {
    for (const status of [401, 403]) {
      const error = toCoachError(apiError(status), ctx)
      expect(error).toBeInstanceOf(CoachError)
      expect(error.retryable).toBe(false)
      expect(error.message).toBe(
        'Your OpenAI key was rejected. Check it in Settings, or paste a new one.',
      )
      expect(error.message).not.toContain(SECRET)
    }
  })

  it('maps 429 to a retryable rate-limit message', () => {
    const error = toCoachError(apiError(429), ctx)
    expect(error.retryable).toBe(true)
    expect(error.message).toContain('rate limit')
  })

  it('names the model on 404', () => {
    const error = toCoachError(apiError(404), ctx)
    expect(error.retryable).toBe(false)
    expect(error.message).toContain('"gpt-5-mini"')
  })

  it('sees through retry wrappers', () => {
    const wrapped = Object.assign(new Error('Failed after 3 attempts'), {
      lastError: apiError(401),
    })
    expect(toCoachError(wrapped, ctx).message).toContain('key was rejected')
  })

  it('explains Ollama CORS on a network failure', () => {
    const error = toCoachError(new TypeError('Failed to fetch'), {
      provider: 'ollama',
      model: 'llama3.2',
    })
    expect(error.retryable).toBe(true)
    expect(error.message).toContain('OLLAMA_ORIGINS')
  })

  it('treats 5xx as retryable and unknown failures as retryable but generic', () => {
    expect(toCoachError(apiError(503), ctx).retryable).toBe(true)
    const unknown = toCoachError(new Error(`weird ${SECRET}`), ctx)
    expect(unknown.retryable).toBe(true)
    expect(unknown.message).not.toContain(SECRET)
  })

  it('passes a CoachError through and maps a locked vault', () => {
    const own = new CoachError('already calm')
    expect(toCoachError(own, ctx)).toBe(own)
    const locked = Object.assign(new Error('locked'), { name: 'VaultLockedError' })
    expect(toCoachError(locked, ctx).retryable).toBe(false)
  })
})
