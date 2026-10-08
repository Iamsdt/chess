import { useMemo, useState } from 'react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/design'
import type { VisualizationAttachment } from '@/domain'

import { ExerciseRun } from './exercise-run'
import {
  initialLadder,
  narrationOf,
  plies,
  recordAnswer,
  spanOf,
  stepDown,
  viewOf,
  type LadderState,
} from './ladder'
import { LADDER_PLAN, applyDials, dialsFromAttachment, ladderExercise } from './ladder-session'
import { EXERCISE_NAMES } from './names'
import { DEFAULT_TIMING, type Timing } from './timing'

export interface VisualizationDialogProps {
  /** The exercise to run. Ignored in ladder mode, which builds its own five. */
  readonly attachment?: VisualizationAttachment
  readonly mode?: 'single' | 'ladder'
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly timing?: Partial<Timing>
}

/**
 * Sage's own board in a dialog (coach-agent.md §11): the user's board is never touched.
 * One exercise from a card, or a short adaptive ladder from "Train with Sage".
 */
export function VisualizationDialog({
  attachment,
  mode = 'single',
  open,
  onOpenChange,
  timing,
}: VisualizationDialogProps) {
  const times = useMemo(() => ({ ...DEFAULT_TIMING, ...timing }), [timing])
  const title = mode === 'ladder' ? 'Train with Sage' : (attachment?.title ?? 'Visualization')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="viz-dialog"
        className="top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none p-4 sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:p-6"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === 'ladder'
              ? 'Five short exercises on Sage’s own board. Your game is not touched.'
              : 'Sage’s own board. Your game is not touched.'}
          </DialogDescription>
        </DialogHeader>
        {mode === 'ladder' ? (
          <LadderRun
            timing={times}
            onClose={() => {
              onOpenChange(false)
            }}
          />
        ) : attachment === undefined ? null : (
          <SingleRun
            attachment={attachment}
            timing={times}
            onClose={() => {
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SingleRun({
  attachment,
  timing,
  onClose,
}: {
  readonly attachment: VisualizationAttachment
  readonly timing: Timing
  readonly onClose: () => void
}) {
  const [current, setCurrent] = useState(attachment)
  const [version, setVersion] = useState(0)
  const [ladder, setLadder] = useState<LadderState>(() =>
    initialLadder(dialsFromAttachment(attachment)),
  )
  return (
    <ExerciseRun
      key={version}
      attachment={current}
      narration={narrationOf(ladder.dials)}
      timing={timing}
      nextLabel="Done"
      onNext={onClose}
      onStepDown={() => {
        const next = stepDown(ladder)
        setLadder(next.state)
        if (next.change === null) return { reason: 'This is already as gentle as it gets.' }
        return { reason: next.change.reason, easier: applyDials(current, next.state.dials) }
      }}
      onSwap={(easier) => {
        setCurrent(easier)
        setVersion((value) => value + 1)
      }}
    />
  )
}

function LadderRun({ timing, onClose }: { readonly timing: Timing; readonly onClose: () => void }) {
  const [ladder, setLadder] = useState<LadderState>(() => initialLadder())
  const [index, setIndex] = useState(0)
  const [round, setRound] = useState(0)
  const done = index >= LADDER_PLAN.length

  // Chosen when an exercise starts, so a dial change mid-exercise waits for the next one.
  const [exercise, setExercise] = useState(() => ladderExercise(ladder.dials, 0))
  const [stepped, setStepped] = useState<LadderState | null>(null)

  const advance = () => {
    const base = stepped ?? ladder
    setStepped(null)
    setLadder(base)
    const next = index + 1
    setIndex(next)
    if (next < LADDER_PLAN.length) setExercise(ladderExercise(base.dials, next))
  }

  if (done) {
    const span = spanOf(ladder.attempts)
    const right = ladder.attempts.filter((attempt) => attempt.correct).length
    return (
      <div data-slot="viz-summary" className="space-y-3">
        <p className="text-base font-medium">
          {String(right)} of {String(ladder.attempts.length)} right.
        </p>
        <p className="text-sm">
          {span > 0
            ? `Your visualization span: ${String(span)} plies.`
            : 'No span yet. Shorter lines will build it.'}
        </p>
        <p className="text-xs text-muted-foreground">
          Next time: {String(plies(ladder.dials))} plies, {viewOf(ladder.dials)} view.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => {
              const fresh = initialLadder(ladder.dials)
              setLadder(fresh)
              setIndex(0)
              setRound((value) => value + 1)
              setExercise(ladderExercise(fresh.dials, 0))
            }}
          >
            Go again
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p data-slot="viz-ladder-step" className="text-xs text-muted-foreground">
        Exercise {String(index + 1)} of {String(LADDER_PLAN.length)} ·{' '}
        {EXERCISE_NAMES[exercise.attachment.exercise]}
      </p>
      <ExerciseRun
        key={`${String(round)}-${String(index)}`}
        attachment={exercise.attachment}
        narration={exercise.narration}
        timing={timing}
        nextLabel={index + 1 >= LADDER_PLAN.length ? 'See my span' : 'Next exercise'}
        onNext={advance}
        onAnswered={(correct) => {
          const step = recordAnswer(ladder, { plies: exercise.plies, correct })
          setLadder(step.state)
          return step.change?.reason ?? null
        }}
        onStepDown={() => {
          const step = stepDown(stepped ?? ladder)
          setStepped(step.state)
          return {
            reason: step.change?.reason ?? 'This is already as gentle as it gets.',
          }
        }}
      />
    </div>
  )
}
