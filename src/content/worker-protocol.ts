import { z } from 'zod'

import {
  DOMAIN_ERROR_CODES,
  PuzzleBandSchema,
  PuzzleSchema,
  domainError,
  type DomainError,
} from '@/domain'

/**
 * The CSV worker's wire format.
 *
 * Why every message is a schema: a `postMessage` payload arrives as `unknown` from
 * another realm, and the quality bar has no exception for "it is our own worker".
 * The cost is one validation pass per batch on the main thread, which is why the
 * importer yields between batches; what it buys is the guarantee that nothing
 * unvalidated ever reaches the database.
 */

export const SkippedPuzzleRowSchema = z.object({
  band: PuzzleBandSchema,
  line: z.number().int().min(1),
  id: z.string().nullable(),
  reason: z.string().min(1),
  details: z.array(z.string()),
})
export type WireSkippedRow = z.infer<typeof SkippedPuzzleRowSchema>

/** Why: the reports are `readonly`, and `postMessage` payloads are not. */
export function toWireSkipped(
  rows: readonly {
    band: WireSkippedRow['band']
    line: number
    id: string | null
    reason: string
    details: readonly string[]
  }[],
): WireSkippedRow[] {
  return rows.map((row) => ({
    band: row.band,
    line: row.line,
    id: row.id,
    reason: row.reason,
    details: [...row.details],
  }))
}

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

/** Why: a rejected promise carries anything at all; the report needs a `DomainError`. */
export function domainErrorFromUnknown(cause: unknown): DomainError {
  const message = cause instanceof Error ? cause.message : String(cause)
  return domainError('unknown', message, { cause })
}

/** Why: the main thread wants the same `DomainError` shape every other boundary returns. */
export function fromWireError(error: WireError): DomainError {
  return domainError(error.code, error.message, {
    where: error.where,
    details: error.details,
  })
}

export const ParseBandRequestSchema = z.object({
  kind: z.literal('parse-band'),
  requestId: z.number().int().min(0),
  band: PuzzleBandSchema,
  url: z.string().min(1),
  batchSize: z.number().int().min(1).optional(),
  startRow: z.number().int().min(0).optional(),
})

export const CancelRequestSchema = z.object({
  kind: z.literal('cancel'),
  requestId: z.number().int().min(0),
})

export const WorkerRequestSchema = z.discriminatedUnion('kind', [
  ParseBandRequestSchema,
  CancelRequestSchema,
])
export type WorkerRequest = z.infer<typeof WorkerRequestSchema>

export const BatchResponseSchema = z.object({
  kind: z.literal('batch'),
  requestId: z.number().int().min(0),
  band: PuzzleBandSchema,
  puzzles: z.array(PuzzleSchema),
  rowsRead: z.number().int().min(0),
  skipped: z.array(SkippedPuzzleRowSchema),
})

export const DoneResponseSchema = z.object({
  kind: z.literal('done'),
  requestId: z.number().int().min(0),
  band: PuzzleBandSchema,
  rowsRead: z.number().int().min(0),
  puzzlesParsed: z.number().int().min(0),
  skipped: z.array(SkippedPuzzleRowSchema),
})

export const FailedResponseSchema = z.object({
  kind: z.literal('failed'),
  requestId: z.number().int().min(0),
  error: WireErrorSchema,
})

export const WorkerResponseSchema = z.discriminatedUnion('kind', [
  BatchResponseSchema,
  DoneResponseSchema,
  FailedResponseSchema,
])
export type WorkerResponse = z.infer<typeof WorkerResponseSchema>
