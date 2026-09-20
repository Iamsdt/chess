import type { ChatPanelState } from './shell-contexts'

/** The prototype's key. Keeping it means a saved panel preference survives the move to
 *  React instead of silently resetting to open. */
const CHAT_STORAGE_KEY = 'ck-chat'

export type StoredChatState = Extract<ChatPanelState, 'open' | 'closed'>

/** Storage throws in private modes and sandboxed frames, so every access is guarded. */
export function readStoredChatState(): StoredChatState | null {
  try {
    const value = localStorage.getItem(CHAT_STORAGE_KEY)
    return value === 'open' || value === 'closed' ? value : null
  } catch {
    return null
  }
}

export function writeStoredChatState(state: StoredChatState): void {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, state)
  } catch {
    // A preference we cannot persist is not worth failing a render over.
  }
}
