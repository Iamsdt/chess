import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design'

import { describeGuardWarning } from '../blunder-guard'

import type { GuardWarning } from '../blunder-guard'

export interface GuardDialogProps {
  readonly warning: GuardWarning | null
  readonly onPlayAnyway: () => void
  readonly onChooseAgain: () => void
}

/**
 * The training-wheels warning.
 *
 * The copy names what happens and stops: no "blunder", no exclamation mark, and
 * "Play it anyway" first among equals, because the player is allowed to be right.
 */
export function GuardDialog({ warning, onPlayAnyway, onChooseAgain }: GuardDialogProps) {
  return (
    <Dialog
      open={warning !== null}
      onOpenChange={(open) => {
        if (!open) onChooseAgain()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Have another look</DialogTitle>
          <DialogDescription>
            {warning === null ? '' : describeGuardWarning(warning)}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Training wheels are on, so nothing has been played yet. You can take the move back to the
          board, or go ahead — sometimes giving material up is exactly right.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onPlayAnyway}>
            Play it anyway
          </Button>
          <Button onClick={onChooseAgain}>Choose another move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
