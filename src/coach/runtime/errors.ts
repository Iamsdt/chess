import type { CoachProvider } from '@/domain'

import { CoachError, isCoachError } from '../port'

import { effectiveBaseUrl, PROVIDER_PRESETS } from './providers'

/**
 * S21 · Provider failures, in one calm sentence each.
 *
 * Why duck-typed instead of `APICallError.isInstance`: that would need a static import of the AI
 * SDK, which belongs to a lazy chunk. The fields read here (`statusCode`, `lastError`, `cause`,
 * `name`) are the stable surface of the SDK's errors.
 *
 * Why the raw body and message are never used: a provider's error JSON is noise to a learner and
 * occasionally echoes request headers. The only text that reaches the user is written here, and
 * the only dynamic parts are the provider's label, the model name the user typed and the endpoint
 * they typed, none of which is secret.
 */

export interface ErrorContext {
  readonly provider: CoachProvider
  readonly model: string
  readonly baseUrl?: string | undefined
}

interface ErrorLike {
  readonly name?: unknown
  readonly message?: unknown
  readonly statusCode?: unknown
  readonly status?: unknown
  readonly lastError?: unknown
  readonly cause?: unknown
}

function asErrorLike(value: unknown): ErrorLike | undefined {
  return typeof value === 'object' && value !== null ? value : undefined
}

/** Retries wrap the real failure; the status code lives on the last attempt. */
function unwrap(error: unknown): unknown {
  let current = error
  for (let depth = 0; depth < 4; depth += 1) {
    const like = asErrorLike(current)
    if (like?.lastError === undefined) break
    current = like.lastError
  }
  return current
}

function statusOf(error: unknown): number | undefined {
  const like = asErrorLike(error)
  if (like === undefined) return undefined
  if (typeof like.statusCode === 'number') return like.statusCode
  if (typeof like.status === 'number') return like.status
  return statusOf(like.cause)
}

const NETWORK_PATTERN =
  /failed to fetch|networkerror|load failed|fetch failed|network request failed/i

function isNetworkFailure(error: unknown): boolean {
  const like = asErrorLike(error)
  if (like === undefined) return false
  if (like.name === 'TypeError') return true
  if (typeof like.message === 'string' && NETWORK_PATTERN.test(like.message)) return true
  return like.cause === undefined ? false : isNetworkFailure(like.cause)
}

function isTimeout(error: unknown): boolean {
  const like = asErrorLike(error)
  return like?.name === 'TimeoutError' || like?.name === 'AbortError'
}

function networkMessage(context: ErrorContext): string {
  const preset = PROVIDER_PRESETS[context.provider]
  const where = effectiveBaseUrl(context.provider, context.baseUrl)
  if (context.provider === 'ollama') {
    return `Sage couldn't reach Ollama at ${where}. Make sure it is running and was started with OLLAMA_ORIGINS allowing this site.`
  }
  if (context.provider === 'lmstudio') {
    return `Sage couldn't reach LM Studio at ${where}. Start its local server and turn on "Enable CORS".`
  }
  if (context.provider === 'custom') {
    return `Sage couldn't reach ${where || 'your server'}. Check the address, and that the server allows requests from this page (CORS).`
  }
  return `Sage couldn't reach ${preset.label}. Check your connection and try again.`
}

/**
 * Maps anything a provider call can throw to a {@link CoachError}.
 * Aborts are not failures and must be handled by the caller before this is reached.
 */
export function toCoachError(error: unknown, context: ErrorContext): CoachError {
  if (isCoachError(error)) return error
  if (asErrorLike(error)?.name === 'VaultLockedError') {
    return new CoachError('Your key is locked. Unlock it with your passphrase in Settings.', {
      retryable: false,
    })
  }

  const real = unwrap(error)
  const preset = PROVIDER_PRESETS[context.provider]
  const status = statusOf(real)

  if (status === 401 || status === 403) {
    return new CoachError(
      preset.keyPolicy === 'none'
        ? `${preset.label} refused the request. Check the server's access settings.`
        : `Your ${preset.label} key was rejected. Check it in Settings, or paste a new one.`,
      { retryable: false },
    )
  }
  if (status === 404) {
    return new CoachError(
      context.provider === 'custom' || preset.baseUrlEditable === 'primary'
        ? `${preset.label} doesn't know the model "${context.model}", or the server address is wrong. Check both in Settings.`
        : `${preset.label} doesn't know the model "${context.model}". Pick another in Settings.`,
      { retryable: false },
    )
  }
  if (status === 429) {
    return new CoachError(
      `${preset.label} says you've hit its rate limit or run out of credit. Wait a moment, then try again.`,
      { retryable: true },
    )
  }
  if (status === 400 || status === 422) {
    return new CoachError(
      `${preset.label} didn't accept that request for "${context.model}". Try a different model in Settings.`,
      { retryable: false },
    )
  }
  if (status !== undefined && status >= 500) {
    return new CoachError(`${preset.label} is having trouble right now. Try again in a moment.`, {
      retryable: true,
    })
  }
  if (isTimeout(real)) {
    return new CoachError(`${preset.label} took too long to answer. Try again.`, {
      retryable: true,
    })
  }
  if (isNetworkFailure(real)) {
    return new CoachError(networkMessage(context), { retryable: true })
  }
  return new CoachError(`Sage couldn't get an answer from ${preset.label}. Try again.`, {
    retryable: true,
  })
}
