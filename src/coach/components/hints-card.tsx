import { Eye, Lightbulb } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/design'
import { CoachPositionAttachmentSchema, type HintsAttachment } from '@/domain'

import { PositionPreview } from './position-preview'

/**
 * Graded hints: one level at a time. The last level is the answer, so it sits behind an
 * explicit "Show the move" with a spoiler warning.
 */
export function HintsCard({ attachment }: { readonly attachment: HintsAttachment }) {
  const [shown, setShown] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const total = attachment.levels.length
  const lastIsAnswer = total > 1
  const nextIsAnswer = lastIsAnswer && shown === total - 1
  const visible = attachment.levels.slice(0, shown)
  const current = visible[visible.length - 1]
  const done = shown >= total

  if (current === undefined) return null

  const preview = CoachPositionAttachmentSchema.parse({
    kind: 'position',
    fen: attachment.fen,
    orientation: attachment.orientation,
    focus: current.focus,
    arrows: current.arrows,
  })

  return (
    <div className="chat-card" data-slot="coach-hints">
      <PositionPreview attachment={preview} />
      <ol className="space-y-2 p-3 text-sm">
        {visible.map((level, index) => (
          <li key={level.label} className="flex gap-2">
            <Lightbulb aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-reward" />
            <span>
              <span className="font-medium">
                Hint {index + 1} · {level.label}:
              </span>{' '}
              {level.text}
            </span>
          </li>
        ))}
      </ol>
      {done ? null : (
        <div className="space-y-2 px-3 pb-3">
          {nextIsAnswer && !confirmed ? (
            <p className="text-xs text-muted-foreground">
              Spoiler: the next level shows the move itself. You will remember it better if you find
              it.
            </p>
          ) : null}
          {nextIsAnswer ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setConfirmed(true)
                setShown(total)
              }}
            >
              <Eye />
              Show the move
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShown((value) => value + 1)
              }}
            >
              Next hint
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
