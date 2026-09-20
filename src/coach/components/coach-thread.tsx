import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef } from 'react'

import { cn } from '@/design'
import type { CoachAttachment, CoachMessage, Timestamp } from '@/domain'

import { coachMarkdownToPlainText } from '../markdown'
import { groupMessagesByDay } from '../time'

import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'

import type { CoachStatus } from '../use-coach'
import type { ReactNode, RefObject } from 'react'

/**
 * The scrolling thread: day dividers, bubbles, the typing indicator and the one
 * live region that tells a screen-reader user an answer has arrived.
 */

/**
 * Below this many rows the list is plain DOM.
 *
 * Why not always virtualize: a measured, absolutely-positioned list is a worse
 * experience for the 99% of threads that are twenty messages long — it fights
 * find-in-page and screen-reader linear reading for no gain. Virtualization
 * earns its keep only once a thread is genuinely long.
 */
export const VIRTUALIZE_AFTER_ROWS = 40

type ThreadRow =
  | { readonly kind: 'divider'; readonly key: string; readonly label: string }
  | { readonly kind: 'message'; readonly key: string; readonly message: CoachMessage }

export interface CoachThreadProps {
  readonly messages: readonly CoachMessage[]
  readonly status: CoachStatus
  readonly threadLabel?: string | undefined
  readonly onQuickReply?: ((reply: string) => void) | undefined
  readonly onRetry?: (() => void) | undefined
  readonly renderPreview?: ((attachment: CoachAttachment) => ReactNode) | undefined
  /** Shown while the screen is still working out what Sage can see. */
  readonly loading?: boolean | undefined
  /** Shown when the thread has no messages at all. */
  readonly empty?: ReactNode
  readonly today?: Timestamp | undefined
  readonly locale?: string | undefined
  readonly className?: string
}

function ThreadSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-5" data-slot="coach-thread-skeleton">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex gap-2.5">
          <div className="size-7 shrink-0 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          <div
            className={cn(
              'h-14 animate-pulse rounded-2xl rounded-tl-md bg-muted motion-reduce:animate-none',
              row === 1 ? 'w-2/3' : 'w-5/6',
            )}
          />
        </div>
      ))}
    </div>
  )
}

function DayDivider({ label }: { readonly label: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

/**
 * The windowed branch, kept in its own component.
 *
 * Why separate: `useVirtualizer` opts its component out of the React compiler,
 * and confining that to the rows means the rest of the thread — the live region,
 * the dividers, the typing indicator — still compiles normally.
 */
function VirtualRows({
  rows,
  scrollRef,
  renderRow,
}: {
  readonly rows: readonly ThreadRow[]
  readonly scrollRef: RefObject<HTMLDivElement | null>
  readonly renderRow: (row: ThreadRow) => ReactNode
}) {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 8,
  })

  return (
    <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index]
        if (row === undefined) return null
        return (
          <div
            key={row.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full pb-5"
            style={{ transform: `translateY(${String(item.start)}px)` }}
          >
            {renderRow(row)}
          </div>
        )
      })}
    </div>
  )
}

export function CoachThread({
  messages,
  status,
  threadLabel,
  onQuickReply,
  onRetry,
  renderPreview,
  loading = false,
  empty,
  today,
  locale,
  className,
}: CoachThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const rows = useMemo<readonly ThreadRow[]>(() => {
    const groups = groupMessagesByDay(messages, {
      ...(today === undefined ? {} : { today }),
      ...(locale === undefined ? {} : { locale }),
      ...(threadLabel === undefined ? {} : { firstLabel: threadLabel }),
    })
    return groups.flatMap<ThreadRow>((group) => [
      { kind: 'divider', key: `divider-${group.key}`, label: group.label },
      ...group.messages.map<ThreadRow>((message) => ({
        kind: 'message',
        key: message.id,
        message,
      })),
    ])
  }, [messages, threadLabel, today, locale])

  const virtualized = rows.length > VIRTUALIZE_AFTER_ROWS

  const lastText = messages[messages.length - 1]?.text ?? ''
  useEffect(() => {
    const element = scrollRef.current
    if (element === null) return
    element.scrollTop = element.scrollHeight
  }, [rows.length, lastText])

  /**
   * One announcement per answer, not per token. Streaming a live region token by
   * token makes a screen reader unusable, so it says that Sage is writing, then
   * reads the finished reply once.
   */
  const announcement = useMemo(() => {
    if (status === 'thinking' || status === 'streaming') return 'Sage is writing'
    const last = messages[messages.length - 1]
    if (last?.role !== 'sage') return ''
    if (last.status === 'error') return `Sage could not answer. ${last.error ?? ''}`.trim()
    if (last.status !== 'complete' || last.text === '') return ''
    return `Sage said: ${coachMarkdownToPlainText(last.text)}`
  }, [messages, status])

  const renderRow = (row: ThreadRow): ReactNode =>
    row.kind === 'divider' ? (
      <DayDivider label={row.label} />
    ) : (
      <MessageBubble
        message={row.message}
        onQuickReply={onQuickReply}
        {...(row.message.status === 'error' && onRetry !== undefined ? { onRetry } : {})}
        renderPreview={renderPreview}
        locale={locale}
      />
    )

  const showTyping = status === 'thinking' && !loading

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" data-slot="coach-live-region">
        {announcement}
      </p>
      <div
        ref={scrollRef}
        data-slot="coach-thread"
        className={cn('min-h-0 flex-1 overflow-auto px-4 py-5', className)}
      >
        {loading ? (
          <ThreadSkeleton />
        ) : rows.length === 0 ? (
          empty
        ) : virtualized ? (
          <VirtualRows rows={rows} scrollRef={scrollRef} renderRow={renderRow} />
        ) : (
          <div className="space-y-5">
            {rows.map((row) => (
              <div key={row.key}>{renderRow(row)}</div>
            ))}
          </div>
        )}
        {showTyping ? (
          <div className={cn(rows.length > 0 && 'pt-5')}>
            <TypingIndicator />
          </div>
        ) : null}
      </div>
    </>
  )
}
