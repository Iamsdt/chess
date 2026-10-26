import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  LockKeyhole,
  XCircle,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { z } from 'zod'

import {
  coachErrorMessage,
  defaultModelFor,
  effectiveBaseUrl,
  isVaultLockedError,
  listModels,
  MIN_PASSPHRASE_LENGTH,
  PROVIDER_LIST,
  PROVIDER_PRESETS,
  testConnection,
  useCoachUsage,
  useVaultStatus,
  vault,
  type CoachModelConfig,
  type ConnectionResult,
  type ModelInfo,
} from '@/coach'
import { Button, cn } from '@/design'
import { CoachProviderSchema, type CoachProvider, type CoachSettings } from '@/domain'

/**
 * S21 · The "AI coach" connection panel: pick a provider, point at a server, paste a key,
 * choose any model, test it.
 *
 * Why the key is never in component state beyond the field: it is typed into an uncontrolled-style
 * input, handed to the vault on Save and cleared in the same tick. Reads for "Load models" and
 * "Test" decrypt it for that one call. Nothing here can render the stored key, only its last
 * four characters, which the vault keeps beside the ciphertext so they are readable while locked.
 */

interface CoachConnectionProps {
  readonly coach: CoachSettings
  readonly onChange: (patch: Partial<CoachSettings>) => void
}

interface Feedback {
  readonly tone: 'ok' | 'error'
  readonly text: string
}

const UrlSchema = z.url()

function errorText(error: unknown): string {
  if (isVaultLockedError(error)) return 'Your key is locked. Unlock it below first.'
  return error instanceof Error && error.name.startsWith('Vault')
    ? error.message
    : coachErrorMessage(error)
}

function StatusLine({ feedback, id }: { readonly feedback: Feedback | null; readonly id: string }) {
  return (
    <div id={id} role="status" aria-live="polite" className="min-h-5 text-sm">
      {feedback === null ? null : (
        <p
          className={cn(
            'flex items-start gap-1.5',
            feedback.tone === 'ok' ? 'text-success' : 'text-destructive',
          )}
        >
          {feedback.tone === 'ok' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </p>
      )}
    </div>
  )
}

export function CoachConnection({ coach, onChange }: CoachConnectionProps) {
  const ids = useId()
  const preset = PROVIDER_PRESETS[coach.provider]
  const keyInput = useRef<HTMLInputElement>(null)

  const [keyDraft, setKeyDraft] = useState('')
  const [hint, setHint] = useState<string | undefined>(undefined)
  const [urlDraft, setUrlDraft] = useState(coach.baseUrl ?? '')
  const [modelDraft, setModelDraft] = useState(coach.model)
  const [loaded, setLoaded] = useState<readonly ModelInfo[]>([])
  const [busy, setBusy] = useState<'save' | 'remove' | 'test' | 'load' | null>(null)
  const [keyFeedback, setKeyFeedback] = useState<Feedback | null>(null)
  const [modelFeedback, setModelFeedback] = useState<Feedback | null>(null)
  const [testFeedback, setTestFeedback] = useState<Feedback | null>(null)

  // The masked hint follows the provider and the stored flag; `hasKey` flips on save and remove.
  useEffect(() => {
    let live = true
    void vault.keyHint(coach.provider).then((next) => {
      if (live) setHint(next)
    })
    return () => {
      live = false
    }
  }, [coach.provider, coach.hasKey])

  const urlInvalid = urlDraft.trim() !== '' && !UrlSchema.safeParse(urlDraft.trim()).success
  const keyRequired = preset.keyPolicy === 'required'

  function chooseProvider(next: CoachProvider): void {
    const model = defaultModelFor(next)
    setLoaded([])
    setUrlDraft('')
    setKeyDraft('')
    setKeyFeedback(null)
    setModelFeedback(null)
    setTestFeedback(null)
    if (model !== undefined) setModelDraft(model)
    // A model name or address from another provider is a request that always fails.
    onChange({ provider: next, ...(model === undefined ? {} : { model }), baseUrl: undefined })
    void vault.hasKey(next).then((has) => {
      onChange({ hasKey: has })
    })
  }

  function commitModel(): void {
    const trimmed = modelDraft.trim()
    if (trimmed !== '' && trimmed !== coach.model) onChange({ model: trimmed })
  }

  function commitUrl(): void {
    const trimmed = urlDraft.trim()
    if (urlInvalid) return
    const next = trimmed === '' ? undefined : trimmed
    if (next !== coach.baseUrl) onChange({ baseUrl: next })
  }

  /** The config for one call: the draft model/url, plus the key decrypted just for it. */
  async function callConfig(): Promise<CoachModelConfig> {
    const apiKey = preset.keyPolicy === 'none' ? undefined : await vault.loadKey(coach.provider)
    const trimmedUrl = urlDraft.trim()
    return {
      provider: coach.provider,
      model: modelDraft.trim(),
      baseUrl: trimmedUrl === '' || urlInvalid ? undefined : trimmedUrl,
      apiKey,
    }
  }

  async function saveKey(): Promise<void> {
    setBusy('save')
    setKeyFeedback(null)
    try {
      await vault.saveKey(coach.provider, keyDraft)
      setKeyDraft('')
      onChange({ hasKey: true })
      setKeyFeedback({ tone: 'ok', text: 'Key saved on this device, encrypted.' })
    } catch (error) {
      setKeyFeedback({ tone: 'error', text: errorText(error) })
    } finally {
      setBusy(null)
    }
  }

  async function removeKey(): Promise<void> {
    setBusy('remove')
    setKeyFeedback(null)
    try {
      await vault.removeKey(coach.provider)
      onChange({ hasKey: false })
      setKeyFeedback({ tone: 'ok', text: 'Key removed from this device.' })
    } catch (error) {
      setKeyFeedback({ tone: 'error', text: errorText(error) })
    } finally {
      setBusy(null)
    }
  }

  async function loadModels(): Promise<void> {
    setBusy('load')
    setModelFeedback(null)
    try {
      const models = await listModels(await callConfig())
      setLoaded(models)
      setModelFeedback({
        tone: models.length > 0 ? 'ok' : 'error',
        text:
          models.length > 0
            ? `Loaded ${String(models.length)} models. Start typing to filter.`
            : 'The server returned no models. Type the model name instead.',
      })
    } catch (error) {
      setModelFeedback({ tone: 'error', text: errorText(error) })
    } finally {
      setBusy(null)
    }
  }

  async function runTest(): Promise<void> {
    setBusy('test')
    setTestFeedback(null)
    try {
      const result: ConnectionResult = await testConnection(await callConfig())
      commitModel()
      setTestFeedback(
        result.ok
          ? { tone: 'ok', text: `Connected to ${result.model} in ${String(result.latencyMs)} ms.` }
          : { tone: 'error', text: result.message },
      )
    } catch (error) {
      setTestFeedback({ tone: 'error', text: errorText(error) })
    } finally {
      setBusy(null)
    }
  }

  const suggestions = new Map<string, string | undefined>(preset.models.map((m) => [m.id, m.label]))
  for (const model of loaded) if (!suggestions.has(model.id)) suggestions.set(model.id, model.label)

  const serverField = (
    <div className="space-y-1.5 sm:col-span-2">
      <label htmlFor={`${ids}-url`} className="field-label">
        {preset.baseUrlEditable === 'primary'
          ? 'Server address'
          : 'Server address (optional override)'}
      </label>
      <input
        id={`${ids}-url`}
        type="url"
        inputMode="url"
        className="input font-mono"
        value={urlDraft}
        placeholder={preset.baseUrl === '' ? 'https://your-server.example/v1' : preset.baseUrl}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={urlInvalid}
        aria-describedby={`${ids}-url-help`}
        onChange={(e) => {
          setUrlDraft(e.target.value)
        }}
        onBlur={commitUrl}
      />
      <p id={`${ids}-url-help`} className={cn('help', urlInvalid && 'text-destructive')}>
        {urlInvalid
          ? 'That is not a valid address. Start with http:// or https://.'
          : `Requests go to ${effectiveBaseUrl(coach.provider, urlDraft) || 'the address you enter'}.`}
        {preset.corsNote === undefined ? null : ` ${preset.corsNote}`}
      </p>
    </div>
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="provider" className="field-label">
          Provider
        </label>
        <select
          id="provider"
          className="input"
          value={coach.provider}
          onChange={(e) => {
            const next = CoachProviderSchema.safeParse(e.target.value)
            if (next.success) chooseProvider(next.data)
          }}
        >
          {PROVIDER_LIST.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="model" className="field-label">
          Model
        </label>
        <div className="flex gap-2">
          <input
            id="model"
            className="input min-w-0 flex-1 font-mono"
            list={`${ids}-models`}
            value={modelDraft}
            placeholder="Type or pick a model"
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${ids}-model-status`}
            onChange={(e) => {
              setModelDraft(e.target.value)
              // Picking from the list fires a change with an exact id; save it straight away.
              if (suggestions.has(e.target.value) && e.target.value !== coach.model) {
                onChange({ model: e.target.value })
              }
            }}
            onBlur={commitModel}
          />
          <datalist id={`${ids}-models`}>
            {[...suggestions].map(([id, label]) => (
              <option key={id} value={id}>
                {label ?? id}
              </option>
            ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] shrink-0"
            disabled={busy !== null || !preset.supportsModelListing}
            onClick={() => {
              void loadModels()
            }}
          >
            {busy === 'load' ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Load models
          </Button>
        </div>
        <StatusLine id={`${ids}-model-status`} feedback={modelFeedback} />
      </div>

      {preset.baseUrlEditable === 'primary' ? (
        serverField
      ) : (
        <details className="sm:col-span-2" open={coach.baseUrl !== undefined}>
          <summary className="help cursor-pointer font-medium">Use a different endpoint</summary>
          <div className="mt-2 grid">{serverField}</div>
        </details>
      )}

      {preset.keyPolicy === 'none' ? (
        <p className="help sm:col-span-2">
          <Lock className="mr-1 inline size-3.5 align-text-bottom" aria-hidden="true" />
          {preset.label} runs on your own machine and needs no key.
        </p>
      ) : (
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="apikey" className="field-label">
            API key{keyRequired ? '' : ' (optional)'}
          </label>
          {coach.hasKey ? (
            <p className="flex items-center gap-1.5 text-sm" data-slot="coach-key-status">
              <KeyRound className="size-4 text-success" aria-hidden="true" />
              Key stored{hint === undefined || hint === '' ? '' : ` · …${hint}`}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="apikey"
                ref={keyInput}
                type="password"
                className="input pl-9 font-mono"
                value={keyDraft}
                placeholder={coach.hasKey ? 'Paste a new key to replace it' : preset.keyPlaceholder}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={`${ids}-key-status`}
                onChange={(e) => {
                  setKeyDraft(e.target.value)
                }}
              />
            </div>
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={busy !== null || keyDraft.trim() === ''}
              onClick={() => {
                void saveKey()
              }}
            >
              {coach.hasKey ? 'Replace key' : 'Save key'}
            </Button>
            {coach.hasKey ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                disabled={busy !== null}
                onClick={() => {
                  void removeKey()
                }}
              >
                Remove key
              </Button>
            ) : null}
          </div>
          <StatusLine id={`${ids}-key-status`} feedback={keyFeedback} />
          <p className="help">
            Encrypted in this browser and sent only to {preset.label}.{' '}
            {preset.keyUrl === '' ? null : (
              <a
                href={preset.keyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-semibold text-primary underline"
              >
                Get a {preset.label} key
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </p>
        </div>
      )}

      <div className="space-y-1.5 sm:col-span-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          disabled={busy !== null}
          onClick={() => {
            void runTest()
          }}
        >
          {busy === 'test' ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Test connection
        </Button>
        <StatusLine id={`${ids}-test-status`} feedback={testFeedback} />
      </div>
    </div>
  )
}

/**
 * The optional passphrase layer. The switch shows what the vault says, not what settings last
 * recorded, because the vault is the thing that actually holds the lock.
 */
export function CoachPassphraseLock({ coach, onChange }: CoachConnectionProps) {
  const ids = useId()
  const status = useVaultStatus()
  const [form, setForm] = useState<'set' | 'unlock' | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [working, setWorking] = useState(false)

  const enabled = status?.passphraseSet ?? coach.passphraseLock
  const locked = status?.locked === true

  function reset(): void {
    setForm(null)
    setPassphrase('')
    setConfirm('')
  }

  async function run(action: () => Promise<void>, done?: string): Promise<void> {
    setWorking(true)
    setFeedback(null)
    try {
      await action()
      reset()
      if (done !== undefined) setFeedback({ tone: 'ok', text: done })
    } catch (error) {
      setFeedback({ tone: 'error', text: errorText(error) })
    } finally {
      setWorking(false)
    }
  }

  function toggle(on: boolean): void {
    setFeedback(null)
    if (on) setForm('set')
    else if (locked) setForm('unlock')
    else
      void run(async () => {
        await vault.clearPassphrase()
        onChange({ passphraseLock: false })
      }, 'Passphrase lock is off.')
  }

  const mismatch = form === 'set' && confirm !== '' && confirm !== passphrase

  return (
    <div className="mt-4 rounded-xl border bg-card p-3 text-sm">
      <label
        htmlFor={`${ids}-switch`}
        className="flex min-h-[44px] cursor-pointer items-center gap-3"
      >
        <LockKeyhole className="size-4 shrink-0 text-foreground" aria-hidden="true" />
        <span className="flex-1">
          <span className="block font-medium">Passphrase lock</span>
          <span className="help">
            Adds a passphrase (PBKDF2) on top. You unlock once per session.
          </span>
        </span>
        <span className="switch">
          <input
            type="checkbox"
            id={`${ids}-switch`}
            checked={enabled}
            disabled={working || status === undefined}
            onChange={(e) => {
              toggle(e.target.checked)
            }}
          />
          <span />
        </span>
      </label>

      {enabled && locked && form === null ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-muted p-2.5">
          <span>Your key is locked for this session.</span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setForm('unlock')
            }}
          >
            Unlock
          </Button>
        </div>
      ) : null}

      {form === null ? null : (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (form === 'unlock') {
              void run(() => vault.unlock(passphrase), 'Unlocked for this session.')
            } else if (!mismatch) {
              void run(async () => {
                await vault.setPassphrase(passphrase)
                onChange({ passphraseLock: true })
              }, 'Passphrase lock is on. Keep the passphrase safe: it cannot be recovered.')
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={`${ids}-pass`} className="field-label">
              {form === 'set' ? 'New passphrase' : 'Passphrase'}
            </label>
            <input
              id={`${ids}-pass`}
              type="password"
              className="input"
              value={passphrase}
              minLength={form === 'set' ? MIN_PASSPHRASE_LENGTH : undefined}
              autoComplete={form === 'set' ? 'new-password' : 'current-password'}
              onChange={(e) => {
                setPassphrase(e.target.value)
              }}
            />
          </div>
          {form === 'set' ? (
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-confirm`} className="field-label">
                Repeat passphrase
              </label>
              <input
                id={`${ids}-confirm`}
                type="password"
                className="input"
                value={confirm}
                autoComplete="new-password"
                aria-invalid={mismatch}
                onChange={(e) => {
                  setConfirm(e.target.value)
                }}
              />
              <p className={cn('help', mismatch && 'text-destructive')}>
                {mismatch
                  ? 'The two passphrases do not match.'
                  : `At least ${String(MIN_PASSPHRASE_LENGTH)} characters. There is no recovery if you forget it: you would paste your key again.`}
              </p>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={
                working || passphrase === '' || (form === 'set' && (mismatch || confirm === ''))
              }
            >
              {form === 'set' ? 'Set passphrase' : 'Unlock'}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={working} onClick={reset}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      <StatusLine id={`${ids}-status`} feedback={feedback} />
    </div>
  )
}

const CAP_CHOICES = [100_000, 500_000, 1_000_000, 5_000_000, 0] as const

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${String(Math.round(tokens / 100_000) / 10)}M`
  return tokens >= 1000 ? `${String(Math.round(tokens / 1000))}k` : String(tokens)
}

/** "x of cap tokens this month", live from the same counter the port writes. */
export function CoachUsageMeter({ coach, onChange }: CoachConnectionProps) {
  const id = useId()
  const { total, usage } = useCoachUsage()
  const cap = coach.monthlyTokenCap
  const percent = cap === 0 ? 0 : Math.min(100, Math.round((total / cap) * 100))
  const choices = CAP_CHOICES.includes(cap as (typeof CAP_CHOICES)[number])
    ? CAP_CHOICES
    : [...CAP_CHOICES, cap].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b))

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Monthly usage</span>
        <span className="text-muted-foreground">
          <b className="font-semibold text-foreground">{total.toLocaleString('en-US')}</b> tokens so
          far
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={cap === 0 ? 0 : Math.min(total, cap)}
        aria-valuemin={0}
        aria-valuemax={cap === 0 ? 1 : cap}
        aria-label="Monthly token usage"
        className="progress mt-2"
      >
        <span
          style={{ width: `${String(percent)}%` }}
          className={percent >= 100 ? 'bg-destructive' : undefined}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
        <span>
          {total.toLocaleString('en-US')} of {cap === 0 ? 'no cap' : `${formatTokens(cap)} tokens`}
          {usage.requests > 0 ? ` · ${String(usage.requests)} answers` : ''}
        </span>
        <span>Soft cap · you set it</span>
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm">
        <label htmlFor={`${id}-cap`} className="font-medium">
          Monthly token cap
        </label>
        <select
          id={`${id}-cap`}
          className="input w-auto"
          value={cap}
          onChange={(e) => {
            onChange({ monthlyTokenCap: Number(e.target.value) })
          }}
        >
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice === 0 ? 'No cap' : `${formatTokens(choice)} tokens`}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Counted from what your provider reports. Billing happens on your provider account. At the
        cap Sage stops answering until you raise it.
      </p>
    </div>
  )
}
