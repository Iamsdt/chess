import { SHELL_BREAKPOINTS } from './breakpoints'
import { readStoredChatState } from './chat-storage'

import type { ChatScreen } from '../screens'
import type { ChatPanelState } from './shell-contexts'

/**
 * The prototype's boot rule, kept verbatim: a narrow viewport always starts closed, a
 * screen that asks to start closed (timed modes, live games) is obeyed, and only then
 * does the user's saved preference decide.
 */
export function initialChatState(chat: ChatScreen, width: number): ChatPanelState {
  if (chat.initial === 'none') return 'none'
  if (width <= SHELL_BREAKPOINTS.overlayChat) return 'closed'
  if (chat.initial === 'closed') return 'closed'
  return readStoredChatState() ?? 'open'
}

/** The panel preference is only worth remembering from widths where the panel is docked;
 *  closing the mobile overlay must not mean the desktop panel stays shut forever. */
export function shouldPersistChatState(width: number): boolean {
  return width > SHELL_BREAKPOINTS.overlayChat
}
