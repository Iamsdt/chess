import { Cpu } from 'lucide-react'
import { useId, useState } from 'react'

import { decisionsRepo } from '@/data'
import { ProbabilityBars, MODE_TITLES } from '@/decision'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Switch,
} from '@/design'
import {
  DECISION_FLAG_KEYS,
  DECISION_MODE_LABELS,
  DECISION_QUESTIONS,
  type CoachDecision,
  type DecisionLabels,
  type DecisionModeLabel,
  type Result,
} from '@/domain'

import { DECISION_MODE_MIN_PROB } from '../modes'

/**
 * "Decided locally · Grandmaster 87% · 14 ms" under a Sage reply, and the sheet behind it.
 *
 * The chip is the visible half of the decision model: it shows that a small model on this device
 * routed the question, lets you see every probability, and lets you say it was wrong. The
 * correction is training data (it is written to the local log and ends up in the export).
 */

export interface DecisionChipProps {
  readonly decision: CoachDecision
  /** Replaceable in tests; defaults to the `decisions` repository. */
  readonly onCorrect?:
    ((id: string, labels: DecisionLabels) => Promise<Result<unknown>>) | undefined
}

interface Draft {
  mode: DecisionModeLabel
  flags: Record<string, boolean>
}

function initialDraft(decision: CoachDecision): Draft {
  const flags: Record<string, boolean> = {}
  for (const key of DECISION_FLAG_KEYS) flags[key] = (decision.flags[key] ?? 0) >= 0.5
  return { mode: decision.mode.label, flags }
}

function draftToLabels(draft: Draft): DecisionLabels {
  const labels: DecisionLabels = { mode: draft.mode }
  for (const key of DECISION_FLAG_KEYS) labels[key] = draft.flags[key] === true ? 1 : 0
  return labels
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

export function DecisionChip({ decision, onCorrect }: DecisionChipProps) {
  const [open, setOpen] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => initialDraft(decision))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const selectId = useId()

  const { label, prob } = decision.mode
  const percent = Math.round(prob * 100)
  const sure = prob >= DECISION_MODE_MIN_PROB
  const summary = sure
    ? `Decided locally · ${MODE_TITLES[label] ?? label} ${String(percent)}% · ${String(Math.round(decision.latencyMs))} ms`
    : `Decided locally · unsure (${MODE_TITLES[label] ?? label} ${String(percent)}%) · ${String(Math.round(decision.latencyMs))} ms`
  const correct = onCorrect ?? ((id, labels) => decisionsRepo.correct(id, labels))

  async function save(): Promise<void> {
    if (decision.logId === undefined) return
    setSaveState('saving')
    const outcome = await correct(decision.logId, draftToLabels(draft))
    setSaveState(outcome.ok ? 'saved' : 'failed')
  }

  return (
    <>
      <button
        type="button"
        data-slot="decision-chip"
        className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
        }}
      >
        <Cpu aria-hidden="true" className="size-3 shrink-0" />
        <span className="truncate">{summary}</span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setCorrecting(false)
            setSaveState('idle')
          }
        }}
      >
        <DialogContent className="max-w-md" data-slot="decision-dialog">
          <DialogHeader>
            <DialogTitle>Decided on your device</DialogTitle>
            <DialogDescription>
              {decision.modelId} read your question in {Math.round(decision.latencyMs)} ms. Nothing
              left this browser.
            </DialogDescription>
          </DialogHeader>

          <ProbabilityBars mode={decision.mode.probs} flags={decision.flags} />

          {correcting ? (
            <form
              className="space-y-3 border-t pt-3"
              aria-label="Correct this decision"
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor={selectId} className="font-medium">
                  Right mode
                </label>
                <select
                  id={selectId}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                  value={draft.mode}
                  onChange={(event) => {
                    setDraft({ ...draft, mode: event.target.value as DecisionModeLabel })
                  }}
                >
                  {DECISION_MODE_LABELS.map((item) => (
                    <option key={item} value={item}>
                      {MODE_TITLES[item] ?? item}
                    </option>
                  ))}
                </select>
              </div>
              <ul className="space-y-2">
                {DECISION_QUESTIONS.filter((question) => question.kind === 'binary').map(
                  (question) => (
                    <li key={question.key} className="flex items-center justify-between gap-3">
                      <label htmlFor={`${selectId}-${question.key}`} className="text-sm">
                        <span className="font-medium">{question.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {question.description}
                        </span>
                      </label>
                      <Switch
                        id={`${selectId}-${question.key}`}
                        checked={draft.flags[question.key] === true}
                        onCheckedChange={(checked) => {
                          setDraft({ ...draft, flags: { ...draft.flags, [question.key]: checked } })
                        }}
                      />
                    </li>
                  ),
                )}
              </ul>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={saveState === 'saving'}>
                  Save correction
                </Button>
                <p role="status" className="text-xs text-muted-foreground">
                  {saveState === 'saved'
                    ? 'Saved. It will be in your training export.'
                    : saveState === 'failed'
                      ? 'Could not save that correction.'
                      : ''}
                </p>
              </div>
            </form>
          ) : decision.logId === undefined ? (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Logging is off, so this decision was not saved and cannot be corrected. Turn it on in
              Settings to build a training set.
            </p>
          ) : (
            <div className="border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCorrecting(true)
                }}
              >
                Correct this
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
