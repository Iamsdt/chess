import type { CoachContext } from '@/domain'

import type { ToolSet } from 'ai'

/**
 * S21 · The tool registry — empty on purpose.
 *
 * The runtime already runs a bounded multi-step loop (see `ai-sdk-port.ts`: a step budget plus a
 * wall-clock budget), so the moment a tool appears here the model can call it and keep going.
 * S21b adds the 22 local tools from coach-agent.md §5 (engine, position, history, plan…) as
 * entries of this record, each closed over the `context` it is given. Until then the model
 * answers from the system prompt alone, which is why the prompt forbids inventing evaluations.
 */
export function createCoachTools(_context: CoachContext): ToolSet {
  return {}
}
