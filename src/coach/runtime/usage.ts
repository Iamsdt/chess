import { useMemo } from 'react'
import { z } from 'zod'

import { defineKvKey, kvRepo, useKvValue, type KvKey, type KvRepository } from '@/data'

import { CoachError } from '../port'

/**
 * S21 · The monthly token meter.
 *
 * Why kv and not a table: it is one small counter per month, and kv rows outside the reserved
 * prefixes ride along in backups, so a restore keeps the month's tally. Token counts are not
 * secret. Nothing about the conversation is stored here — only totals.
 *
 * Why calendar months in local time: the cap is described to the user as "this month", and a
 * user's month ends at their midnight, not at UTC's.
 */

export const CoachMonthUsageSchema = z.object({
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  requests: z.number().int().min(0),
})
export type CoachMonthUsage = z.infer<typeof CoachMonthUsageSchema>

export const EMPTY_MONTH_USAGE: CoachMonthUsage = {
  promptTokens: 0,
  completionTokens: 0,
  requests: 0,
}

/** `YYYY-MM` in the reader's own calendar. */
export function monthKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${String(date.getFullYear())}-${month}`
}

const usageKeys = new Map<string, KvKey<CoachMonthUsage>>()

/** Why memoised: `useKvValue` re-subscribes when its key object changes identity. */
export function usageKvKey(month: string): KvKey<CoachMonthUsage> {
  let key = usageKeys.get(month)
  if (key === undefined) {
    key = defineKvKey(`coach-usage:${month}`, CoachMonthUsageSchema)
    usageKeys.set(month, key)
  }
  return key
}

export function totalTokens(usage: CoachMonthUsage): number {
  return usage.promptTokens + usage.completionTokens
}

export async function readMonthUsage(
  kv: KvRepository = kvRepo,
  date: Date = new Date(),
): Promise<CoachMonthUsage> {
  return kv.getOr(usageKvKey(monthKey(date)), EMPTY_MONTH_USAGE)
}

/** Adds one request's tokens to the month it happened in. Failures are swallowed: a meter must never break an answer. */
export async function recordUsage(
  tokens: { readonly promptTokens: number; readonly completionTokens: number },
  kv: KvRepository = kvRepo,
  date: Date = new Date(),
): Promise<void> {
  await kv.update(usageKvKey(monthKey(date)), (current) => {
    const base = current ?? EMPTY_MONTH_USAGE
    return {
      promptTokens: base.promptTokens + Math.max(0, Math.round(tokens.promptTokens)),
      completionTokens: base.completionTokens + Math.max(0, Math.round(tokens.completionTokens)),
      requests: base.requests + 1,
    }
  })
}

/**
 * Throws a calm, non-retryable error once the month's tokens reach the cap.
 * A cap of 0 means "no cap": the schema allows it and the alternative would be a coach that can
 * never answer.
 */
export function assertUnderCap(usage: CoachMonthUsage, monthlyTokenCap: number): void {
  if (monthlyTokenCap <= 0) return
  const used = totalTokens(usage)
  if (used >= monthlyTokenCap) {
    throw new CoachError(
      `You have used ${used.toLocaleString('en-US')} of your ${monthlyTokenCap.toLocaleString('en-US')} token monthly cap. Raise the cap in Settings to keep chatting with Sage.`,
      { retryable: false },
    )
  }
}

export interface CoachUsageMeter {
  readonly month: string
  readonly usage: CoachMonthUsage
  readonly total: number
}

/** Live: re-renders when the port records a request, even from another tab. */
export function useCoachUsage(): CoachUsageMeter {
  const month = monthKey()
  const key = useMemo(() => usageKvKey(month), [month])
  const usage = useKvValue(key) ?? EMPTY_MONTH_USAGE
  return { month, usage, total: totalTokens(usage) }
}
