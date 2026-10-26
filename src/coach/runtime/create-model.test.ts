import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isCoachError } from '../port'

const calls = vi.hoisted(() => ({
  openai: vi.fn(),
  anthropic: vi.fn(),
  google: vi.fn(),
  compatible: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (options: unknown) => {
    calls.openai(options)
    return (model: string) => ({ via: 'openai', model })
  },
}))
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (options: unknown) => {
    calls.anthropic(options)
    return (model: string) => ({ via: 'anthropic', model })
  },
}))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: (options: unknown) => {
    calls.google(options)
    return (model: string) => ({ via: 'google', model })
  },
}))
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: (options: unknown) => {
    calls.compatible(options)
    return { chatModel: (model: string) => ({ via: 'compatible', model }) }
  },
}))

import { createLanguageModel } from './create-model'

beforeEach(() => {
  for (const mock of Object.values(calls)) mock.mockClear()
})

describe('createLanguageModel', () => {
  it('uses the vendor package for OpenAI, Anthropic and Gemini', async () => {
    expect(await createLanguageModel({ provider: 'openai', model: 'gpt-5', apiKey: 'k' })).toEqual({
      via: 'openai',
      model: 'gpt-5',
    })
    expect(calls.openai).toHaveBeenCalledWith({ baseURL: 'https://api.openai.com/v1', apiKey: 'k' })

    await createLanguageModel({ provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'k' })
    expect(calls.google).toHaveBeenCalledOnce()
    expect(calls.compatible).not.toHaveBeenCalled()
  })

  it('sends the browser-access header to Anthropic', async () => {
    await createLanguageModel({ provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'k' })
    expect(calls.anthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
        apiKey: 'k',
      }),
    )
  })

  it.each(['groq', 'deepseek', 'mistral', 'xai', 'openrouter'] as const)(
    'routes %s through the OpenAI-compatible package with usage on',
    async (provider) => {
      const model = await createLanguageModel({ provider, model: 'm', apiKey: 'k' })
      expect(model).toEqual({ via: 'compatible', model: 'm' })
      expect(calls.compatible).toHaveBeenCalledWith(
        expect.objectContaining({ name: provider, includeUsage: true, apiKey: 'k' }),
      )
    },
  )

  it('adds attribution headers for OpenRouter only', async () => {
    await createLanguageModel({ provider: 'openrouter', model: 'm', apiKey: 'k' })
    expect(calls.compatible.mock.calls[0]?.[0]).toMatchObject({
      headers: { 'X-Title': 'Chess King' },
    })
    await createLanguageModel({ provider: 'groq', model: 'm', apiKey: 'k' })
    expect(calls.compatible.mock.calls[1]?.[0]).not.toHaveProperty('headers')
  })

  it('needs no key for local servers and honours a base URL override', async () => {
    await createLanguageModel({
      provider: 'ollama',
      model: 'llama3.2',
      baseUrl: 'http://localhost:9999/v1/',
    })
    const options = calls.compatible.mock.calls[0]?.[0] as Record<string, unknown>
    expect(options.baseURL).toBe('http://localhost:9999/v1')
    expect(options).not.toHaveProperty('apiKey')
  })

  it('refuses a hosted provider without a key, and a custom one without an address', async () => {
    const missingKey = await createLanguageModel({ provider: 'openai', model: 'gpt-5' }).catch(
      (e: unknown) => e,
    )
    expect(isCoachError(missingKey) && missingKey.retryable).toBe(false)
    const missingUrl = await createLanguageModel({ provider: 'custom', model: 'x' }).catch(
      (e: unknown) => e,
    )
    expect(isCoachError(missingUrl) && missingUrl.message).toContain('server address')
  })
})
