import { z } from 'zod'

import {
  DOMAIN_ERROR_CODES,
  GameSchema,
  GameSourceSchema,
  domainError,
  type DomainError,
} from '@/domain'

/**
 * The PGN worker's wire format.
 *
 * Why every message is a schema: a `postMessage` payload arrives as `unknown` from
 * another realm, and §5 has no exception for "it is our own worker". Validating the
 * batch here is also what lets the import service store a game without re-checking it —
 * a `Game` that came off this wire has already been through `GameSchema`.
 *
 * Why this file duplicates a handful of lines from S10's `src/content/worker-protocol.ts`
 * rather than importing them: that module is another sprint's private surface and is not
 * published from `@/content`. Twenty lines of error shuttling is a cheaper dependency
 * than a barrel change in a folder this sprint does not own.
 */

/** `DomainError` minus `cause`, which is not reliably structured-cloneable. */
export const WireErrorSchema = z.object({
  code: z.enum(DOMAIN_ERROR_CODES),
  message: z.string(),
  where: z.string().optional(),
  details: z.array(z.string()).optional(),
})
export type WireError = z.infer<typeof WireErrorSchema>

/** Why: a `DomainError` may carry an unclonable `cause`; strip it at the boundary. */
export function toWireError(error: DomainError): WireError {
  return {
    code: error.code,
    message: error.message,
    ...(error.where === undefined ? {} : { where: error.where }),
    ...(error.details === undefined ? {} : { details: [...error.details] }),
  }
}

/** Why: the main thread wants the same `DomainError` shape every other boundary returns. */
export function fromWireError(error: WireError): DomainError {
  return domainError(error.code, error.message, {
    where: error.where,
    details: error.details,
  })
}

/** Why: a rejected promise carries anything at all; the report needs a `DomainError`. */
export function domainErrorFromUnknown(cause: unknown): DomainError {
  const message = cause instanceof Error ? cause.message : String(cause)
  return domainError('unknown', message, { cause })
}

/**
 * One game the parser refused.
 *
 * A bad game in a 5 MB file must not cost the user the other 4,999 — so a failure is a
 * row in a report, not the end of the import.
 */
export const SkippedGameSchema = z.object({
  /** 0-based position in the file, so the report can say "game 812". */
  index: z.number().int().min(0),
  /** `White vs Black`, or the first line of the chunk when even the headers were unreadable. */
  label: z.string(),
  reason: z.string().min(1),
})
export type SkippedGame = z.infer<typeof SkippedGameSchema>

/** What the parser should assume about games a PGN cannot state for itself. */
export const PgnImportOptionsSchema = z.object({
  source: GameSourceSchema,
  /** The player whose side counts as "you"; matched against the White/Black headers. */
  you: z.string().optional(),
  /** Games per `batch` message. Smaller batches mean smoother progress, more messages. */
  batchSize: z.number().int().min(1).optional(),
})
export type PgnImportOptions = z.infer<typeof PgnImportOptionsSchema>

/** Why a `Blob` arm at all: a 5 MB file should never be read into a string twice. */
export const PgnSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string() }),
  z.object({
    kind: z.literal('blob'),
    blob: z.custom<Blob>((value) => value instanceof Blob, { error: 'Not a Blob' }),
  }),
])
export type PgnWireSource = z.infer<typeof PgnSourceSchema>

export const ParseRequestSchema = z.object({
  kind: z.literal('parse'),
  requestId: z.number().int().min(0),
  source: PgnSourceSchema,
  options: PgnImportOptionsSchema,
})

export const SerializeRequestSchema = z.object({
  kind: z.literal('serialize'),
  requestId: z.number().int().min(0),
  games: z.array(GameSchema),
})

export const CancelRequestSchema = z.object({
  kind: z.literal('cancel'),
  requestId: z.number().int().min(0),
})

/**
 * "I have stored that batch; send the next one."
 *
 * Back-pressure, and the reason a 5 MB file does not have to fit in memory twice. Without
 * it the worker parses as fast as it can read and the main thread queues every game it
 * has not stored yet — for a large export that is hundreds of megabytes of move records
 * waiting on a database that writes far slower than the parser reads.
 */
export const AckRequestSchema = z.object({
  kind: z.literal('ack'),
  requestId: z.number().int().min(0),
})

export const WorkerRequestSchema = z.discriminatedUnion('kind', [
  ParseRequestSchema,
  SerializeRequestSchema,
  CancelRequestSchema,
  AckRequestSchema,
])
export type WorkerRequest = z.infer<typeof WorkerRequestSchema>

/** Progress travels with the data: one message, one repaint, no separate tick channel. */
export const BatchResponseSchema = z.object({
  kind: z.literal('batch'),
  requestId: z.number().int().min(0),
  games: z.array(GameSchema),
  skipped: z.array(SkippedGameSchema),
  /** Bytes (for a blob) or characters (for pasted text) consumed so far. */
  bytesRead: z.number().int().min(0),
  /** `null` when the size is not known ahead of time. */
  totalBytes: z.number().int().min(0).nullable(),
  gamesParsed: z.number().int().min(0),
})

export const DoneResponseSchema = z.object({
  kind: z.literal('done'),
  requestId: z.number().int().min(0),
  gamesParsed: z.number().int().min(0),
  skippedCount: z.number().int().min(0),
  bytesRead: z.number().int().min(0),
})

export const SerializedResponseSchema = z.object({
  kind: z.literal('serialized'),
  requestId: z.number().int().min(0),
  pgn: z.string(),
})

export const FailedResponseSchema = z.object({
  kind: z.literal('failed'),
  requestId: z.number().int().min(0),
  error: WireErrorSchema,
})

export const WorkerResponseSchema = z.discriminatedUnion('kind', [
  BatchResponseSchema,
  DoneResponseSchema,
  SerializedResponseSchema,
  FailedResponseSchema,
])
export type WorkerResponse = z.infer<typeof WorkerResponseSchema>
