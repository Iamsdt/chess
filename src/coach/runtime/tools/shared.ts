import { validateFen } from '@/chess'
import type { Fen } from '@/domain'

import { DEFAULT_TOOL_TIMEOUT_MS, type CoachToolEnv } from './types'

/**
 * S21b · Helpers every tool group needs. Kept here so the groups agree on them.
 */

/** What a tool returns when its input cannot be used: the model reads `error` and recovers. */
export interface CoachToolFailure {
  readonly error: string
  readonly summary: string
}

export function toolFailure(error: string): CoachToolFailure {
  return { error, summary: error }
}

/**
 * The position a tool works on: the one it was given, else the one the user is looking at.
 *
 * Why the fallback: "is my knight hanging?" names no position. The model should not have to
 * copy a FEN out of its context (and risk mangling it) to ask about the board on screen.
 */
export function resolveFen(env: CoachToolEnv, fen: string | undefined): Fen | CoachToolFailure {
  const raw = fen ?? env.context.position?.fen
  if (raw === undefined) return toolFailure('No position: pass a FEN, there is no board on screen.')
  const valid = validateFen(raw)
  return valid.ok ? valid.value : toolFailure(`Not a legal position: ${raw}`)
}

export function isToolFailure(value: unknown): value is CoachToolFailure {
  return typeof value === 'object' && value !== null && 'error' in value
}

/** The answer's own signal, tightened to one tool's ceiling. */
export function toolSignal(env: CoachToolEnv, timeoutMs = DEFAULT_TOOL_TIMEOUT_MS): AbortSignal {
  return AbortSignal.any([env.signal, AbortSignal.timeout(timeoutMs)])
}
