import { Anchor, ArrowDownToLine, Eye, Rewind, SkipForward } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Board } from '@/board'
import { Button, Progress } from '@/design'
import type { Square, VisualizationAttachment } from '@/domain'
import { parseSquareGuess } from '@/features/drills/vision-squares'

import { AnswerPanel } from './answer-panel'
import { BlankBoard } from './blank-board'
import { EXERCISE_NAMES } from './names'
import { narrate, type NarrationLevel } from './narrate'
import { checkAnswer, prepare, revealText, type Answer, type Prepared } from './questions'
import { findSlip, type Slip } from './slip'
import { anchorSquares, askDisplay, hidesBoard, watchDisplay, type Display } from './views'

import type { Timing } from './timing'

export interface StepDownResult {
  readonly reason: string
  /** A lighter version of this exercise, when there is one. */
  readonly easier?: VisualizationAttachment
}

export interface ExerciseRunProps {
  readonly attachment: VisualizationAttachment
  readonly narration: NarrationLevel
  readonly timing: Timing
  /** Told once, on the first answer. May return a line about the ladder changing. */
  readonly onAnswered?: (correct: boolean) => string | null
  readonly onStepDown?: () => StepDownResult | null
  readonly onSwap?: (easier: VisualizationAttachment) => void
  readonly onNext: () => void
  readonly nextLabel: string
}

type Phase = 'watch' | 'ask' | 'result'
type Overlay =
  | { readonly kind: 'peek'; readonly ply: number }
  | { readonly kind: 'anchors' }
  | { readonly kind: 'replay' }

interface Outcome {
  readonly correct: boolean
  readonly slip: Slip | null
}

const moveNumber = (prepared: Prepared, index: number): string => {
  const move = prepared.history[index]
  if (move === undefined) return ''
  return `${String(move.moveNumber)}${move.color === 'white' ? '.' : '...'}`
}

/** One exercise from first move to verdict. Holds the key in memory but never draws it early. */
export function ExerciseRun(props: ExerciseRunProps) {
  const { attachment, narration, timing, onAnswered, onStepDown, onSwap, onNext, nextLabel } = props
  const prepared = useMemo(() => prepare(attachment), [attachment])
  const hasMoves = (prepared?.history.length ?? 0) > 0

  const [phase, setPhase] = useState<Phase>('watch')
  const [step, setStep] = useState(0)
  const [replayStep, setReplayStep] = useState(0)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [text, setText] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [attempt, setAttempt] = useState(1)
  const [shown, setShown] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [stepDown, setStepDown] = useState<StepDownResult | null>(null)
  const [draining, setDraining] = useState(false)

  const total = prepared?.history.length ?? 0

  // Reading the line: one move per tick, then the question.
  useEffect(() => {
    if (phase !== 'watch' || prepared === null) return
    if (!hasMoves) {
      const fade = setTimeout(() => {
        setDraining(true)
      }, 30)
      const done = setTimeout(() => {
        setPhase('ask')
      }, timing.flashMs)
      return () => {
        clearTimeout(fade)
        clearTimeout(done)
      }
    }
    const wait = step === 0 ? timing.paceMs / 2 : timing.paceMs
    const timer = setTimeout(() => {
      if (step >= total) setPhase('ask')
      else setStep(step + 1)
    }, wait)
    return () => {
      clearTimeout(timer)
    }
  }, [phase, step, total, hasMoves, prepared, timing.paceMs, timing.flashMs])

  // Peek and anchors hide themselves again.
  useEffect(() => {
    if (overlay === null || overlay.kind === 'replay') return
    const timer = setTimeout(
      () => {
        setOverlay(null)
      },
      overlay.kind === 'peek' ? timing.peekMs : timing.anchorMs,
    )
    return () => {
      clearTimeout(timer)
    }
  }, [overlay, timing.peekMs, timing.anchorMs])

  // Slow replay: ghost view, then the board hides and the question comes back.
  useEffect(() => {
    if (overlay?.kind !== 'replay') return
    const timer = setTimeout(() => {
      if (replayStep >= total) {
        setOverlay(null)
        setOutcome(null)
        setText('')
        setShown(false)
        setAttempt((value) => value + 1)
        setPhase('ask')
      } else {
        setReplayStep(replayStep + 1)
      }
    }, timing.replayMs)
    return () => {
      clearTimeout(timer)
    }
  }, [overlay, replayStep, total, timing.replayMs])

  if (prepared === null) {
    return (
      <div data-slot="viz-run" className="space-y-3">
        <p className="text-sm text-muted-foreground">This exercise could not be set up.</p>
        <Button type="button" onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    )
  }

  const level = attachment.level
  const view = attachment.view
  const orientation = attachment.orientation
  const line = prepared
  const lastIndex = step - 1

  const display: Display = (() => {
    if (overlay?.kind === 'replay') return watchDisplay('ghost', line, replayStep, level)
    if (phase === 'watch') {
      // A position with no moves is shown whole for a moment, whatever the view.
      return hasMoves
        ? watchDisplay(view, line, step, level)
        : watchDisplay(hidesBoard(view) ? 'normal' : view, line, 0, level)
    }
    return askDisplay(view, line, level)
  })()

  const anchors = overlay?.kind === 'anchors' ? anchorSquares(line) : []
  const peekFen = overlay?.kind === 'peek' ? (line.positions[overlay.ply] ?? line.finalFen) : null

  const submit = (answer: Answer) => {
    const correct = checkAnswer(line.key, answer)
    const start = attachment.target?.square
    const slip =
      !correct && attachment.exercise === 'follow-line' && start !== undefined
        ? findSlip({
            fen: attachment.fen,
            moves: attachment.moves,
            start,
            answer: answer.squares?.[0] ?? null,
          })
        : null
    setOutcome({ correct, slip })
    setPhase('result')
    if (attempt === 1 && onAnswered !== undefined) setNote(onAnswered(correct))
  }

  const pick = (square: Square) => {
    const kind = line.question.input
    if (kind === 'square') {
      setText(square)
      return
    }
    const tokens = text.split(/[\s,]+/).filter((token) => token !== '')
    const known = tokens.filter((token) => parseSquareGuess(token) !== null)
    setText(
      (known.includes(square)
        ? known.filter((token) => token !== square)
        : [...known, square]
      ).join(' '),
    )
  }

  const board = (() => {
    if (peekFen !== null) {
      return (
        <Board
          fen={peekFen}
          orientation={orientation}
          movable="none"
          label="Peek: the real position"
          className="rounded-lg"
        />
      )
    }
    if (display.fen === null) {
      const choosing =
        phase === 'ask' &&
        ['square', 'squares', 'route'].includes(line.question.input) &&
        overlay === null
      return (
        <BlankBoard
          orientation={orientation}
          label={choosing ? 'Tap squares to answer' : 'Empty board'}
          lit={anchors}
          selected={
            choosing ? text.split(/[\s,]+/).flatMap((token) => parseSquareGuess(token) ?? []) : []
          }
          {...(choosing ? { onPick: pick } : {})}
        />
      )
    }
    return (
      <Board
        fen={display.fen}
        orientation={orientation}
        movable="none"
        label={display.caption}
        shapes={anchors.length > 0 ? { ...display.shapes, focus: [...anchors] } : display.shapes}
        className="rounded-lg"
      />
    )
  })()

  const spoken =
    phase === 'watch' && hasMoves && lastIndex >= 0
      ? narrateAt(line, lastIndex, narration)
      : overlay?.kind === 'replay' && replayStep > 0
        ? narrateAt(line, replayStep - 1, narration)
        : null

  const showPile = view === 'frozen' && hasMoves && (phase !== 'watch' || step > 0)
  const pile = line.history
    .slice(0, phase === 'watch' ? step : total)
    .map((move, index) => `${moveNumber(line, index)} ${move.san}`)
    .join('  ')

  const tools = outcome !== null && !outcome.correct
  const busy = overlay !== null

  return (
    <div
      data-slot="viz-run"
      data-phase={phase}
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]"
    >
      <div className="mx-auto w-full max-w-md space-y-2">
        {board}
        <p className="text-center text-xs text-muted-foreground">
          {peekFen !== null ? 'Peek: the real position' : display.caption}
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {EXERCISE_NAMES[attachment.exercise]}
          {attempt > 1 ? ` · try ${String(attempt)}` : ''}
        </p>

        {phase === 'watch' ? (
          <div className="space-y-2" data-slot="viz-watch">
            {hasMoves ? (
              <>
                <Progress
                  value={(Math.min(step, total) / total) * 100}
                  aria-label="Line progress"
                />
                <p className="text-xs text-muted-foreground">
                  {step === 0
                    ? 'Get ready'
                    : `Move ${String(Math.min(step, total))} of ${String(total)}`}
                </p>
                <p aria-live="polite" className="min-h-6 text-base font-medium">
                  {spoken ?? ' '}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm">Take a good look. The board will hide.</p>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: draining ? '0%' : '100%',
                      transition: `width ${String(timing.flashMs)}ms linear`,
                    }}
                  />
                </div>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPhase('ask')
              }}
            >
              <SkipForward />
              Skip to the question
            </Button>
          </div>
        ) : null}

        {overlay?.kind === 'replay' ? (
          <p className="text-sm" aria-live="polite">
            Slow replay. Watch the {replayStep > 0 ? spoken : 'first move'}.
          </p>
        ) : null}

        {showPile ? (
          <p
            data-slot="viz-notation"
            className="rounded-md bg-muted px-2 py-1.5 font-mono text-xs leading-relaxed"
          >
            {pile === '' ? 'No moves yet' : pile}
          </p>
        ) : null}

        {phase === 'ask' && overlay === null ? (
          <AnswerPanel
            question={line.question}
            orientation={orientation}
            text={text}
            onText={setText}
            onSubmit={submit}
          />
        ) : null}

        {phase === 'result' && outcome !== null ? (
          <div data-slot="viz-result" className="space-y-3">
            <p
              role="status"
              className={
                outcome.correct
                  ? 'text-sm font-medium text-success'
                  : 'text-sm font-medium text-destructive'
              }
            >
              {outcome.correct ? 'Right. That is the picture.' : 'Not quite.'}
            </p>
            {outcome.slip !== null ? (
              <p data-slot="viz-slip" className="rounded-md bg-muted px-2 py-1.5 text-sm">
                {outcome.slip.explanation}
              </p>
            ) : tools ? (
              <p className="text-sm text-muted-foreground">
                Take another look at where the picture slipped.
              </p>
            ) : null}
            {note === null ? null : <p className="text-xs text-muted-foreground">{note}</p>}

            {tools ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Help with this miss">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setOverlay({ kind: 'peek', ply: (outcome.slip?.ply ?? total - 1) + 1 })
                  }}
                >
                  <Eye />
                  Peek
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || !hasMoves}
                  onClick={() => {
                    setReplayStep(0)
                    setOverlay({ kind: 'replay' })
                  }}
                >
                  <Rewind />
                  Slow replay
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setOverlay({ kind: 'anchors' })
                  }}
                >
                  <Anchor />
                  Anchors
                </Button>
                {onStepDown === undefined ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || stepDown !== null}
                    onClick={() => {
                      setStepDown(onStepDown())
                    }}
                  >
                    <ArrowDownToLine />
                    Step down
                  </Button>
                )}
              </div>
            ) : null}

            {stepDown === null ? null : (
              <div className="space-y-2">
                <p className="text-sm">{stepDown.reason}</p>
                {stepDown.easier !== undefined && onSwap !== undefined ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onSwap(stepDown.easier ?? attachment)
                    }}
                  >
                    Try the easier one
                  </Button>
                ) : null}
              </div>
            )}

            {tools && !shown ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShown(true)
                }}
              >
                Show the answer
              </Button>
            ) : null}
            {tools && shown ? (
              <p data-slot="viz-reveal" className="text-sm">
                The answer: {revealText(line.key)}
              </p>
            ) : null}

            <Button type="button" onClick={onNext}>
              {nextLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function narrateAt(prepared: Prepared, index: number, level: NarrationLevel): string {
  const move = prepared.history[index]
  const before = prepared.positions[index]
  if (move === undefined || before === undefined) return ''
  return `${moveNumber(prepared, index)} ${narrate(move.san, before, level)}`
}
