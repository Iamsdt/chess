import {
  domainError,
  err,
  ok,
  parseValid,
  toAttemptId,
  toGameId,
  toJobId,
  toMistakeId,
  toRepertoireNodeId,
  toSessionId,
  toSrsCardId,
  type AttemptId,
  type DomainError,
  type DomainErrorCode,
  type GameId,
  type JobId,
  type MistakeId,
  type RepertoireNodeId,
  type Result,
  type SessionId,
  type SrsCardId,
} from '@/domain'

import type { z } from 'zod'

/**
 * The bits every repository needs: one error translation, one write gate, one
 * id source. Keeping them here means a repository file is only its queries.
 */

/** Why: a DOMException name is the only reliable discriminator IndexedDB gives us. */
function codeForError(error: unknown): DomainErrorCode {
  const name = error instanceof Error ? error.name : ''
  if (name === 'ConstraintError') return 'conflict'
  if (name === 'QuotaExceededError') return 'io'
  if (name === 'AbortError') return 'cancelled'
  if (name === 'DataError' || name === 'DataCloneError') return 'validation'
  return 'io'
}

/** Why: a thrown IndexedDB failure is a boundary failure, and boundaries return values. */
export async function runWrite<T>(where: string, fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn())
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Storage write failed'
    return err(domainError(codeForError(error), message, { where, cause: error }))
  }
}

/**
 * Validate a record, then write it.
 *
 * Why validation happens here rather than in each method: the quality bar makes
 * every write pass through a schema, and a repository that validated in some
 * methods and not others would be worse than one that never did.
 */
export async function writeValidated<Schema extends z.ZodType, T>(
  schema: Schema,
  value: unknown,
  where: string,
  write: (validated: z.infer<Schema>) => Promise<T>,
): Promise<Result<T>> {
  const parsed = parseValid(schema, value, where)
  if (!parsed.ok) return parsed
  return runWrite(where, () => write(parsed.value))
}

/** Why: a bulk write must name the offending row, not just say "one of these is wrong". */
export function validateMany<Schema extends z.ZodType>(
  schema: Schema,
  values: readonly unknown[],
  where: string,
): Result<z.infer<Schema>[]> {
  const validated: z.infer<Schema>[] = []
  const problems: string[] = []
  for (const [index, value] of values.entries()) {
    const parsed = parseValid(schema, value, `${where}[${String(index)}]`)
    if (parsed.ok) validated.push(parsed.value)
    else problems.push(...(parsed.error.details ?? [parsed.error.message]))
  }
  if (problems.length > 0) {
    return err(
      domainError('validation', `${String(problems.length)} invalid records`, {
        where,
        details: problems,
      }),
    )
  }
  return ok(validated)
}

/** Why: `not-found` is the single most common repository failure; spell it once. */
export function notFound(where: string, id: string): DomainError {
  return domainError('not-found', `No record for ${JSON.stringify(id)}`, { where })
}

/**
 * A random, collision-free id.
 *
 * Why `getRandomValues` and not `randomUUID`: the latter needs a secure context,
 * and the app must still mint ids when it is served over plain http on a LAN
 * during development. 128 bits is the same entropy either way.
 */
function randomId(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Why: a repository that mints its own keys must not invent its own format too. */
export const newGameId = (): GameId => toGameId(`game_${randomId()}`)
export const newAttemptId = (): AttemptId => toAttemptId(`attempt_${randomId()}`)
export const newSrsCardId = (): SrsCardId => toSrsCardId(`card_${randomId()}`)
export const newMistakeId = (): MistakeId => toMistakeId(`mistake_${randomId()}`)
export const newSessionId = (): SessionId => toSessionId(`session_${randomId()}`)
export const newJobId = (): JobId => toJobId(`job_${randomId()}`)
export const newRepertoireNodeId = (): RepertoireNodeId => toRepertoireNodeId(`node_${randomId()}`)
