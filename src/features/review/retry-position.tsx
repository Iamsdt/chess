import { Link } from '@tanstack/react-router'
import { Eye, RotateCcw, Swords } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Board } from '@/board'
import type { BoardMove } from '@/board'
import { applyMove, createGame, type ChessGame } from '@/chess'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useTheme,
} from '@/design'
import {
  emptyBoardShapes,
  toSquare,
  toUci,
  type BoardShapes,
  type Color,
  type MoveRecord,
} from '@/domain'
import { engine as defaultEngine, type Engine } from '@/engine'
import { isPromotionMove, legalMoveMap } from '@/features/puzzles'

import {
  alternativeLoss,
  judgeKnownAttempt,
  retryMessage,
  verdictForLoss,
  type RetryVerdict,
} from './retry'

/** Quick and shallow: the question is "did that lose a lot", not "what is best". */
const CHECK_DEPTH = 12

type Phase =
  | { readonly kind: 'trying'; readonly note?: string | undefined }
  | { readonly kind: 'checking' }
  | { readonly kind: 'done'; readonly verdict: 'best' | 'good' }
  | { readonly kind: 'revealed' }

export interface RetryPositionProps {
  /** The mistake to retry; the board opens on the position before it. */
  readonly move: MoveRecord
  readonly orientation: Color
  readonly open: boolean
  readonly onClose: () => void
  /** Injected so a test can answer from a table. */
  readonly engine?: Pick<Engine, 'evaluate'>
}

/**
 * Replay the position before a mistake and look for the better move.
 *
 * The review already knows the engine's answer, so the engine is only asked about a move
 * the review did not see. A wrong move leaves the board as it was, so the user keeps the
 * position they were thinking about.
 */
export function RetryPosition({
  move,
  orientation,
  open,
  onClose,
  engine = defaultEngine,
}: RetryPositionProps) {
  const { pieceSet, board: boardTheme } = useTheme()
  const start = useMemo(() => {
    const created = createGame(move.fenBefore)
    return created.ok ? created.value : undefined
  }, [move.fenBefore])
  const [game, setGame] = useState<ChessGame | undefined>(start)
  const [phase, setPhase] = useState<Phase>({ kind: 'trying' })
  const pending = useRef<AbortController | undefined>(undefined)

  // A check still running when the dialog closes has nobody left to answer to.
  useEffect(() => () => pending.current?.abort(), [])

  const legalMoves = useMemo(() => (game === undefined ? new Map() : legalMoveMap(game)), [game])
  const shapes: BoardShapes = useMemo(() => {
    if (phase.kind !== 'revealed' || move.bestMove === undefined) return emptyBoardShapes()
    return {
      ...emptyBoardShapes(),
      arrows: [
        {
          from: toSquare(move.bestMove.slice(0, 2)),
          to: toSquare(move.bestMove.slice(2, 4)),
          kind: 'best',
        },
      ],
    }
  }, [phase.kind, move.bestMove])

  if (start === undefined || game === undefined) return null

  function reset(): void {
    pending.current?.abort()
    setGame(start)
    setPhase({ kind: 'trying' })
  }

  function conclude(verdict: RetryVerdict, next: ChessGame): void {
    if (verdict === 'best' || verdict === 'good') {
      setGame(next)
      setPhase({ kind: 'done', verdict })
    } else {
      setPhase({ kind: 'trying', note: retryMessage(verdict, move.bestMoveSan) })
    }
  }

  function attempt(chosen: BoardMove): void {
    if (game === undefined || phase.kind === 'checking') return
    const tried = toUci(`${chosen.from}${chosen.to}${chosen.promotion ?? ''}`)
    const next = applyMove(game, chosen)
    if (!next.ok) return

    const known = judgeKnownAttempt(tried, move)
    if (known !== 'unknown') {
      conclude(known, next.value)
      return
    }

    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setPhase({ kind: 'checking' })
    void engine
      .evaluate(next.value.fen, {
        lane: 'interactive',
        depth: CHECK_DEPTH,
        signal: controller.signal,
      })
      .then((result) => {
        if (controller.signal.aborted) return
        const loss = result.ok ? alternativeLoss(move, result.value.score) : undefined
        if (loss === undefined) {
          setPhase({
            kind: 'trying',
            note: 'The engine could not check that move. Try another, or show the answer.',
          })
          return
        }
        conclude(verdictForLoss(loss), next.value)
      })
  }

  const finished = phase.kind === 'done' || phase.kind === 'revealed'
  const message =
    phase.kind === 'done'
      ? retryMessage(phase.verdict, move.bestMoveSan)
      : phase.kind === 'revealed'
        ? `The engine preferred ${move.bestMoveSan ?? 'another move'}.`
        : phase.kind === 'checking'
          ? 'Checking that move with the engine…'
          : (phase.note ?? `Find a better move than ${move.san}. It is ${orientation}’s turn.`)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Retry this position</DialogTitle>
          <DialogDescription>
            In the game you played {move.san} here. What would you play instead?
          </DialogDescription>
        </DialogHeader>
        <Board
          fen={game.fen}
          orientation={orientation}
          movable={finished || phase.kind === 'checking' ? 'none' : move.color}
          legalMoves={legalMoves}
          isPromotion={(from, to) => isPromotionMove(game, from, to)}
          onMove={attempt}
          shapes={shapes}
          pieceSet={pieceSet}
          boardTheme={boardTheme}
          label="Retry position"
          announcement={message}
        />
        {/* Spoken by the board's own live region via `announcement`, so this one is visual only. */}
        <p className="text-sm" data-testid="retry-message">
          {message}
        </p>
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Start over
            </Button>
            {!finished && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  pending.current?.abort()
                  setPhase({ kind: 'revealed' })
                }}
              >
                <Eye className="size-4" aria-hidden="true" />
                Show the answer
              </Button>
            )}
          </div>
          <Button asChild size="sm">
            <Link to="/play" search={{ fen: move.fenBefore }}>
              <Swords className="size-4" aria-hidden="true" />
              Play on from here
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
