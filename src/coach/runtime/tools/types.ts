import type { CoachAttachment, CoachContext } from '@/domain'
import type { Engine } from '@/engine'

import type { Tool, ToolSet } from 'ai'

/**
 * S21b · What every coach tool is built from.
 *
 * Why tools get an `emit` instead of returning cards: the model reads a tool's *output*, the
 * user reads its *card*. Keeping the two apart lets a tool hand the model a compact fact
 * ("+0.8 at depth 18, Nf3 best") while pinning a full board into the bubble, and the model can
 * never forge a card by writing one in its text.
 *
 * Why the engine is injected: tests pass `@/engine/testing/fake-engine`, the app passes the
 * shared pool. A tool never constructs its own engine.
 */
export interface CoachToolEnv {
  /** The budgeted, redacted context this answer was asked with. Read-only. */
  readonly context: CoachContext
  /** Pin an attachment under the reply being streamed. Delivered in call order. */
  readonly emit: (attachment: CoachAttachment) => void
  /** Aborted on Stop and on the wall-clock budget: engine work must stop with it. */
  readonly signal: AbortSignal
  readonly engine: Engine
}

/** One tool group (coach-agent.md §5): a function of the env, keyed by tool name. */
export type CoachToolGroup = (env: CoachToolEnv) => ToolSet

/**
 * The shape every tool output extends. `summary` is what the chip in the bubble says,
 * e.g. "depth 18 · +0.8 · Nf3 best"; without it the chip says "Done".
 */
export interface CoachToolOutput {
  readonly summary?: string
}

/** Per-tool ceiling, so one slow search cannot eat the whole answer's budget. */
export const DEFAULT_TOOL_TIMEOUT_MS = 15_000

/**
 * `tool()` from the SDK, without importing it.
 *
 * Why: `ai` is loaded lazily on the first question (see `create-model.ts`). A value import here
 * would pull the whole SDK into the main bundle just to call an identity function. Tool files
 * import only types from `ai` and build their tools with this.
 */
export function defineTool<INPUT, OUTPUT>(definition: Tool<INPUT, OUTPUT>): Tool<INPUT, OUTPUT> {
  return definition
}
