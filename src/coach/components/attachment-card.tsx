import type { CoachAttachment } from '@/domain'

import { CoachMarkdown } from './coach-markdown'
import { PositionPreview } from './position-preview'

import type { ReactNode } from 'react'

/**
 * The prototype's `chat-card`: a position under the text, with one line saying
 * what to look at and one link to go and look at it properly.
 */

export interface AttachmentCardProps {
  readonly attachment: CoachAttachment
  /** Replaces the static preview — how S08's real board gets in here later. */
  readonly renderPreview?: ((attachment: CoachAttachment) => ReactNode) | undefined
  readonly linkLabel?: string | undefined
}

export function AttachmentCard({ attachment, renderPreview, linkLabel }: AttachmentCardProps) {
  const preview = renderPreview?.(attachment) ?? <PositionPreview attachment={attachment} />
  const hasFooter = attachment.caption !== undefined || attachment.href !== undefined

  return (
    <div className="chat-card" data-slot="coach-attachment">
      {preview}
      {hasFooter ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
          {attachment.caption === undefined ? (
            <span />
          ) : (
            <CoachMarkdown text={attachment.caption} className="min-w-0 space-y-0" />
          )}
          {attachment.href === undefined ? null : (
            <a href={attachment.href} className="shrink-0 font-medium text-primary hover:underline">
              {linkLabel ?? 'Open board'}
            </a>
          )}
        </div>
      ) : null}
    </div>
  )
}
