import { Link } from '@tanstack/react-router'

import {
  Button,
  CtaButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design'
import type { Color, GameResult, GameTermination } from '@/domain'

import type { ReviewQueueState } from '../use-play-game'

export interface GameOverDialogProps {
  readonly open: boolean
  readonly result: GameResult
  readonly termination: GameTermination
  readonly youPlay: Color
  readonly review: ReviewQueueState
  readonly onClose: () => void
}

const TERMINATION_COPY: Readonly<Record<GameTermination, string>> = {
  checkmate: 'by checkmate',
  resignation: 'by resignation',
  timeout: 'on time',
  stalemate: 'by stalemate',
  'insufficient-material': 'with too little material left to mate',
  'threefold-repetition': 'by repetition',
  'fifty-move-rule': 'by the fifty-move rule',
  agreement: 'by agreement',
  abandoned: 'because the game was left',
  'in-progress': '',
  unknown: '',
}

/** Why the headline is a fact and not a verdict: "You lost" is the score, and the
 *  screen that follows is where the game gets turned into something to learn. */
function headline(result: GameResult, youPlay: Color): string {
  if (result === '1/2-1/2') return 'Drawn'
  if (result === '*') return 'Game over'
  const youWon = (result === '1-0') === (youPlay === 'white')
  return youWon ? 'You won' : 'Stockfish won'
}

export function GameOverDialog({
  open,
  result,
  termination,
  youPlay,
  review,
  onClose,
}: GameOverDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{headline(result, youPlay)}</DialogTitle>
          <DialogDescription>
            {`${result} ${TERMINATION_COPY[termination]}`.trim()}
          </DialogDescription>
        </DialogHeader>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {review.status === 'queued'
            ? 'The full review is queued and will run in the background. Your mistakes go to the Mistake Bank when it finishes.'
            : review.status === 'failed'
              ? `${review.message} The game is saved, so you can start the review from your games list.`
              : 'Saving the game…'}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Stay on the board
          </Button>
          <Button variant="outline" asChild>
            <Link to="/games">My games</Link>
          </Button>
          <CtaButton asChild>
            <Link to="/play">New game</Link>
          </CtaButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
