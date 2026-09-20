import { History } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/design'
import type { ThreadId } from '@/domain'

import { formatMessageTime } from '../time'

import type { CoachThreadSummary } from '../use-coach'

/**
 * The chat history list.
 *
 * Why a menu rather than a second panel: the chat panel is 400px wide and on
 * mobile it is the whole screen; stacking another sheet inside it buries the
 * conversation the user is trying to get back to.
 */

export interface ThreadHistoryProps {
  readonly threads: readonly CoachThreadSummary[]
  readonly currentId: ThreadId
  readonly onOpen: (id: ThreadId) => void
  readonly locale?: string | undefined
}

export function ThreadHistory({ threads, currentId, onOpen, locale }: ThreadHistoryProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Chat history" title="Chat history">
          <History />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Chats</DropdownMenuLabel>
        {threads.map((thread) => (
          <DropdownMenuItem
            key={thread.id}
            aria-current={thread.id === currentId ? 'true' : undefined}
            onSelect={() => {
              onOpen(thread.id)
            }}
          >
            <span className="min-w-0 flex-1 truncate">{thread.title}</span>
            <span className="msg-time shrink-0">{formatMessageTime(thread.updatedAt, locale)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
