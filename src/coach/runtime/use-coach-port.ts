import { useEffect, useMemo } from 'react'

import { settingsRepo, useSettings } from '@/data'
import { getDecisionEngine } from '@/decision'

import { createMockCoach } from '../mock-coach'

import { createAiSdkCoach } from './ai-sdk-port'
import { isConfigured, PROVIDER_PRESETS } from './providers'
import { vault } from './vault'
import { withDecision } from './with-decision'

import type { CoachPort } from '../port'

/**
 * S21 · Which port answers: the real model, or the scripted demo.
 *
 * Why the real port is used whenever a connection is configured, even while the vault is
 * locked: the alternative is silently falling back to canned replies, which would look like a
 * working coach that ignores the question. A locked vault surfaces on the first send as "your
 * key is locked, unlock it in Settings", which is true and fixable.
 *
 * Why `live` is returned beside the port: the panel's status line can say "demo" without the
 * panel learning anything about providers.
 */
export interface CoachPortHandle {
  readonly port: CoachPort
  /** False while the scripted demo is answering. */
  readonly live: boolean
}

export function useCoachPort(): CoachPortHandle {
  const { coach, decision } = useSettings()

  const demo = useMemo(() => createMockCoach(), [])
  const real = useMemo(
    () =>
      createAiSdkCoach(async () => {
        // Read at send time, not captured: a key or model change must apply to the next
        // question without rebuilding the port, and the key is never held in React state.
        const { coach: current } = await settingsRepo.get()
        const needsKey = PROVIDER_PRESETS[current.provider].keyPolicy !== 'none'
        const apiKey = needsKey ? await vault.loadKey(current.provider) : undefined
        return {
          provider: current.provider,
          model: current.model,
          baseUrl: current.baseUrl,
          apiKey,
          monthlyTokenCap: current.monthlyTokenCap,
        }
      }),
    [],
  )

  const decisionEnabled = decision.enabled
  const manifestUrl = decision.manifestUrl
  useEffect(() => {
    // Idempotent: a model that is already loaded for this source returns at once.
    if (decisionEnabled) void getDecisionEngine().enable({ manifestUrl })
  }, [decisionEnabled, manifestUrl])

  const live = isConfigured({
    provider: coach.provider,
    model: coach.model,
    baseUrl: coach.baseUrl,
    hasKey: coach.hasKey,
  })
  const base = live ? real : demo
  const port = useMemo(
    () =>
      decisionEnabled
        ? withDecision(base, getDecisionEngine(), {
            shouldLog: async () => (await settingsRepo.get()).decision.logDecisions,
          })
        : base,
    [base, decisionEnabled],
  )
  return { port, live }
}
