import { toMessageId, toThreadId, type MessageId, type ThreadId } from '@/domain'

/**
 * Ids for messages and threads that exist only in this tab.
 *
 * Why a counter rather than `crypto.randomUUID`: a chat id carries no security
 * meaning here, and `randomUUID` is undefined outside a secure context — which
 * is exactly where someone previews the built app over a LAN address. A
 * monotonic counter is unique where it needs to be and cannot be unavailable.
 */

const prefix = Date.now().toString(36)
let counter = 0

function uniqueSuffix(): string {
  counter += 1
  return `${prefix}-${String(counter)}`
}

export function newThreadId(): ThreadId {
  return toThreadId(`thread-${uniqueSuffix()}`)
}

export function newMessageId(): MessageId {
  return toMessageId(`message-${uniqueSuffix()}`)
}
