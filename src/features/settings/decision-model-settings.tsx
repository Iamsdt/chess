import { AlertCircle, Cpu, Download, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { decisionsRepo, useDecisionCounts } from '@/data'
import {
  buildTrainingExport,
  DEFAULT_ENCODER_MODEL,
  DEFAULT_MODEL_SIZE_MB,
  getDecisionEngine,
  loadSeeds,
  ProbabilityBars,
  trainingFileName,
  useDecisionStatus,
  type Decision,
  type DecisionEngine,
} from '@/decision'
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Progress,
  toast,
} from '@/design'
import type { DecisionSettings } from '@/domain'

import { saveTextFile } from './settings-actions'

/**
 * Settings → Decision model: turn the on-device model on, try it, point it at a fine-tune, and
 * export what it has logged as training data.
 *
 * Why it takes the engine as a prop: the real one loads a worker and 23 MB of weights, so tests
 * pass a scripted engine and the screen never knows the difference.
 */

export interface DecisionModelSettingsProps {
  readonly decision: DecisionSettings
  readonly onChange: (patch: Partial<DecisionSettings>) => void
  readonly engine?: DecisionEngine | undefined
}

const PLAYGROUND_DELAY_MS = 150
const PLAYGROUND_BUDGET_MS = 5_000

function formatMetric(value: unknown): string {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(3)
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export function DecisionModelSettings({
  decision,
  onChange,
  engine: injected,
}: DecisionModelSettingsProps) {
  const engine = injected ?? getDecisionEngine()
  const status = useDecisionStatus(engine)
  const counts = useDecisionCounts()
  const ids = useId()

  const [source, setSource] = useState<'builtin' | 'custom'>(
    decision.manifestUrl === undefined ? 'builtin' : 'custom',
  )
  const [urlDraft, setUrlDraft] = useState(decision.manifestUrl ?? '')
  const [tryText, setTryText] = useState('')
  const [tried, setTried] = useState<Decision | null | undefined>(undefined)
  const [confirmClear, setConfirmClear] = useState(false)
  const [exportNote, setExportNote] = useState<string | undefined>(undefined)
  const sequence = useRef(0)

  const ready = status.kind === 'ready'
  // Cleared by derivation, not by an effect: an empty box or a stopped model shows no result.
  const shown = ready && tryText.trim() !== '' ? tried : undefined
  const downloading = status.kind === 'downloading'

  // A saved "on" survives a reload; the model itself does not, so wake it up when this opens.
  useEffect(() => {
    if (decision.enabled) void engine.enable({ manifestUrl: decision.manifestUrl })
  }, [engine, decision.enabled, decision.manifestUrl])

  // The playground: debounced, and a slow answer to an old keystroke never overwrites a new one.
  useEffect(() => {
    const text = tryText.trim()
    sequence.current += 1
    if (!ready || text === '') return
    const mine = sequence.current
    const timer = setTimeout(() => {
      void engine.decide(text, { timeoutMs: PLAYGROUND_BUDGET_MS }).then((answer) => {
        if (mine === sequence.current) setTried(answer)
      })
    }, PLAYGROUND_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [engine, ready, tryText])

  function toggleEnabled(next: boolean): void {
    onChange({ enabled: next })
    if (next) void engine.enable({ manifestUrl: decision.manifestUrl })
    else engine.disable()
  }

  function useBuiltin(): void {
    setSource('builtin')
    onChange({ manifestUrl: undefined, enabled: true })
    void engine.enable()
  }

  function loadCustom(): void {
    const url = urlDraft.trim()
    onChange({ manifestUrl: url, enabled: true })
    void engine.enable({ manifestUrl: url })
  }

  async function exportData(): Promise<void> {
    try {
      const [seeds, logged] = await Promise.all([loadSeeds(), decisionsRepo.exportRows()])
      const built = buildTrainingExport(seeds, logged)
      saveTextFile(trainingFileName(), built.text, 'application/x-ndjson')
      setExportNote(
        `Exported ${String(built.seedCount + built.loggedCount)} rows (${String(built.seedCount)} seed, ${String(built.loggedCount)} logged).`,
      )
    } catch {
      toast.error('Could not build the training export')
    }
  }

  async function clearLog(): Promise<void> {
    const outcome = await decisionsRepo.clear()
    setConfirmClear(false)
    setExportNote(undefined)
    if (!outcome.ok) toast.error('Could not clear the log', { description: outcome.error.message })
  }

  const urlLooksValid = /^https?:\/\/\S+$/i.test(urlDraft.trim())
  const total = counts?.total ?? 0
  const corrected = counts?.corrected ?? 0

  return (
    <section id="decision" className="card" aria-labelledby="decision-h">
      <div className="flex flex-wrap items-center gap-3 border-b p-4 sm:px-6 sm:py-4">
        <span className="sage-av size-9 rounded-xl">
          <Cpu className="size-4" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 id="decision-h" className="text-lg font-bold">
            Decision model
          </h2>
          <p className="help">
            A small model that runs in this browser and decides how Sage should answer. No key, no
            server.
          </p>
        </div>
        <span className="badge badge-soft" data-slot="decision-status-badge">
          <span
            className={cn(
              'size-1.5 rounded-full',
              ready
                ? 'bg-success'
                : status.kind === 'error'
                  ? 'bg-destructive'
                  : 'bg-muted-foreground',
            )}
          />
          {ready ? 'Ready' : downloading ? 'Loading' : status.kind === 'error' ? 'Error' : 'Off'}
        </span>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {/* On / off */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <span id={`${ids}-enabled-label`} className="text-sm font-medium">
              Run the decision model on this device
            </span>
            <label className="switch" aria-label="Run the decision model on this device">
              <input
                id={`${ids}-enabled`}
                aria-labelledby={`${ids}-enabled-label`}
                type="checkbox"
                role="switch"
                checked={decision.enabled}
                onChange={(event) => {
                  toggleEnabled(event.target.checked)
                }}
              />
              <span />
            </label>
          </div>
          <p className="help">
            The first time it downloads about {DEFAULT_MODEL_SIZE_MB} MB ({DEFAULT_ENCODER_MODEL},
            int8) from Hugging Face. After that it is cached and works offline. Sage then shows what
            it decided under each reply.
          </p>
          {downloading ? (
            <div className="mt-3 space-y-1" data-slot="decision-progress">
              <Progress
                value={Math.round(status.progress * 100)}
                aria-label="Decision model download progress"
              />
              <p role="status" className="text-xs text-muted-foreground">
                {status.progress >= 1
                  ? 'Preparing the model…'
                  : `Downloading ${String(Math.round(status.progress * 100))}% of about ${String(DEFAULT_MODEL_SIZE_MB)} MB`}
              </p>
            </div>
          ) : null}
          {status.kind === 'error' ? (
            <p
              role="alert"
              className="mt-3 flex items-start gap-1.5 text-sm text-destructive"
              data-slot="decision-error"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{status.message}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void engine.enable({ manifestUrl: decision.manifestUrl })
                }}
              >
                Try again
              </Button>
            </p>
          ) : null}
        </div>

        {/* Facts */}
        {status.kind === 'ready' ? (
          <dl
            className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl bg-accent/60 p-4 text-sm"
            data-slot="decision-facts"
          >
            <dt className="text-muted-foreground">Model</dt>
            <dd className="font-mono text-xs">{status.modelId}</dd>
            <dt className="text-muted-foreground">Encoder</dt>
            <dd className="font-mono text-xs">{status.encoder}</dd>
            <dt className="text-muted-foreground">Running on</dt>
            <dd>{status.backend === 'wasm' ? 'CPU (WebAssembly)' : status.backend}</dd>
            <dt className="text-muted-foreground">Loaded in</dt>
            <dd>{(status.loadMs / 1000).toFixed(1)} s</dd>
            {status.unavailable.length > 0 ? (
              <>
                <dt className="text-muted-foreground">Not answered</dt>
                <dd>{status.unavailable.join(', ')}</dd>
              </>
            ) : null}
          </dl>
        ) : null}

        {/* Playground */}
        <div>
          <label htmlFor={`${ids}-try`} className="field-label">
            Try it
          </label>
          <input
            id={`${ids}-try`}
            type="text"
            className="input"
            value={tryText}
            disabled={!ready}
            placeholder={
              ready
                ? 'Type a question, e.g. "tell me the move for this puzzle"'
                : 'Turn the model on to try it'
            }
            autoComplete="off"
            onChange={(event) => {
              setTryText(event.target.value)
            }}
          />
          <div className="mt-3 min-h-8" aria-live="polite" data-slot="decision-playground">
            {ready && tryText.trim() !== '' && shown === undefined ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                Thinking…
              </p>
            ) : null}
            {shown === null ? (
              <p className="text-sm text-muted-foreground">The model had no answer for that.</p>
            ) : null}
            {shown ? (
              <div className="space-y-3">
                <ProbabilityBars mode={shown.mode.probs} flags={shown.flags} />
                <p className="text-xs text-muted-foreground" data-slot="decision-latency">
                  Decided in {shown.latencyMs.toFixed(1)} ms on this device.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Source */}
        <fieldset className="space-y-3">
          <legend className="field-label">Model source</legend>
          <div className="flex items-start gap-2 text-sm">
            <input
              id={`${ids}-builtin`}
              type="radio"
              name={`${ids}-source`}
              className="mt-1"
              checked={source === 'builtin'}
              onChange={useBuiltin}
            />
            <label htmlFor={`${ids}-builtin`}>
              <span className="font-semibold">Built-in</span>
              <span className="block text-xs text-muted-foreground">
                MiniLM encoder with prototype heads built from the app&apos;s example questions.
              </span>
            </label>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <input
              id={`${ids}-custom`}
              type="radio"
              name={`${ids}-source`}
              className="mt-1"
              checked={source === 'custom'}
              onChange={() => {
                setSource('custom')
              }}
            />
            <label htmlFor={`${ids}-custom`}>
              <span className="font-semibold">Custom manifest URL</span>
              <span className="block text-xs text-muted-foreground">
                A fine-tuned model you host, described by a chess-king-decision/1 manifest.
              </span>
            </label>
          </div>
          {source === 'custom' ? (
            <div className="space-y-2 pl-6">
              <label htmlFor={`${ids}-url`} className="sr-only">
                Manifest URL
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id={`${ids}-url`}
                  type="url"
                  className="input min-w-[12rem] flex-1 font-mono"
                  value={urlDraft}
                  placeholder="https://huggingface.co/you/model/resolve/main/manifest.json"
                  spellCheck={false}
                  onChange={(event) => {
                    setUrlDraft(event.target.value)
                  }}
                />
                <Button type="button" disabled={!urlLooksValid || downloading} onClick={loadCustom}>
                  Load
                </Button>
              </div>
              {status.kind === 'ready' && status.source === 'custom' && status.metrics ? (
                <dl
                  className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs"
                  data-slot="decision-metrics"
                >
                  {Object.entries(status.metrics).map(([name, value]) => (
                    <div key={name} className="contents">
                      <dt className="text-muted-foreground">{name}</dt>
                      <dd className="font-mono">{formatMetric(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        {/* Log + export */}
        <div className="space-y-3 border-t pt-5">
          <div className="flex items-center justify-between gap-3">
            <span id={`${ids}-log-label`} className="text-sm font-medium">
              Keep a local log of decisions
            </span>
            <label className="switch" aria-label="Keep a local log of decisions">
              <input
                id={`${ids}-log`}
                aria-labelledby={`${ids}-log-label`}
                type="checkbox"
                role="switch"
                checked={decision.logDecisions}
                onChange={(event) => {
                  onChange({ logDecisions: event.target.checked })
                }}
              />
              <span />
            </label>
          </div>
          <p className="help">
            Saves each question and what the model decided, on this device only. Corrections you
            make under Sage&apos;s replies are saved too. Both become training examples.
          </p>
          <p className="text-sm" data-slot="decision-counts">
            <b className="font-semibold">{total}</b> logged ·{' '}
            <b className="font-semibold">{corrected}</b> corrected
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void exportData()
              }}
            >
              <Download aria-hidden="true" />
              Export training data
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={total === 0}
              onClick={() => {
                setConfirmClear(true)
              }}
            >
              <Trash2 aria-hidden="true" />
              Clear log
            </Button>
          </div>
          <p role="status" className="min-h-5 text-xs text-muted-foreground">
            {exportNote ?? ''}
          </p>
        </div>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear the decision log?</DialogTitle>
            <DialogDescription>
              This deletes {total} logged {total === 1 ? 'decision' : 'decisions'}, corrections
              included. Export first if you want to keep them as training data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmClear(false)
              }}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void clearLog()
              }}
            >
              Clear log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
