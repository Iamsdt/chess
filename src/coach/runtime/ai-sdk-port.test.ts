import { tool } from 'ai'
import { MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { makeCoachContext, makeCoachMessage, toFen, toMessageId } from '@/domain'

import { type CoachError, isCoachError, type CoachDelta } from '../port'

import {
  createAiSdkCoach,
  toModelMessages,
  type CoachRuntimeConfig,
  type UsageStore,
} from './ai-sdk-port'

import type { LanguageModel, ToolSet } from 'ai'

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

describe('createAiSdkCoach · guardrails', () => {
  const fenAfterE4 = toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')

  function toolCallStream(name: string, input: unknown) {
    return {
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        {
          type: 'tool-call' as const,
          toolCallId: 'c1',
          toolName: name,
          input: JSON.stringify(input),
        },
        {
          type: 'finish' as const,
          finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' },
          usage: {
            inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 5, text: 5, reasoning: 0 },
          },
        },
      ]),
    }
  }

  function run(
    doStream: unknown[],
    context = makeCoachContext({ position: { fen: fenAfterE4, orientation: 'white' } }),
    extra: { signal?: AbortSignal; question?: string; tools?: ToolSet } = {},
  ) {
    const model = new MockLanguageModelV4({ doStream: doStream as never })
    const port = createAiSdkCoach(() => Promise.resolve(config), {
      createModel: () => Promise.resolve(model as LanguageModel),
      usage: memoryUsage(),
      tools: () => extra.tools ?? {},
    })
    const messages = [
      makeCoachMessage({
        id: toMessageId('q'),
        role: 'user',
        text: extra.question ?? 'Who is better?',
      }),
    ]
    const stream = port.send(messages, context, {
      signal: extra.signal ?? new AbortController().signal,
    })
    return {
      model,
      stream,
      // Lazy, so a test can pull the stream by hand instead.
      get deltas() {
        return collect(stream)
      },
    }
  }

  const textOf = (deltas: CoachDelta[]) =>
    deltas
      .filter((d) => d.kind === 'text')
      .map((d) => d.text)
      .join('')

  it('restarts and retries once when the model invents an evaluation', async () => {
    const { model, deltas } = run([
      textStream(['Natural move. ', 'White is at +2.5 now. ']),
      textStream(['Natural move. ', 'It is roughly level.']),
    ])
    const out = await deltas

    const restart = out.findIndex((d) => d.kind === 'restart')
    expect(restart).toBeGreaterThan(-1)
    expect(textOf(out.slice(0, restart))).toBe('Natural move. ')
    expect(textOf(out.slice(restart))).toBe('Natural move. It is roughly level.')
    expect(JSON.stringify(out)).not.toContain('+2.5 now')
    expect(model.doStreamCalls).toHaveLength(2)
    const retryPrompt = JSON.stringify(model.doStreamCalls[1]?.prompt)
    expect(retryPrompt).toContain('You stated')
    expect(retryPrompt).toContain('+2.5')
    expect(out.at(-1)?.kind).toBe('usage')
  })

  it('strips the sentence and says so when the retry invents it again', async () => {
    const bad = ['Good question. ', 'White is at +2.5 now. ', 'Develop quickly.']
    const { model, deltas } = run([textStream(bad), textStream(bad)])
    const out = await deltas

    expect(model.doStreamCalls).toHaveLength(2)
    expect(out.filter((d) => d.kind === 'restart')).toHaveLength(1)
    const final = textOf(out.slice(out.findIndex((d) => d.kind === 'restart')))
    expect(final).toContain('Good question. Develop quickly.')
    expect(final).not.toContain('+2.5')
    expect(final).toContain('I removed a claim')
  })

  it('lets a sentence through when it quotes what a tool returned', async () => {
    const evaluate = tool({
      description: 'evaluate',
      inputSchema: z.object({}),
      execute: () => ({ summary: 'depth 18 · +0.8 · Nf3 best', pawns: 0.8 }),
    })
    const { model, deltas } = run(
      [toolCallStream('analysePosition', {}), textStream(['The engine says +0.8 for White.'])],
      undefined,
      { tools: { analysePosition: evaluate } },
    )
    const out = await deltas

    expect(out.some((d) => d.kind === 'restart')).toBe(false)
    expect(model.doStreamCalls).toHaveLength(2)
    expect(textOf(out)).toBe('The engine says +0.8 for White.')
    expect(out.some((d) => d.kind === 'attachment')).toBe(true)
  })

  it('catches an illegal line from the position on screen', async () => {
    const { deltas } = run([
      textStream(['Black can play 1... e5 2. Nf6 Nc6 here. ']),
      textStream(['Black can reply with a central pawn.']),
    ])
    const out = await deltas
    expect(out.some((d) => d.kind === 'restart')).toBe(true)
    expect(textOf(out.slice(out.findIndex((d) => d.kind === 'restart')))).toBe(
      'Black can reply with a central pawn.',
    )
  })

  it('catches a spoiler in puzzle mode unless the user asked for the answer', async () => {
    const puzzle = makeCoachContext({
      spoilerGuard: true,
      activePuzzle: { id: 'p1' as never, theme: 'fork', rating: 1200 },
      position: { fen: fenAfterE4, orientation: 'white' },
    })
    const spoiling = () => [
      toolCallStream('analysePosition', {}),
      textStream(['Just play Nf3 there. ']),
    ]
    const tools = {
      analysePosition: tool({
        description: 'analyse',
        inputSchema: z.object({}),
        execute: () => ({ summary: 'Nf3 best', bestMove: 'Nf3' }),
      }),
    }

    const guarded = run([...spoiling(), textStream(['Look for a fork.'])], puzzle, { tools })
    const out = await guarded.deltas
    expect(out.some((d) => d.kind === 'restart')).toBe(true)
    expect(textOf(out)).toBe('Look for a fork.')

    const asked = run(spoiling(), puzzle, { tools, question: 'Please just tell me the solution' })
    const answered = await asked.deltas
    expect(answered.some((d) => d.kind === 'restart')).toBe(false)
    expect(textOf(answered)).toBe('Just play Nf3 there. ')
  })

  it('produces nothing further when the user stops during the retry', async () => {
    const controller = new AbortController()
    const { stream } = run(
      [textStream(['White is at +2.5 now. ']), textStream(['It is level. ', 'Develop quickly. '])],
      undefined,
      { signal: controller.signal },
    )
    const seen: CoachDelta[] = []
    for await (const delta of stream) {
      seen.push(delta)
      if (delta.kind === 'restart') controller.abort()
    }

    expect(seen.at(-1)?.kind).toBe('restart')
    expect(seen.some((d) => d.kind === 'usage')).toBe(false)
  })
})
