import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'

import { isCoachError } from '../port'

import { listModels, testConnection } from './models'

import type { LanguageModel } from 'ai'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('listModels', () => {
  it('lists OpenAI-compatible models with a bearer key', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(jsonResponse({ data: [{ id: 'b' }, { id: 'a' }, { id: 'a' }] })),
    )
    const models = await listModels(
      { provider: 'groq', model: '', apiKey: 'k' },
      { fetch: fetcher },
    )
    expect(models.map((m) => m.id)).toEqual(['a', 'b'])
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/models',
      expect.objectContaining({ headers: { authorization: 'Bearer k' } }),
    )
  })

  it('lists local servers without a key', async () => {
    const fetcher = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(jsonResponse({ data: [{ id: 'llama3.2' }] })),
    )
    await listModels(
      { provider: 'ollama', model: '', baseUrl: 'http://localhost:1/v1' },
      { fetch: fetcher },
    )
    expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:1/v1/models')
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({})
  })

  it('filters Gemini to generateContent models and strips the models/ prefix', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          models: [
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
          ],
        }),
      ),
    )
    const models = await listModels(
      { provider: 'gemini', model: '', apiKey: 'k' },
      { fetch: fetcher },
    )
    expect(models).toEqual([{ id: 'gemini-2.5-flash' }])
  })

  it('sends Anthropic version and browser-access headers', async () => {
    const fetcher = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(
        jsonResponse({ data: [{ id: 'claude-haiku-4-5', display_name: 'Haiku 4.5' }] }),
      ),
    )
    const models = await listModels(
      { provider: 'anthropic', model: '', apiKey: 'k' },
      { fetch: fetcher },
    )
    expect(models).toEqual([{ id: 'claude-haiku-4-5', label: 'Haiku 4.5' }])
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      'x-api-key': 'k',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    })
  })

  it('maps failures to calm CoachErrors', async () => {
    const rejected = await listModels(
      { provider: 'openai', model: '', apiKey: 'bad' },
      { fetch: () => Promise.resolve(jsonResponse({ error: 'bad bad' }, 401)) },
    ).catch((e: unknown) => e)
    expect(isCoachError(rejected) && rejected.message).toContain('key was rejected')

    const blocked = await listModels(
      { provider: 'ollama', model: '' },
      { fetch: () => Promise.reject(new TypeError('Failed to fetch')) },
    ).catch((e: unknown) => e)
    expect(isCoachError(blocked) && blocked.message).toContain('OLLAMA_ORIGINS')
  })

  it('returns an empty list for an unexpected body', async () => {
    const models = await listModels(
      { provider: 'custom', model: '', baseUrl: 'http://x.test/v1' },
      { fetch: () => Promise.resolve(jsonResponse({ nope: true })) },
    )
    expect(models).toEqual([])
  })
})

describe('testConnection', () => {
  const okModel = new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: 'OK' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    },
  })

  it('reports latency and model on success', async () => {
    let tick = 0
    const result = await testConnection(
      { provider: 'openai', model: 'gpt-5-mini', apiKey: 'k' },
      { createModel: () => Promise.resolve(okModel as LanguageModel), now: () => (tick += 40) },
    )
    expect(result).toEqual({ ok: true, latencyMs: 40, model: 'gpt-5-mini' })
  })

  it('reports a calm message on failure, without the key', async () => {
    const failing = new MockLanguageModelV4({
      doGenerate: () =>
        Promise.reject(Object.assign(new Error('nope sk-SECRET'), { statusCode: 401 })),
    })
    const result = await testConnection(
      { provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'sk-SECRET' },
      { createModel: () => Promise.resolve(failing as LanguageModel) },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Anthropic key was rejected')
      expect(result.message).not.toContain('SECRET')
    }
  })

  it('asks for a model name first', async () => {
    const result = await testConnection({
      provider: 'custom',
      model: ' ',
      baseUrl: 'http://x.test/v1',
    })
    expect(result).toEqual({ ok: false, message: 'Pick or type a model name first.' })
  })
})
