import type { CoachProvider } from '@/domain'

import { CoachError } from '../port'

import { effectiveBaseUrl, PROVIDER_PRESETS } from './providers'

import type { LanguageModel } from 'ai'

/**
 * S21 · Turns a settings row (plus a key that never lived in it) into an AI SDK model.
 *
 * Why every SDK package is imported inside the function: the AI SDK and its provider
 * packages are the heaviest thing in the app and most sessions never open the coach with a key.
 * A static import would put them in the initial bundle and break the 200 KB budget; a dynamic
 * one makes the chunk load on the first real question.
 *
 * Why the OpenAI-compatible package carries so many providers: Groq, DeepSeek, Mistral, xAI,
 * OpenRouter, Ollama and LM Studio all implement the chat-completions wire format, and that
 * package lets us name the provider and set the base URL without a vendor package each. We use
 * it rather than `@ai-sdk/openai` + `baseURL` because `@ai-sdk/openai` v4 defaults to the newer
 * Responses API, which most of these servers do not implement; `chatModel` stays on
 * `/chat/completions`. `includeUsage` makes the server send token counts on the last chunk, which
 * the usage meter needs. Real OpenAI keeps its own package and its own defaults.
 */

export interface CoachModelConfig {
  readonly provider: CoachProvider
  readonly model: string
  /** Overrides the preset's endpoint. */
  readonly baseUrl?: string | undefined
  /** Decrypted just-in-time by the caller; never stored on this object's owner. */
  readonly apiKey?: string | undefined
}

/**
 * Anthropic refuses browser calls unless the caller states it knows the key is exposed to the page.
 * It is: that is the BYOK trade-off the Settings panel explains.
 */
export const ANTHROPIC_BROWSER_HEADERS = {
  'anthropic-dangerous-direct-browser-access': 'true',
} as const

function openRouterHeaders(): Record<string, string> {
  // Optional attribution headers; OpenRouter uses them for its public app rankings.
  const origin = typeof location === 'undefined' ? '' : location.origin
  return {
    ...(origin === '' ? {} : { 'HTTP-Referer': origin }),
    'X-Title': 'Chess King',
  }
}

export async function createLanguageModel(config: CoachModelConfig): Promise<LanguageModel> {
  const preset = PROVIDER_PRESETS[config.provider]
  const baseURL = effectiveBaseUrl(config.provider, config.baseUrl)
  const apiKey = config.apiKey === undefined || config.apiKey === '' ? undefined : config.apiKey

  if (baseURL === '') {
    throw new CoachError('Add the server address for your custom model in Settings first.', {
      retryable: false,
    })
  }
  if (preset.keyPolicy === 'required' && apiKey === undefined) {
    throw new CoachError(`Add your ${preset.label} API key in Settings to use Sage.`, {
      retryable: false,
    })
  }

  switch (preset.kind) {
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      return createOpenAI({ baseURL, ...(apiKey === undefined ? {} : { apiKey }) })(config.model)
    }
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      return createAnthropic({
        baseURL,
        headers: ANTHROPIC_BROWSER_HEADERS,
        ...(apiKey === undefined ? {} : { apiKey }),
      })(config.model)
    }
    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
      return createGoogleGenerativeAI({
        baseURL,
        ...(apiKey === undefined ? {} : { apiKey }),
      })(config.model)
    }
    case 'openai-compatible': {
      const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible')
      return createOpenAICompatible({
        name: config.provider,
        baseURL,
        includeUsage: true,
        ...(apiKey === undefined ? {} : { apiKey }),
        ...(config.provider === 'openrouter' ? { headers: openRouterHeaders() } : {}),
      }).chatModel(config.model)
    }
  }
}
