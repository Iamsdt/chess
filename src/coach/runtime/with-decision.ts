import { decisionsRepo, type NewDecision } from '@/data'
import type { DecisionEngine, Decision } from '@/decision'
import type { CoachDecision, DecisionProbs } from '@/domain'

import { modeFromDecision } from '../modes'

import type { CoachDelta, CoachPort } from '../port'

/**
 * Puts the on-device decision model in front of any `CoachPort`.
 *
 * Why a decorator and not a feature of each port: the mock coach and the real AI SDK coach both
 * benefit, and neither should know a classifier exists. The decorator asks the model what kind of
 * question this is, tells the UI (a decision delta and a mode delta), hands the answer to the
 * inner port in the context, and logs it. Anything that goes wrong, including a model that is not
 * loaded or too slow, passes the request through untouched.
 */

/** The model gets this long; Sage must not wait on a classifier. */
export const DECISION_BUDGET_MS = 400

export interface WithDecisionOptions {
  /** Whether to write the decision to the local log. Read at send time. Default true. */
  readonly shouldLog?: (() => boolean | Promise<boolean>) | undefined
  /** Where logged decisions go. Default: the `decisions` repository. */
  readonly log?: ((entry: NewDecision) => Promise<unknown>) | undefined
  readonly timeoutMs?: number | undefined
  readonly newId?: (() => string) | undefined
}

function defaultId(): string {
  const bytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(bytes)
  return `dec_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/** The compact form a message carries. */
export function toCoachDecision(decision: Decision, logId?: string): CoachDecision {
  return {
    ...(logId === undefined ? {} : { logId }),
    modelId: decision.modelId,
    latencyMs: decision.latencyMs,
    mode: {
      label: decision.mode.label,
      prob: decision.mode.probs[decision.mode.label] ?? 0,
      probs: { ...decision.mode.probs },
    },
    flags: { ...decision.flags },
  }
}

function toProbs(decision: Decision): DecisionProbs {
  return { mode: { ...decision.mode.probs }, ...decision.flags }
}

export function withDecision(
  inner: CoachPort,
  engine: Pick<DecisionEngine, 'decide'>,
  options: WithDecisionOptions = {},
): CoachPort {
  const { shouldLog = () => true, log = (entry) => decisionsRepo.add(entry) } = options
  const newId = options.newId ?? defaultId

  return {
    async *send(messages, context, sendOptions): AsyncGenerator<CoachDelta> {
      const lastUser = [...messages].reverse().find((message) => message.role === 'user')
      const decision =
        lastUser === undefined
          ? null
          : await engine.decide(lastUser.text, {
              screen: context.screen,
              timeoutMs: options.timeoutMs ?? DECISION_BUDGET_MS,
            })

      if (lastUser === undefined || decision === null || sendOptions.signal.aborted) {
        yield* inner.send(messages, context, sendOptions)
        return
      }

      let logId: string | undefined
      try {
        if (await shouldLog()) {
          const id = newId()
          await log({
            id,
            text: decision.input,
            screen: context.screen,
            modelId: decision.modelId,
            latencyMs: decision.latencyMs,
            probs: toProbs(decision),
          })
          logId = id
        }
      } catch {
        // A log that cannot be written must never cost the user their answer.
        logId = undefined
      }

      const compact = toCoachDecision(decision, logId)
      yield { kind: 'decision', decision: compact }
      yield { kind: 'mode', mode: modeFromDecision(compact, context.screen) }

      for await (const delta of inner.send(
        messages,
        { ...context, decision: compact },
        sendOptions,
      )) {
        // The decision already chose the mode; a port announcing its own would contradict the chip.
        if (delta.kind === 'mode') continue
        yield delta
      }
    },
  }
}
