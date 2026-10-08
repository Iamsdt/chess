import { useMemo, useState } from 'react'

import { Badge, Button } from '@/design'
import type { CoachPositionAttachment, SageBoardAttachment } from '@/domain'

import { PositionPreview } from '../components/position-preview'

import { buildFrames } from './frames'
import { SageBoardDialog } from './sage-board-dialog'

const KIND_LABEL: Readonly<Record<SageBoardAttachment['card'], string>> = {
  'what-if': 'What if',
  threat: 'Threat',
  idea: 'Idea',
  line: 'Line',
  compare: 'Compare',
}

const KIND_VARIANT = {
  'what-if': 'lilac',
  threat: 'destructive',
  idea: 'sky',
  line: 'soft',
  compare: 'reward',
} as const

/**
 * The chat side of a Sage board: a still preview and an Open button.
 *
 * Why the card never touches the user's board: everything it shows is built from the
 * attachment's own `fen`, and the dialog it opens plays on a board of its own.
 */
export function SageBoardCard({ attachment }: { readonly attachment: SageBoardAttachment }) {
  const [open, setOpen] = useState(false)

  const preview = useMemo<CoachPositionAttachment>(() => {
    const first = buildFrames(attachment.fen, attachment.steps)[0]
    return {
      kind: 'position',
      fen: first?.game.fen ?? attachment.fen,
      orientation: attachment.orientation,
      highlight: [],
      focus: first?.step.focus ?? [],
      arrows: first?.step.arrows ?? [],
    }
  }, [attachment])

  return (
    <div className="chat-card" data-slot="sage-board-card" data-card={attachment.card}>
      <PositionPreview attachment={preview} />
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant={KIND_VARIANT[attachment.card]}>{KIND_LABEL[attachment.card]}</Badge>
          <span className="truncate text-sm font-medium">{attachment.title}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Open ${attachment.title}`}
          onClick={() => {
            setOpen(true)
          }}
        >
          Open
        </Button>
      </div>
      <SageBoardDialog attachment={attachment} open={open} onOpenChange={setOpen} />
    </div>
  )
}
