import { Check, Lock } from 'lucide-react'
import { useState } from 'react'

import { Button, toast } from '@/design'
import type { ActionAttachment } from '@/domain'

/**
 * Something Sage proposes. Nothing happens until Confirm; the mock only toasts, but a card
 * with an `href` shows an Open link afterwards instead of navigating behind the user's back.
 */

const DONE_LABEL: Readonly<Record<ActionAttachment['action'], string>> = {
  'queue-puzzles': 'Queued',
  'add-to-mistake-bank': 'Saved to the Mistake Bank',
  'start-drill': 'Ready',
  'set-plan': 'Plan set',
  'save-note': 'Saved to notes',
  'open-lesson': 'Opened',
  'confirm-spend': 'Started',
}

export function ActionCard({ attachment }: { readonly attachment: ActionAttachment }) {
  const [state, setState] = useState<'proposed' | 'done' | 'dismissed'>('proposed')
  const unavailable = attachment.unavailable !== undefined

  return (
    <div className="chat-card space-y-2 p-3 text-sm" data-slot="coach-action" data-state={state}>
      <div className="font-semibold">{attachment.title}</div>
      {attachment.detail === undefined ? null : (
        <p className="text-muted-foreground">{attachment.detail}</p>
      )}
      {attachment.items.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5">
          {attachment.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {attachment.action === 'confirm-spend' ? (
        <p className="text-xs text-muted-foreground">
          Estimated cost: about $0.04 · uses your own key
        </p>
      ) : null}

      {unavailable ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock aria-hidden="true" className="size-3.5" />
          {attachment.unavailable}
        </p>
      ) : null}

      {state === 'done' ? (
        <p className="flex items-center gap-2 text-xs font-medium text-success">
          <Check aria-hidden="true" className="size-3.5" />
          {DONE_LABEL[attachment.action]}
          {attachment.href === undefined ? null : (
            <a href={attachment.href} className="text-primary hover:underline">
              Open
            </a>
          )}
        </p>
      ) : state === 'dismissed' ? (
        <p className="text-xs text-muted-foreground">Not now. Ask again any time.</p>
      ) : (
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled={unavailable}
            onClick={() => {
              setState('done')
              toast.success(`${DONE_LABEL[attachment.action]} (mock)`)
            }}
          >
            Confirm
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setState('dismissed')
            }}
          >
            Not now
          </Button>
        </div>
      )}
    </div>
  )
}
