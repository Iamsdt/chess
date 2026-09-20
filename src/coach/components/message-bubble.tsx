import { Brain, RotateCw, TriangleAlert } from 'lucide-react'

import { Button, cn } from '@/design'
import type { CoachAttachment, CoachMessage } from '@/domain'

import { formatMessageTime } from '../time'

import { AttachmentCard } from './attachment-card'
import { CoachMarkdown } from './coach-markdown'

import type { ReactNode } from 'react'

/**
 * One turn in the thread.
 *
 * The user's own words are rendered as plain text, never through the markdown
 * renderer: what someone typed should come back exactly as they typed it.
 */

export interface MessageBubbleProps {
  readonly message: CoachMessage
  readonly onQuickReply?: ((reply: string) => void) | undefined
  readonly onRetry?: (() => void) | undefined
  readonly renderPreview?: ((attachment: CoachAttachment) => ReactNode) | undefined
  readonly locale?: string | undefined
}

export function MessageBubble({
  message,
  onQuickReply,
  onRetry,
  renderPreview,
  locale,
}: MessageBubbleProps) {
  const time = formatMessageTime(message.createdAt, locale)

  if (message.role === 'user') {
    return (
      <div className="rise flex justify-end" data-slot="coach-message" data-role="user">
        <div className="max-w-[82%] space-y-1.5 text-right">
          <div className="bubble-me">{message.text}</div>
          <div className="msg-time">{time}</div>
        </div>
      </div>
    )
  }

  const failed = message.status === 'error'

  return (
    <div className="rise flex gap-2.5" data-slot="coach-message" data-role={message.role}>
      <div className="sage-av">
        <Brain className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {message.text === '' ? null : (
          <div className="bubble">
            <CoachMarkdown text={message.text} />
          </div>
        )}

        {message.attachments.map((attachment, index) => (
          <AttachmentCard
            key={`${attachment.fen}-${String(index)}`}
            attachment={attachment}
            renderPreview={renderPreview}
          />
        ))}

        {failed ? (
          <div
            className="flex flex-col gap-2 rounded-2xl rounded-tl-md border border-destructive/40 bg-destructive-soft px-3.5 py-2.5 text-sm"
            data-slot="coach-message-error"
          >
            <span className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <span>{message.error ?? 'Sage could not answer that one.'}</span>
            </span>
            {onRetry === undefined ? null : (
              <Button variant="outline" size="sm" className="self-start" onClick={onRetry}>
                <RotateCw className="size-3.5" />
                Try again
              </Button>
            )}
          </div>
        ) : null}

        {message.quickReplies.length > 0 && onQuickReply !== undefined ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {message.quickReplies.map((reply, index) => (
              <button
                key={reply}
                type="button"
                className={cn('reply', index === 0 && 'reply-cta')}
                onClick={() => {
                  onQuickReply(reply)
                }}
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}

        {message.status === 'complete' || failed ? <div className="msg-time">{time}</div> : null}
      </div>
    </div>
  )
}
