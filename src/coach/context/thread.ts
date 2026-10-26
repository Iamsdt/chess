import type { CoachMessage } from '@/domain'

import { estimateTokens } from '../runtime/system-prompt'

/**
 * The Session layer's size limit (coach-agent.md §6).
 *
 * Why the thread gets a share of the budget rather than whatever is left: the other layers are
 * small and bounded, the thread is the one that grows without limit. A fixed share means a long
 * chat cannot squeeze the position out, and a short chat does not waste the space.
 */
const THREAD_SHARE = 0.4

/** Per-message overhead of the role markers a provider adds around each turn. */
const MESSAGE_OVERHEAD_TOKENS = 4

export function threadBudget(tokenBudget: number): number {
  return Math.floor(tokenBudget * THREAD_SHARE)
}

export function messageTokens(message: CoachMessage): number {
  return estimateTokens(message.text) + MESSAGE_OVERHEAD_TOKENS
}

/**
 * The newest messages that fit, oldest first.
 *
 * Why the newest message is always kept: it is the question being asked. Dropping it to honour a
 * budget would answer a different one.
 */
export function fitThread(
  messages: readonly CoachMessage[],
  tokens: number,
): readonly CoachMessage[] {
  const kept: CoachMessage[] = []
  let used = 0
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message === undefined) continue
    const cost = messageTokens(message)
    if (kept.length > 0 && used + cost > tokens) break
    kept.unshift(message)
    used += cost
  }
  return kept
}
