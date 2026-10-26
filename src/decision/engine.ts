import {
  BUILTIN_MANIFEST,
  ManifestSchema,
  type Decision,
  type DecisionQuestionKey,
  type Manifest,
} from './contract'
import { toDecision } from './evaluate'

import type { DecisionClient } from './client'

/**
 * The decision engine: one object the rest of the app talks to.
 *
 * It owns the worker's lifetime and a small status machine, and it never throws at a caller who
 * only wants an answer: `decide` returns `null` when the model is not ready or is too slow, so a
 * missing model degrades Sage to what it did before and never to an error.
 */

export type DecisionSource = 'builtin' | 'custom'

export interface DecisionModelInfo {
  readonly modelId: string
  readonly source: DecisionSource
  readonly encoder: string
  readonly backend: string
  readonly loadMs: number
  /** Training metrics from a custom manifest, shown as-is. */
  readonly metrics: Readonly<Record<string, unknown>> | undefined
  /** Questions this model cannot answer. */
  readonly unavailable: readonly DecisionQuestionKey[]
}

export type DecisionStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'downloading'; readonly progress: number }
  | ({ readonly kind: 'ready' } & DecisionModelInfo)
  | { readonly kind: 'error'; readonly message: string }

export interface DecideOptions {
  /** Where the question was asked; recorded by the caller, never shown to the model. */
  readonly screen?: string | undefined
  /** Give up after this long and return `null`. Default 400 ms. */
  readonly timeoutMs?: number | undefined
}

export interface EnableOptions {
  /** A fine-tuned model's manifest. Omit for the built-in encoder with prototype heads. */
  readonly manifestUrl?: string | undefined
}

export interface DecisionEngine {
  getStatus: () => DecisionStatus
  subscribe: (listener: () => void) => () => void
  /** Downloads (once) and loads the model. Idempotent per source; a new source reloads. */
  enable: (options?: EnableOptions) => Promise<void>
  /** Frees the worker. The downloaded weights stay cached by the browser. */
  disable: () => void
  decide: (text: string, options?: DecideOptions) => Promise<Decision | null>
}

export interface DecisionEngineDeps {
  readonly createClient: () => Promise<DecisionClient>
  readonly fetchManifest?: ((url: string) => Promise<unknown>) | undefined
}

export const DEFAULT_DECIDE_TIMEOUT_MS = 400

async function defaultFetchManifest(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`The manifest could not be fetched (HTTP ${String(response.status)})`)
  }
  return response.json()
}

/** Why: a manifest comes from a URL the user typed, so every complaint is theirs to read. */
export function parseManifest(raw: unknown): Manifest {
  const parsed = ManifestSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  const issue = parsed.error.issues[0]
  const where = issue !== undefined && issue.path.length > 0 ? ` (at ${issue.path.join('.')})` : ''
  throw new Error(
    `That is not a valid decision-model manifest: ${issue?.message ?? 'unreadable'}${where}`,
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message !== ''
    ? error.message
    : 'The decision model failed to load'
}

export function createDecisionEngine(deps: DecisionEngineDeps): DecisionEngine {
  const fetchManifest = deps.fetchManifest ?? defaultFetchManifest
  const listeners = new Set<() => void>()
  let status: DecisionStatus = { kind: 'idle' }
  let client: DecisionClient | undefined
  let loading: { readonly source: string; readonly promise: Promise<void> } | undefined
  let readySource: string | undefined
  /** Bumped on every enable/disable so a stale load cannot overwrite a newer state. */
  let generation = 0

  function setStatus(next: DecisionStatus): void {
    status = next
    for (const listener of [...listeners]) listener()
  }

  function teardown(): void {
    client?.dispose()
    client = undefined
    readySource = undefined
    loading = undefined
  }

  async function load(
    source: string,
    manifestUrl: string | undefined,
    mine: number,
  ): Promise<void> {
    setStatus({ kind: 'downloading', progress: 0 })
    try {
      const manifest =
        manifestUrl === undefined
          ? BUILTIN_MANIFEST
          : parseManifest(await fetchManifest(manifestUrl))
      if (mine !== generation) return
      const created = await deps.createClient()
      if (mine !== generation) {
        created.dispose()
        return
      }
      client = created
      const info = await created.load(manifest, (fraction) => {
        if (mine === generation) {
          setStatus({ kind: 'downloading', progress: Math.max(0, Math.min(1, fraction)) })
        }
      })
      if (mine !== generation) return
      readySource = source
      setStatus({
        kind: 'ready',
        modelId: manifest.id,
        source: manifestUrl === undefined ? 'builtin' : 'custom',
        encoder: manifest.encoder.model,
        backend: info.backend,
        loadMs: info.loadMs,
        metrics: manifest.metrics,
        unavailable: info.unavailable,
      })
    } catch (error: unknown) {
      if (mine !== generation) return
      teardown()
      setStatus({ kind: 'error', message: messageOf(error) })
    }
  }

  return {
    getStatus: () => status,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    enable(options = {}) {
      const trimmed = options.manifestUrl?.trim()
      const manifestUrl = trimmed === undefined || trimmed === '' ? undefined : trimmed
      const source = manifestUrl ?? 'builtin'
      if (status.kind === 'ready' && readySource === source) return Promise.resolve()
      if (loading?.source === source) return loading.promise
      teardown()
      generation += 1
      const promise = load(source, manifestUrl, generation).finally(() => {
        if (loading?.promise === promise) loading = undefined
      })
      loading = { source, promise }
      return promise
    },

    disable() {
      generation += 1
      teardown()
      setStatus({ kind: 'idle' })
    },

    async decide(text, options = {}) {
      const input = text.trim()
      const active = client
      if (status.kind !== 'ready' || active === undefined || input === '') return null
      const timeoutMs = options.timeoutMs ?? DEFAULT_DECIDE_TIMEOUT_MS
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const answer = await Promise.race([
          active.decide(input),
          new Promise<null>((resolve) => {
            timer = setTimeout(() => {
              resolve(null)
            }, timeoutMs)
          }),
        ])
        if (answer === null) return null
        return (
          toDecision(answer.probs, {
            modelId: answer.modelId,
            latencyMs: answer.latencyMs,
            input,
          }) ?? null
        )
      } catch {
        return null
      } finally {
        if (timer !== undefined) clearTimeout(timer)
      }
    },
  }
}
