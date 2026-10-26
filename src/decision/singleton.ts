import { createDecisionEngine, type DecisionEngine } from './engine'

let instance: DecisionEngine | undefined

/**
 * The app's one engine. The worker and the transformers.js runtime are imported on first use, so
 * nothing about the model reaches the initial bundle.
 */
export function getDecisionEngine(): DecisionEngine {
  instance ??= createDecisionEngine({
    createClient: async () => {
      const { createWorkerDecisionClient } = await import('./client')
      return createWorkerDecisionClient()
    },
  })
  return instance
}
