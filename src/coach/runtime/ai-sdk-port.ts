import type { CoachAttachment, CoachMessage, CoachMode } from '@/domain'
import { engine as sharedEngine, type Engine } from '@/engine'

import { CoachError, isCoachError, type CoachDelta, type CoachPort } from '../port'

import { createLanguageModel, type CoachModelConfig } from './create-model'
import { toCoachError } from './errors'
import {
  correctionFor,
  createAnswerGuard,
  REMOVED_NOTICE,
  type GuardProblem,
  type GuardStep,
} from './guardrails'
import { buildSystemPrompt, modeForContext } from './system-prompt'
import { createCoachTools, type CoachToolEnv } from './tools'
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
  readonly tools?: (env: CoachToolEnv, mode: CoachMode) => ToolSet
  readonly engine?: Engine
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

/** The chip text for a finished tool: its own `summary` when it gave one (see `CoachToolOutput`). */
export function toolSummary(output: unknown): string {
  if (typeof output === 'object' && output !== null && 'summary' in output) {
    const { summary } = output
    if (typeof summary === 'string' && summary.trim() !== '') return summary.trim()
  }
  return 'Done'
}

export function createAiSdkCoach(
  getConfig: () => Promise<CoachRuntimeConfig>,
  deps: AiSdkCoachDeps = {},
): CoachPort {
  const createModel = deps.createModel ?? createLanguageModel
  const makeTools = deps.tools ?? createCoachTools
  const toolEngine = deps.engine ?? sharedEngine
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

        const thread = messages.filter((m) => m.role !== 'system').map((m) => m.text)
        const userText = messages.findLast((m) => m.role === 'user')?.text ?? ''
        const tokens = { promptTokens: 0, completionTokens: 0 }
        const calls = { finished: 0 }

        /**
         * One model call, with its text held back a sentence at a time (see `guardrails.ts`).
         *
         * Why the first attempt is aborted at the first bad sentence and the second is not: the
         * first can still be replaced by a better draft, the second is the last word, so it
         * streams on with the offending sentences cut. Returns what was rejected, if anything,
         * only for the first attempt.
         */
        const attempt = async function* (
          prompt: ModelMessage[],
          last: boolean,
        ): AsyncGenerator<CoachDelta, readonly GuardProblem[]> {
          const guard = createAnswerGuard({ context, userText, thread })
          const stop = new AbortController()
          const attemptSignal = AbortSignal.any([signal, stop.signal])
          // Cards a tool pins while it runs; flushed before the stream part that follows it.
          const pinned: CoachAttachment[] = []
          const env: CoachToolEnv = {
            context,
            emit: (attachment) => pinned.push(attachment),
            signal: attemptSignal,
            engine: toolEngine,
          }
          let cut = 0

          const result = streamText({
            model,
            instructions: buildSystemPrompt(context),
            messages: prompt,
            abortSignal: attemptSignal,
            tools: makeTools(env, mode),
            stopWhen: stepCountIs(maxSteps),
            // Errors arrive as `error` parts below; the default handler would also log them.
            onError: () => undefined,
          })

          for await (const part of result.stream) {
            if (options.signal.aborted) return []
            while (pinned.length > 0) {
              const attachment = pinned.shift()
              if (attachment !== undefined) yield { kind: 'attachment', attachment }
            }
            let step: GuardStep | undefined
            switch (part.type) {
              case 'text-delta':
                step = guard.push(part.text)
                break
              case 'finish-step':
                step = guard.flush()
                break
              case 'tool-result':
                guard.recordTool(part.input, part.output)
                yield {
                  kind: 'attachment',
                  attachment: {
                    kind: 'tool',
                    name: part.toolName,
                    summary: toolSummary(part.output),
                    status: 'done',
                  },
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
                calls.finished += 1
                const used = {
                  promptTokens: whole(part.totalUsage.inputTokens),
                  completionTokens: whole(part.totalUsage.outputTokens),
                }
                tokens.promptTokens += used.promptTokens
                tokens.completionTokens += used.completionTokens
                await usageStore.record(used).catch(() => undefined)
                break
              }
              default:
                break
            }
            if (step === undefined) continue
            if (step.released !== '') yield { kind: 'text', text: step.released }
            if (step.problems.length === 0) continue
            if (!last) {
              stop.abort()
              return step.problems
            }
            cut += step.problems.length
          }

          const rest = guard.flush()
          if (rest.released !== '') yield { kind: 'text', text: rest.released }
          if (!last && rest.problems.length > 0) return rest.problems
          cut += rest.problems.length
          for (const attachment of pinned.splice(0)) yield { kind: 'attachment', attachment }
          if (cut > 0) yield { kind: 'text', text: REMOVED_NOTICE }
          return []
        }

        // Why functions: the flags flip while the attempts run, which flow analysis cannot see.
        const userStopped = () => options.signal.aborted
        const ended = () => signal.aborted
        const rejected = yield* attempt(modelMessages, false)
        if (userStopped()) return
        if (rejected.length > 0 && !ended()) {
          yield { kind: 'restart', reason: rejected[0]?.detail ?? 'A claim could not be verified.' }
          yield* attempt(
            [...modelMessages, { role: 'user', content: correctionFor(rejected) }],
            true,
          )
          if (userStopped()) return
        }

        if (ended()) throw new DOMException('The answer took too long.', 'TimeoutError')
        if (calls.finished > 0) {
          yield {
            kind: 'usage',
            usage: tokens,
            provider: config.provider,
            model: config.model,
          }
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
