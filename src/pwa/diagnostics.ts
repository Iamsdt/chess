/**
 * A local ring buffer of recent problems, and the "copy diagnostics" report built from it.
 *
 * Why local only: the app has no server and no telemetry, so when something breaks the
 * player's best tool is a report they can paste into an issue. Nothing here is ever sent
 * anywhere, and the report scrubs anything shaped like an API key first.
 */

export type DiagnosticLevel = 'info' | 'warn' | 'error'

export interface DiagnosticEntry {
  readonly at: string
  readonly level: DiagnosticLevel
  readonly message: string
  readonly detail?: string | undefined
}

export const DIAGNOSTICS_CAPACITY = 100
const MAX_FIELD_LENGTH = 2000

/** Key-shaped strings: provider keys, bearer tokens and `key: value` pairs with long secrets. */
const SECRET_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/sk-[A-Za-z0-9_-]{16,}/g, '[redacted]'],
  [/AIza[A-Za-z0-9_-]{20,}/g, '[redacted]'],
  [/Bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [redacted]'],
  [/(api[_-]?key|token|secret)(["'\s:=]+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1$2[redacted]'],
]

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (scrubbed, [pattern, mask]) => scrubbed.replace(pattern, mask),
    text,
  )
}

const clip = (text: string): string =>
  text.length > MAX_FIELD_LENGTH ? `${text.slice(0, MAX_FIELD_LENGTH)}…` : text

/** Fixed-size buffer: the newest entries survive, the oldest fall off. */
export class DiagnosticsLog {
  readonly #capacity: number
  #entries: DiagnosticEntry[] = []

  constructor(capacity: number = DIAGNOSTICS_CAPACITY) {
    this.#capacity = capacity
  }

  record(level: DiagnosticLevel, message: string, detail?: string, now: Date = new Date()): void {
    const entry: DiagnosticEntry = {
      at: now.toISOString(),
      level,
      message: redactSecrets(clip(message)),
      ...(detail === undefined ? {} : { detail: redactSecrets(clip(detail)) }),
    }
    this.#entries = [...this.#entries, entry].slice(-this.#capacity)
  }

  entries(): readonly DiagnosticEntry[] {
    return this.#entries
  }

  clear(): void {
    this.#entries = []
  }
}

export const diagnosticsLog = new DiagnosticsLog()

function describeCause(cause: unknown): string | undefined {
  if (cause === undefined) return undefined
  if (cause instanceof Error) return cause.stack ?? cause.message
  if (typeof cause === 'string') return cause
  try {
    return JSON.stringify(cause)
  } catch {
    return 'Unserialisable value'
  }
}

/** Records an error from anywhere, including a caught one. */
export function recordError(message: string, cause?: unknown): void {
  diagnosticsLog.record('error', message, describeCause(cause))
}

let installed = false

/** Catches what no boundary does: uncaught errors and unhandled promise rejections. */
export function installGlobalDiagnostics(): void {
  if (installed) return
  installed = true
  window.addEventListener('error', (event) => {
    recordError(event.message || 'Uncaught error', event.error)
  })
  window.addEventListener('unhandledrejection', (event) => {
    recordError('Unhandled promise rejection', event.reason)
  })
}

export interface DiagnosticsContext {
  readonly userAgent: string
  readonly language: string
  readonly online: boolean
  readonly crossOriginIsolated: boolean
  readonly hardwareConcurrency: number
  readonly standalone: boolean
  readonly serviceWorker: string
  readonly url: string
}

/** Pure, so the report format is tested without a browser. */
export function formatDiagnosticsReport(
  context: DiagnosticsContext,
  entries: readonly DiagnosticEntry[],
  now: Date = new Date(),
): string {
  const lines = [
    'Chess King diagnostics',
    `Generated: ${now.toISOString()}`,
    `Page: ${context.url}`,
    `Browser: ${context.userAgent}`,
    `Language: ${context.language}`,
    `Online: ${String(context.online)}`,
    `Cross-origin isolated: ${String(context.crossOriginIsolated)}`,
    `CPU threads: ${String(context.hardwareConcurrency)}`,
    `Installed (standalone): ${String(context.standalone)}`,
    `Service worker: ${context.serviceWorker}`,
    '',
    `Recent events (${String(entries.length)}, oldest first)`,
  ]
  for (const entry of entries) {
    lines.push(`[${entry.at}] ${entry.level.toUpperCase()} ${entry.message}`)
    if (entry.detail !== undefined) lines.push(`    ${entry.detail.replaceAll('\n', '\n    ')}`)
  }
  return redactSecrets(lines.join('\n'))
}

function describeServiceWorker(): string {
  if (!('serviceWorker' in navigator)) return 'unsupported'
  return navigator.serviceWorker.controller === null
    ? 'not controlling this page'
    : 'controlling this page'
}

export function collectContext(): DiagnosticsContext {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    online: navigator.onLine,
    crossOriginIsolated: window.crossOriginIsolated,
    hardwareConcurrency: navigator.hardwareConcurrency,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    serviceWorker: describeServiceWorker(),
    url: `${window.location.origin}${window.location.pathname}`,
  }
}

/** Copies the report to the clipboard; resolves `false` when the browser refuses. */
export async function copyDiagnostics(): Promise<boolean> {
  const report = formatDiagnosticsReport(collectContext(), diagnosticsLog.entries())
  try {
    await navigator.clipboard.writeText(report)
    return true
  } catch {
    return false
  }
}
