import { z } from 'zod'

import { CoachError } from '../port'

import {
  createLanguageModel,
  ANTHROPIC_BROWSER_HEADERS,
  type CoachModelConfig,
} from './create-model'
import { toCoachError } from './errors'
import { effectiveBaseUrl, PROVIDER_PRESETS } from './providers'

import type { LanguageModel } from 'ai'

/**
 * S21 · "What can I pick?" and "does it work?" — the two buttons in Settings.
 *
 * Why plain `fetch` for listing: a model list is one GET, and the SDKs have no list call. Each
 * vendor shapes the response differently, so each gets a small zod parse; a server that answers
 * with something else produces an empty list, not a crash.
 *
 * Why `testConnection` goes through the real SDK path: a test that used a different code path
 * could pass while chat fails. It sends the smallest possible request and reports latency.
 */

export interface ModelInfo {
  readonly id: string
  readonly label?: string
}

const OpenAiListSchema = z.object({ data: z.array(z.object({ id: z.string().min(1) })) })
const GeminiListSchema = z.object({
  models: z.array(
    z.object({
      name: z.string().min(1),
      displayName: z.string().optional(),
      supportedGenerationMethods: z.array(z.string()).optional(),
    }),
  ),
})
const AnthropicListSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1), display_name: z.string().optional() })),
})

const LIST_TIMEOUT_MS = 12_000
export const TEST_TIMEOUT_MS = 20_000

export interface ListDeps {
  readonly fetch?: (url: string, init?: RequestInit) => Promise<Response>
}

function requestFor(config: CoachModelConfig): { url: string; headers: Record<string, string> } {
  const preset = PROVIDER_PRESETS[config.provider]
  const base = effectiveBaseUrl(config.provider, config.baseUrl)
  const key = config.apiKey === undefined || config.apiKey === '' ? undefined : config.apiKey
  switch (preset.kind) {
    case 'google':
      return {
        url: `${base}/models?pageSize=200`,
        headers: key === undefined ? {} : { 'x-goog-api-key': key },
      }
    case 'anthropic':
      return {
        url: `${base}/models?limit=100`,
        headers: {
          'anthropic-version': '2023-06-01',
          ...ANTHROPIC_BROWSER_HEADERS,
          ...(key === undefined ? {} : { 'x-api-key': key }),
        },
      }
    case 'openai':
    case 'openai-compatible':
      return {
        url: `${base}/models`,
        headers: key === undefined ? {} : { authorization: `Bearer ${key}` },
      }
  }
}

function parseModels(config: CoachModelConfig, body: unknown): ModelInfo[] {
  const kind = PROVIDER_PRESETS[config.provider].kind
  if (kind === 'google') {
    const parsed = GeminiListSchema.safeParse(body)
    if (!parsed.success) return []
    return parsed.data.models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? true)
      .map((m) => ({
        id: m.name.replace(/^models\//, ''),
        ...(m.displayName === undefined ? {} : { label: m.displayName }),
      }))
  }
  if (kind === 'anthropic') {
    const parsed = AnthropicListSchema.safeParse(body)
    if (!parsed.success) return []
    return parsed.data.data.map((m) => ({
      id: m.id,
      ...(m.display_name === undefined ? {} : { label: m.display_name }),
    }))
  }
  const parsed = OpenAiListSchema.safeParse(body)
  return parsed.success ? parsed.data.data.map((m) => ({ id: m.id })) : []
}

/**
 * Lists the models a provider offers. Throws a {@link CoachError} with a calm message on failure,
 * so Settings can show it as-is.
 */
export async function listModels(
  config: CoachModelConfig,
  deps: ListDeps = {},
): Promise<ModelInfo[]> {
  const doFetch = deps.fetch ?? ((url: string, init?: RequestInit) => fetch(url, init))
  const { url, headers } = requestFor(config)
  const context = { provider: config.provider, model: config.model, baseUrl: config.baseUrl }
  try {
    const response = await doFetch(url, {
      headers,
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    })
    if (!response.ok)
      throw Object.assign(new Error('Request failed'), { statusCode: response.status })
    const models = parseModels(config, await response.json())
    return [...new Map(models.map((m) => [m.id, m])).values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    )
  } catch (error) {
    // A 404 on `/models` means "this server has no list", not "your model is wrong".
    if ((error as { statusCode?: number } | undefined)?.statusCode === 404) {
      throw new CoachError(
        `${PROVIDER_PRESETS[config.provider].label} didn't return a model list. Type the model name instead.`,
        { retryable: false },
      )
    }
    throw toCoachError(error, context)
  }
}

export type ConnectionResult =
  | { readonly ok: true; readonly latencyMs: number; readonly model: string }
  | { readonly ok: false; readonly message: string }

export interface TestDeps {
  readonly createModel?: (config: CoachModelConfig) => Promise<LanguageModel>
  readonly timeoutMs?: number
  readonly now?: () => number
}

/** One tiny round trip: "Reply with OK". Never throws. */
export async function testConnection(
  config: CoachModelConfig,
  deps: TestDeps = {},
): Promise<ConnectionResult> {
  const createModel = deps.createModel ?? createLanguageModel
  const now = deps.now ?? (() => performance.now())
  const context = { provider: config.provider, model: config.model, baseUrl: config.baseUrl }
  if (config.model.trim() === '') {
    return { ok: false, message: 'Pick or type a model name first.' }
  }
  try {
    const model = await createModel(config)
    const { generateText } = await import('ai')
    const started = now()
    await generateText({
      model,
      prompt: 'Reply with OK',
      maxOutputTokens: 16,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(deps.timeoutMs ?? TEST_TIMEOUT_MS),
    })
    return { ok: true, latencyMs: Math.max(1, Math.round(now() - started)), model: config.model }
  } catch (error) {
    return { ok: false, message: toCoachError(error, context).message }
  }
}
