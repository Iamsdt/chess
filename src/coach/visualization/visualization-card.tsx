import { ScanEye } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/design'
import type { VisualizationAttachment } from '@/domain'

import { EXERCISE_NAMES, VIEW_NAMES } from './names'
import { VisualizationDialog } from './visualization-dialog'

/** The chat card for a visualization exercise: what it is, how hard, and a way in. */
export function VisualizationCard({
  attachment,
}: {
  readonly attachment: VisualizationAttachment
}) {
  const [open, setOpen] = useState(false)
  // The ladder is the Visualization coach's real lesson; one card is only its first rung.
  const [ladderOpen, setLadderOpen] = useState(false)
  return (
    <div className="chat-card" data-slot="coach-visualization">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-lilac text-lilac-ink"
        >
          <ScanEye className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{attachment.title}</p>
          <p className="text-xs text-muted-foreground">
            {EXERCISE_NAMES[attachment.exercise]} · Level {String(attachment.level)} ·{' '}
            {VIEW_NAMES[attachment.view]}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Run the five-exercise ladder"
          onClick={() => {
            setLadderOpen(true)
          }}
        >
          Ladder
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setOpen(true)
          }}
        >
          Start
        </Button>
      </div>
      <VisualizationDialog attachment={attachment} open={open} onOpenChange={setOpen} />
      <VisualizationDialog mode="ladder" open={ladderOpen} onOpenChange={setLadderOpen} />
    </div>
  )
}
