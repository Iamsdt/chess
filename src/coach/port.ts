import { z } from 'zod'

import {
  CoachAttachmentSchema,
  CoachProviderSchema,
  CoachUsageSchema,
  type CoachContext,
  type CoachMessage,
} from '@/domain'

/**
 * S09 · the one seam between the chat UI and whatever answers it.
 *
 * Why this file has no provider in it: the panel ships and is tested against a
 * scripted mock long before S21 exists, and the plan's rule is that nothing in
 * the UI may know which provider is in use. A `CoachPort` is the entire contract
 * S21 has to satisfy — no keys, no endpoints, no model names leak through it
 * beyond the opaque strings the domain already carries for the usage meter.
 */

/**
 * One increment of a streamed answer.
 *
 * Why a tagged union rather than a bare string: a reply is not only prose. It
 * can pin a position card into the bubble and offer follow-ups, and the usage
 * meter needs the token counts the provider reports at the end. Splitting those
 * into their own deltas keeps the text channel free of anything the renderer
 * would have to parse out of it.
 */
export const CoachDeltaSchema = z.discriminatedUnion('kind', [
  /** Append to the message text. Chunks are arbitrary — never assume whole words. */
  z.object({ kind: z.literal('text'), text: z.string() }),
  /** Pin a position card under the text written so far. */
  z.object({ kind: z.literal('attachment'), attachment: CoachAttachmentSchema }),
  /** Replace the tappable follow-ups under the bubble. */
  z.object({ kind: z.literal('quickReplies'), replies: z.array(z.string().min(1)).max(4) }),
  /** Final accounting. Optional: a port that cannot count tokens simply omits it. */
  z.object({
    kind: z.literal('usage'),
    usage: CoachUsageSchema,
    provider: CoachProviderSchema.optional(),
    model: z.string().min(1).optional(),
  }),
])

/** The plan's `Delta`. Named for its namespace because `@/coach` is a public barrel. */
export type CoachDelta = z.infer<typeof CoachDeltaSchema>

export interface CoachSendOptions {
  /**
   * Aborted when the user presses Stop, starts a new thread or leaves the panel.
   * A port must stop producing deltas and release its connection promptly; the
   * UI keeps whatever text arrived before the abort and never shows an error.
   */
  readonly signal: AbortSignal
}

/**
 * The provider seam. S21 implements exactly this and nothing else.
 *
 * `messages` is the thread so far, oldest first, including the user's new turn
 * and excluding the empty placeholder the UI is about to stream into.
 * `context` is the already-budgeted, already-redacted `CoachContext`; a port
 * must not widen it. Failures are thrown from the iterator, preferably as a
 * `CoachError` so the panel can show the provider's own wording.
 */
export interface CoachPort {
  send(
    messages: readonly CoachMessage[],
    context: CoachContext,
    options: CoachSendOptions,
  ): AsyncIterable<CoachDelta>
}

/**
 * A failure a user is allowed to read.
 *
 * Why a dedicated class: a raw provider dump ("401 {\"error\":…}") is noise and
 * can carry key material. A port turns its failures into one calm sentence and
 * says whether pressing Retry could plausibly help.
 */
export class CoachError extends Error {
  override readonly name = 'CoachError'
  /** False for "your key is not valid" — retrying that only repeats the failure. */
  readonly retryable: boolean

  constructor(message: string, options: { retryable?: boolean; cause?: unknown } = {}) {
    super(message)
    if (options.cause !== undefined) this.cause = options.cause
    this.retryable = options.retryable ?? true
  }
}

/** Why a name check: `instanceof` is unreliable once a bundle is split. */
export function isCoachError(value: unknown): value is CoachError {
  return value instanceof Error && value.name === 'CoachError'
}

/** What went wrong, in one sentence, never blaming the reader. */
export const GENERIC_COACH_ERROR = "Sage couldn't answer that one. The connection dropped."

/** Why: every failure path — thrown string, `DOMException`, schema error — ends here. */
export function coachErrorMessage(error: unknown): string {
  if (isCoachError(error)) return error.message
  return GENERIC_COACH_ERROR
}
