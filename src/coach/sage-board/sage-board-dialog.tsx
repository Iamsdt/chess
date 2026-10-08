import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Board, useReducedMotion } from '@/board'
import type { BoardHandle, BoardMove, LegalMoveMap } from '@/board'
import { applyMove, legalMoves, type ChessGame } from '@/chess'
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
  useTheme,
} from '@/design'
import type { CoachEval, PieceSet, SageBoardAttachment, Square } from '@/domain'

import { bareSan, formatEval } from './format'
import { buildFrames, shapesFor } from './frames'

/** A calm pace: long enough to read one short caption. */
const STEP_MS = 1500

export interface SageBoardDialogProps {
  readonly attachment: SageBoardAttachment
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

/**
 * Sage's own board, in a dialog.
 *
 * Why the player is mounted only while open: closing throws every bit of state away, so
 * reopening the card always starts from step one, and nothing here can outlive the dialog
 * or reach the board the user is playing on.
 */
export function SageBoardDialog({ attachment, open, onOpenChange }: SageBoardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="sage-board-dialog"
        showCloseButton={false}
        className={cn(
          // Full screen on a phone, a large centred panel from `sm` up.
          'top-0 left-0 h-dvh max-h-dvh max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none p-4',
          'sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[94dvh] sm:max-w-5xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:p-6',
        )}
      >
        {open ? (
          <SageBoardPlayer
            attachment={attachment}
            onClose={() => {
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** The theme provider is optional here: a card rendered in isolation still gets a board. */
function usePieceSet(): PieceSet | undefined {
  try {
    return useTheme().pieceSet
  } catch {
    return undefined
  }
}

type Variant = 'a' | 'b'

interface Feedback {
  readonly key: string
  readonly tone: 'success' | 'error'
  readonly text: string
}

function lastEval(steps: SageBoardAttachment['steps']): CoachEval | undefined {
  return steps.findLast((step) => step.eval !== undefined)?.eval
}

function legalMap(game: ChessGame): LegalMoveMap {
  const map = new Map<Square, Square[]>()
  for (const move of legalMoves(game)) {
    const list = map.get(move.from) ?? []
    list.push(move.to)
    map.set(move.from, list)
  }
  return map
}

function SageBoardPlayer({
  attachment,
  onClose,
}: {
  readonly attachment: SageBoardAttachment
  readonly onClose: () => void
}) {
  const reducedMotion = useReducedMotion()
  const pieceSet = usePieceSet()
  const boardRef = useRef<BoardHandle>(null)

  const [variant, setVariant] = useState<Variant>('a')
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(!reducedMotion)
  /** The user's accepted answers, keyed by line and step. */
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({})
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const versus = attachment.versus
  const steps = variant === 'b' && versus !== undefined ? versus.steps : attachment.steps
  const frames = useMemo(() => buildFrames(attachment.fen, steps), [attachment.fen, steps])
  const last = frames.length - 1
  const safeIndex = Math.min(index, Math.max(last, 0))
  const frame = frames[safeIndex]

  const key = `${variant}:${String(safeIndex)}`
  const yourTurn = frame?.step.yourTurn
  const answer = answers[key]
  const waiting = yourTurn !== undefined && answer === undefined

  // After the user's answer the board shows their move on top of the step's position.
  const game = useMemo(() => {
    if (frame === undefined) return undefined
    if (answer === undefined) return frame.game
    const played = applyMove(frame.game, answer)
    return played.ok ? played.value : frame.game
  }, [frame, answer])

  const isPlaying = playing && !waiting && safeIndex < last

  // Autoplay: one timer per step, cleared on any change so a click never double-advances.
  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setTimeout(() => {
      setIndex(safeIndex + 1)
    }, STEP_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [isPlaying, safeIndex])

  const goto = useCallback((next: number) => {
    setIndex(next)
    setFeedback(null)
  }, [])

  const stepBack = () => {
    setPlaying(false)
    goto(Math.max(0, safeIndex - 1))
  }
  const stepForward = () => {
    setPlaying(false)
    if (!waiting) goto(Math.min(last, safeIndex + 1))
  }
  const replay = () => {
    setAnswers({})
    goto(0)
    setPlaying(!reducedMotion)
  }
  const togglePlay = () => {
    if (safeIndex >= last && !waiting) {
      replay()
      setPlaying(true)
      return
    }
    setPlaying((value) => !value)
  }
  const switchVariant = (next: Variant) => {
    if (next === variant) return
    setVariant(next)
    goto(0)
  }

  const legal = useMemo(
    () => (waiting && game !== undefined ? legalMap(game) : undefined),
    [waiting, game],
  )

  const onMove = (move: BoardMove) => {
    if (frame === undefined || yourTurn === undefined) return
    const played = applyMove(frame.game, move)
    const san = played.ok ? played.value.history.at(-1)?.san : undefined
    if (san !== undefined && yourTurn.accept.some((option) => bareSan(option) === bareSan(san))) {
      setAnswers((previous) => ({ ...previous, [key]: san }))
      setFeedback({ key, tone: 'success', text: yourTurn.praise })
      boardRef.current?.flash('success')
      return
    }
    // The board never applied the move, so "reset" is just the position staying put.
    setFeedback({ key, tone: 'error', text: yourTurn.retry })
    boardRef.current?.flash('error')
    boardRef.current?.shake()
  }

  const isPromotion = useCallback(
    (from: Square, to: Square) =>
      game !== undefined &&
      legalMoves(game).some(
        (move) => move.from === from && move.to === to && move.promotion !== undefined,
      ),
    [game],
  )

  // A document listener rather than a handler on a div: the dialog is modal, so every key
  // press while it is open is meant for it, and a plain div is not an interactive element.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      // The board owns arrows and space while a square has focus.
      if (target?.closest('[role="grid"]') != null) return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        stepForward()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        stepBack()
      } else if (event.key === ' ' && target?.closest('button, a, input') == null) {
        event.preventDefault()
        togglePlay()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  })

  if (frame === undefined || game === undefined) {
    return (
      <div className="grid gap-4">
        <DialogTitle>{attachment.title}</DialogTitle>
        <DialogDescription>Sage could not set this position up.</DialogDescription>
        <Button variant="outline" onClick={onClose}>
          Back to my game
        </Button>
      </div>
    )
  }

  const stepEval = frame.step.eval
  const shapes = shapesFor({ frame, game, next: frames[safeIndex + 1], view: attachment.view })
  const activeFeedback = feedback?.key === key ? feedback : null
  const caption =
    activeFeedback?.text ??
    (yourTurn === undefined
      ? frame.step.caption
      : answer === undefined
        ? yourTurn.prompt
        : yourTurn.praise)
  const tone = activeFeedback?.tone ?? (answer === undefined ? undefined : 'success')

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <DialogTitle>{attachment.title}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Sage's board. Your game stays exactly as it is.
          </DialogDescription>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {versus === undefined ? null : (
        <div role="group" aria-label="Candidate move" className="flex gap-2">
          {(['a', 'b'] as const).map((id) => {
            const lineSteps = id === 'a' ? attachment.steps : versus.steps
            const label =
              id === 'a'
                ? (attachment.steps[0]?.san ?? 'A')
                : (versus.steps[0]?.san ?? versus.title)
            const value = lastEval(lineSteps)
            return (
              <Button
                key={id}
                size="sm"
                variant={variant === id ? 'default' : 'outline'}
                aria-pressed={variant === id}
                onClick={() => {
                  switchVariant(id)
                }}
              >
                {id.toUpperCase()} · {label}
                {value === undefined ? null : (
                  <span className="tabular-nums opacity-80">{formatEval(value)}</span>
                )}
              </Button>
            )
          })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
        <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-20rem))] overflow-hidden rounded-md md:max-w-[min(100%,calc(94dvh-9rem))]">
          <Board
            ref={boardRef}
            fen={game.fen}
            orientation={attachment.orientation}
            movable={waiting ? game.turn : 'none'}
            {...(legal === undefined ? {} : { legalMoves: legal })}
            isPromotion={isPromotion}
            onMove={onMove}
            shapes={shapes}
            {...(pieceSet === undefined ? {} : { pieceSet })}
            label="Sage's board"
          />
        </div>

        <div className="grid content-start gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              Step {safeIndex + 1} of {frames.length}
            </span>
            {stepEval === undefined ? null : (
              <span
                data-slot="sage-board-eval"
                aria-label={`Evaluation ${formatEval(stepEval)}`}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums"
              >
                {formatEval(stepEval)}
              </span>
            )}
          </div>

          <p
            data-slot="sage-board-caption"
            data-tone={tone}
            aria-live="polite"
            className={cn(
              'min-h-12 rounded-md bg-muted px-3 py-2 text-sm',
              tone === 'error' && 'bg-destructive-soft text-destructive',
              tone === 'success' && 'bg-reward-soft text-reward-ink',
              waiting && tone === undefined && 'bg-lilac text-lilac-ink',
            )}
          >
            {caption}
          </p>

          <div className="flex items-center gap-1" role="group" aria-label="Step controls">
            <Button
              size="icon"
              variant="outline"
              aria-label="Previous step"
              disabled={safeIndex === 0}
              onClick={stepBack}
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={waiting}
              onClick={togglePlay}
            >
              {isPlaying ? <Pause /> : <Play />}
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Next step"
              disabled={waiting || safeIndex >= last}
              onClick={stepForward}
            >
              <ChevronRight />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Replay" onClick={replay}>
              <RotateCcw />
            </Button>
          </div>

          <div className="grid gap-2 border-t pt-3">
            <Button variant="outline" onClick={onClose}>
              Back to my game
            </Button>
            <Button variant="outline" asChild>
              <a href="/analysis">Open in analysis board</a>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                toast.success('Saved to your Mistake Bank')
              }}
            >
              Save to Mistake Bank
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
