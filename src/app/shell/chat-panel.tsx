import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/design'

import { ChatPlaceholder } from './chat-placeholder'

export interface ChatPanelProps {
  /** True while the panel floats above the page instead of taking its grid column. */
  overlay: boolean
  onClose: () => void
  /** S09 drops its thread and composer in here; the shell keeps the frame so the panel's
   *  open/close behaviour is written once rather than once per feature. */
  children?: ReactNode
}

/** The right column of the prototype — the frame and nothing else. The header, the
 *  "Sage sees:" strip and the note banner belong to whatever fills it: S09's panel when
 *  there is a coach, the placeholder when there is not. Drawing them here too rendered
 *  two stacked headers with contradicting status lines. */
export function ChatPanel({ overlay, onClose, children }: ChatPanelProps) {
  const panelRef = useRef<HTMLElement>(null)

  // Opening the overlay hides the page behind a scrim, so focus has to follow the panel
  // or the next Tab would walk through content the user can no longer see.
  useEffect(() => {
    if (!overlay) return
    panelRef.current?.focus()
  }, [overlay])

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label="Chat with Sage"
      className={cn(
        'flex min-h-0 flex-col bg-card outline-none',
        overlay
          ? 'fixed inset-y-0 right-0 z-60 w-[min(400px,100vw)] shadow-[0_20px_60px_rgba(0,0,0,0.25)]'
          : 'border-l',
      )}
    >
      {children ?? <ChatPlaceholder onClose={onClose} />}
    </aside>
  )
}
