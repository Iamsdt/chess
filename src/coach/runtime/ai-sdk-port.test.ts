import { MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'

import { makeCoachContext, makeCoachMessage, toMessageId } from '@/domain'

import { type CoachError, isCoachError, type CoachDelta } from '../port'

import {
  createAiSdkCoach,
  toModelMessages,
  type CoachRuntimeConfig,
  type UsageStore,
} from './ai-sdk-port'

import type { LanguageModel } from 'ai'

const SECRET = 'sk-test-SECRET-1234567890'

const config: CoachRuntimeConfig = {
  provider: 'openai',
  model: 'gpt-5-mini',
  apiKey: SECRET,
  monthlyTokenCap: 100_000,
}

function textStream(chunks: readonly string[], usage = { input: 21, output: 7 }) {
  return {
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'text-start' as const, id: 't' },
      ...chunks.map((delta) => ({ type: 'text-delta' as const, id: 't', delta })),
      { type: 'text-end' as const, id: 't' },
      {
        type: 'finish' as const,
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: { total: usage.input, noCache: usage.input, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: usage.output, text: usage.output, reasoning: 0 },
        },
      },
    ]),
  }
}

function memoryUsage(
  used = 0,
): UsageStore & { recorded: { promptTokens: number; completionTokens: number }[] } {
  const recorded: { promptTokens: number; completionTokens: number }[] = []
  return {
    recorded,
    read: () => Promise.resolve({ promptTokens: used, completionTokens: 0, requests: 0 }),
    record: (tokens) => {
      recorded.push(tokens)
      return Promise.resolve()
    },
  }
}

const thread = [
  makeCoachMessage({ role: 'sage', text: 'Hi, I am Sage.' }),
  makeCoachMessage({ id: toMessageId('m2'), role: 'user', text: 'Why Nf3?' }),
]

async function collect(iterable: AsyncIterable<CoachDelta>): Promise<CoachDelta[]> {
  const out: CoachDelta[] = []
  for await (const delta of iterable) out.push(delta)
  return out
}

describe('createAiSdkCoach', () => {
  it('streams mode, text deltas and a final usage delta', async () => {
    const model = new MockLanguageModelV4({ doStream: textStream(['Knights ', 'love ', 'f3.']) })
    const usage = memoryUsage()
    const port = createAiSdkCoach(() => Promise.resolve(config), {
      createModel: () => Promise.resolve(model as LanguageModel),
      usage,
    })

    const deltas = await collect(
      port.send(thread, makeCoachContext({ screen: 'analysis' }), {
        signal: new AbortController().signal,
      }),
    )

    expect(deltas[0]).toEqual({ kind: 'mode', mode: 'grandmaster' })
    expect(
      deltas
        .filter((d) => d.kind === 'text')
        .map((d) => d.text)
        .join(''),
    ).toBe('Knights love f3.')
    expect(deltas.at(-1)).toEqual({
      kind: 'usage',
      usage: { promptTokens: 21, completionTokens: 7 },
      provider: 'openai',
      model: 'gpt-5-mini',
    })
    expect(usage.recorded).toEqual([{ promptTokens: 21, completionTokens: 7 }])

    // What the model was sent: the system prompt, and the thread without Sage's greeting.
    const sent = model.doStreamCalls[0]?.prompt ?? []
    expect(sent[0]?.role).toBe('system')
    expect(sent.filter((m) => m.role === 'user')).toHaveLength(1)
    expect(sent.some((m) => m.role === 'assistant')).toBe(false)
    expect(JSON.stringify(sent)).not.toContain(SECRET)
  })

  it('stops when the user aborts and shows no error', async () => {
    const model = new MockLanguageModelV4({ doStream: textStream(['a', 'b', 'c']) })
    const controller = new AbortController()
    const port = createAiSdkCoach(() => Promise.resolve(config), {
      createModel: () => Promise.resolve(model as LanguageModel),
      usage: memoryUsage(),
    })

    const seen: CoachDelta[] = []
    for await (const delta of port.send(thread, makeCoachContext(), {
      signal: controller.signal,
    })) {
      seen.push(delta)
      if (delta.kind === 'text') controller.abort()
    }

    expect(seen.filter((d) => d.kind === 'text').length).toBeLessThanOrEqual(1)
    expect(seen.some((d) => d.kind === 'usage')).toBe(false)
  })

  it('turns a 401 into a non-retryable CoachError that does not contain the key', async () => {
    const model = new MockLanguageModelV4({
      doStream: () =>
        Promise.reject(
          Object.assign(new Error(`Incorrect API key ${SECRET}`), {
            statusCode: 401,
            responseBody: SECRET,
          }),
        ),
    })
    const port = createAiSdkCoach(() => Promise.resolve(config), {
      createModel: () => Promise.resolve(model as LanguageModel),
      usage: memoryUsage(),
    })

    const error = await collect(
      port.send(thread, makeCoachContext(), { signal: new AbortController().signal }),
    ).catch((e: unknown) => e)

    expect(isCoachError(error)).toBe(true)
    const coachError = error as CoachError
    expect(coachError.retryable).toBe(false)
    expect(coachError.message).toContain('OpenAI key was rejected')
    expect(coachError.message).not.toContain(SECRET)
  })

  it('refuses once the monthly cap is used, without calling the model', async () => {
    const createModel = vi.fn()
    const port = createAiSdkCoach(() => Promise.resolve({ ...config, monthlyTokenCap: 1_000 }), {
      createModel,
      usage: memoryUsage(1_000),
    })
    const error = await collect(
      port.send(thread, makeCoachContext(), { signal: new AbortController().signal }),
    ).catch((e: unknown) => e)
    expect(isCoachError(error) && error.retryable).toBe(false)
    expect((error as CoachError).message).toContain('Raise the cap in Settings')
    expect(createModel).not.toHaveBeenCalled()
  })

  it('is silent for fair play in the paused mode', async () => {
    const port = createAiSdkCoach(() => Promise.resolve(config), {
      createModel: vi.fn(),
      usage: memoryUsage(),
    })
    const error = await collect(
      port.send(thread, makeCoachContext({ screen: 'live' }), {
        signal: new AbortController().signal,
      }),
    ).catch((e: unknown) => e)
    expect(isCoachError(error) && error.retryable).toBe(false)
  })

  it('maps a missing key from getConfig to a calm error', async () => {
    const locked = Object.assign(new Error('locked'), { name: 'VaultLockedError' })
    const port = createAiSdkCoach(() => Promise.reject(locked), { usage: memoryUsage() })
    const error = await collect(
      port.send(thread, makeCoachContext(), { signal: new AbortController().signal }),
    ).catch((e: unknown) => e)
    expect(isCoachError(error) && error.message).toContain('locked')
  })
})

describe('toModelMessages', () => {
  it('drops leading Sage turns, empty turns and failed turns', () => {
    const messages = toModelMessages([
      makeCoachMessage({ role: 'sage', text: 'greeting' }),
      makeCoachMessage({ id: toMessageId('a'), role: 'user', text: 'q1' }),
      makeCoachMessage({ id: toMessageId('b'), role: 'sage', text: 'a1' }),
      makeCoachMessage({ id: toMessageId('c'), role: 'user', text: 'q2' }),
      makeCoachMessage({ id: toMessageId('d'), role: 'sage', text: '', status: 'pending' }),
    ])
    expect(messages).toEqual([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ])
  })
})
