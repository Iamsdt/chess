import { useSyncExternalStore } from 'react'

import { getDecisionEngine } from './singleton'

import type { DecisionEngine, DecisionStatus } from './engine'

/** The engine's status, re-rendering when it changes. */
export function useDecisionStatus(engine: DecisionEngine = getDecisionEngine()): DecisionStatus {
  return useSyncExternalStore(engine.subscribe, engine.getStatus, engine.getStatus)
}
