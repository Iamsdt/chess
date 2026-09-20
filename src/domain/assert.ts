import { type z } from 'zod'

import { domainError, err, ok, type Result } from './result'

/**
 * The single gate every piece of untrusted data passes through.
 *
 * Why: worker messages, CSV rows, PGN imports, content packs, share links,
 * backups and coach responses all arrive as `unknown`. Validating them here — and
 * only here — means the rest of the app can treat its types as true.
 */

/** One problem, already reduced to "which field" and "what is wrong with it". */
export interface ValidationIssue {
  /** Dotted/bracketed field path, or `'(root)'` when the whole value is wrong. */
  readonly path: string
  readonly message: string
  readonly code: string
}

const ROOT_PATH = '(root)'

/** Why: `["moves", 0, "san"]` is unreadable in a log; `moves[0].san` is not. */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return ROOT_PATH
  let formatted = ''
  for (const segment of path) {
    if (typeof segment === 'number') formatted += `[${String(segment)}]`
    else if (formatted === '') formatted = String(segment)
    else formatted += `.${String(segment)}`
  }
  return formatted === '' ? ROOT_PATH : formatted
}

/** Why: zod's issue shape is an implementation detail; this one is our contract. */
export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    message: issue.message,
    code: issue.code,
  }))
}

/**
 * Thrown by `assertValid`. Carries the issues as data so an error boundary can
 * render them rather than re-parse a string.
 */
export class ValidationError extends Error {
  override readonly name = 'ValidationError'
  readonly where: string
  readonly issues: readonly ValidationIssue[]

  constructor(where: string, issues: readonly ValidationIssue[], message: string) {
    super(message)
    this.where = where
    this.issues = issues
  }
}

/** Why: `instanceof` across a worker/module boundary is unreliable; a name check is not. */
export function isValidationError(value: unknown): value is ValidationError {
  return value instanceof ValidationError
}

/** The full, field-by-field report. Developers read this; users never do. */
export function formatValidationDetail(where: string, issues: readonly ValidationIssue[]): string {
  const lines = issues.map((issue) => `  • ${issue.path} — ${issue.message}`)
  return `Invalid data from ${JSON.stringify(where)}:\n${lines.join('\n')}`
}

/**
 * The short report: still names the source and the fields, but carries no values.
 *
 * Why: in production the offending value may be a user's game, a pasted PGN or a
 * coach reply, and none of that belongs in a message on screen.
 */
export function formatValidationSummary(where: string, issues: readonly ValidationIssue[]): string {
  const fields = [...new Set(issues.map((issue) => issue.path))]
  const shown = fields.slice(0, 3).join(', ')
  const rest = fields.length > 3 ? `, +${String(fields.length - 3)} more` : ''
  const count = issues.length === 1 ? '1 problem' : `${String(issues.length)} problems`
  return `Invalid data from ${JSON.stringify(where)} (${count}: ${shown}${rest})`
}

type ValidationReporter = (error: ValidationError) => void

const defaultReporter: ValidationReporter = (error) => {
  console.error(error.message, error.issues)
}

let reporter: ValidationReporter = defaultReporter

/**
 * Why: S29 keeps a ring-buffer log behind "copy diagnostics". This is where it
 * hooks in, without the domain layer knowing anything about it.
 */
export function setValidationReporter(next: ValidationReporter | null): void {
  reporter = next ?? defaultReporter
}

/** Read per call, not per module, so tests can flip it with `vi.stubEnv`. */
function isDevEnvironment(): boolean {
  return import.meta.env.DEV
}

/**
 * Validate data crossing a runtime boundary, or fail loudly.
 *
 * `where` names the source in words a human can act on — `"puzzle CSV row 42"`,
 * `"worker message: analyse-game"`, `"backup file v3"`. In development the thrown
 * message lists every offending field; in production it is reduced to a summary
 * and the detail goes to the reporter instead of the screen.
 *
 * Use this when there is no sensible way to continue. When there is, use
 * `parseValid` and handle the `Result`.
 */
export function assertValid<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  where: string,
): z.infer<Schema> {
  const result = schema.safeParse(value)
  if (result.success) return result.data

  const issues = toValidationIssues(result.error)
  const dev = isDevEnvironment()
  const error = new ValidationError(
    where,
    issues,
    dev ? formatValidationDetail(where, issues) : formatValidationSummary(where, issues),
  )
  if (!dev) reporter(error)
  throw error
}

/**
 * The same check as `assertValid`, as a value.
 *
 * Why: importers skip a bad row and report it; they must not abort on it. The
 * failure channel is a `DomainError` with `code: 'validation'`.
 */
export function parseValid<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  where: string,
): Result<z.infer<Schema>> {
  const result = schema.safeParse(value)
  if (result.success) return ok(result.data)

  const issues = toValidationIssues(result.error)
  return err(
    domainError('validation', formatValidationSummary(where, issues), {
      where,
      details: issues.map((issue) => `${issue.path} — ${issue.message}`),
    }),
  )
}

/** Why: the common "is this trustworthy?" question, without building an error. */
export function isValid(schema: z.ZodType, value: unknown): boolean {
  return schema.safeParse(value).success
}
