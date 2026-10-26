import type { CoachContext, CoachMessage } from '@/domain'

import { CoachError, isCoachError, type CoachDelta, type CoachPort } from '../port'

import { createLanguageModel, type CoachModelConfig } from './create-model'
import { toCoachError } from './errors'
import { buildSystemPrompt, modeForContext } from './system-prompt'
import { createCoachTools } from './tools'
import { assertUnderCap, readMonthUsage, recordUsage, type CoachMonthUsage } from './usage'

import type { LanguageModel, ModelMessage, ToolSet } from 'ai'

/**
 * S21 · The real `CoachPort`: the Vercel AI SDK behind the seam S09 drew.
 *
 * Why the SDK is imported inside `send`: see `create-model.ts`. The first question pays for the
 * chunk; opening the panel, Settings or any other screen does not.
 *
 * Why the key is fetched through `getConfig` on every send: the port is created once per mount
 * but a key can be replaced, removed or locked at any time, and holding it in a closure would
 * keep it alive in memory for the life of the tab. `getConfig` decrypts it just-in-time and the
 * reference dies with the request.
 */

export interface CoachRuntimeConfig extends CoachModelConfig {
  /** 0 means no cap. */
  readonly monthlyTokenCap: number
}

export interface UsageStore {
  read: () => Promise<CoachMonthUsage>
  record: (tokens: { promptTokens: number; completionTokens: number }) => Promise<void>
}

export interface AiSdkCoachDeps {
  readonly createModel?: (config: CoachModelConfig) => Promise<LanguageModel>
  readonly tools?: (context: CoachContext) => ToolSet
  readonly usage?: UsageStore
  /** Model calls per answer, including tool round-trips. */
  readonly maxSteps?: number
  /** Wall-clock ceiling for the whole answer. */
  readonly timeoutMs?: number
}

/** coach-agent.md §7 "Tool budget": a loop cannot run away. */
export const DEFAULT_MAX_STEPS = 6
export const DEFAULT_TIMEOUT_MS = 90_000

const defaultUsage: UsageStore = {
  read: () => readMonthUsage(),
  record: (tokens) => recordUsage(tokens),
}

/**
 * Thread → model messages.
 *
 * Why leading assistant turns are dropped: threads open with Sage's greeting, but Anthropic and
 * Gemini reject a conversation that does not start with the user. Empty and failed turns carry
 * nothing the model should see.
 */
export function toModelMessages(messages: readonly CoachMessage[]): ModelMessage[] {
  const usable = messages.filter(
    (message) =>
      message.role !== 'system' && message.text.trim() !== '' && message.status !== 'error',
  )
  const firstUser = usable.findIndex((message) => message.role === 'user')
  if (firstUser === -1) return []
  return usable.slice(firstUser).map((message): ModelMessage => ({
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.text,
  }))
}

function whole(value: number | undefined): number {
  return value === undefined || !Number.isFinite(value) ? 0 : Math.max(0, Math.round(value))
}

export function createAiSdkCoach(
  getConfig: () => Promise<CoachRuntimeConfig>,
  deps: AiSdkCoachDeps = {},
): CoachPort {
  const createModel = deps.createModel ?? createLanguageModel
  const makeTools = deps.tools ?? createCoachTools
  const usageStore = deps.usage ?? defaultUsage
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    async *send(messages, context, options): AsyncGenerator<CoachDelta> {
      let config: CoachRuntimeConfig | undefined
      try {
        config = await getConfig()
        const mode = modeForContext(context)

        if (mode === 'paused') {
          throw new CoachError(
            'Sage is paused for fair play during a live game. It will be back when the game ends.',
            { retryable: false },
          )
        }
        yield { kind: 'mode', mode }

        assertUnderCap(await usageStore.read(), config.monthlyTokenCap)

        const modelMessages = toModelMessages(messages)
        if (modelMessages.length === 0) return

        const model = await createModel(config)
        const { streamText, stepCountIs } = await import('ai')

        // The user's Stop and the wall-clock ceiling both end the request; only the first is silent.
        const signal = AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])

        const result = streamText({
          model,
          instructions: buildSystemPrompt(context),
          messages: modelMessages,
          abortSignal: signal,
          tools: makeTools(context),
          stopWhen: stepCountIs(maxSteps),
          // Errors arrive as `error` parts below; the default handler would also log them.
          onError: () => undefined,
        })

        for await (const part of result.stream) {
          if (options.signal.aborted) return
          switch (part.type) {
            case 'text-delta':
              if (part.text !== '') yield { kind: 'text', text: part.text }
              break
            case 'tool-result':
              yield {
                kind: 'attachment',
                attachment: { kind: 'tool', name: part.toolName, summary: 'Done', status: 'done' },
              }
              break
            case 'tool-error':
              yield {
                kind: 'attachment',
                attachment: {
                  kind: 'tool',
                  name: part.toolName,
                  summary: 'Could not run',
                  status: 'failed',
                },
              }
              break
            case 'error':
              throw part.error
            case 'finish': {
              const tokens = {
                promptTokens: whole(part.totalUsage.inputTokens),
                completionTokens: whole(part.totalUsage.outputTokens),
              }
              await usageStore.record(tokens).catch(() => undefined)
              yield {
                kind: 'usage',
                usage: tokens,
                provider: config.provider,
                model: config.model,
              }
              break
            }
            default:
              break
          }
        }

        if (!options.signal.aborted && signal.aborted) {
          throw new DOMException('The answer took too long.', 'TimeoutError')
        }
      } catch (error) {
        if (options.signal.aborted) return
        if (isCoachError(error)) throw error
        throw toCoachError(error, {
          provider: config?.provider ?? 'custom',
          model: config?.model ?? '',
          baseUrl: config?.baseUrl,
        })
      }
    },
  }
}
