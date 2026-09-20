import { createContext } from 'react'

import type { ChatAvailability, ChatScreen } from '../screens'

/** Mirrors the prototype's `data-chat` attribute: a screen either has an open panel, a
 *  closed one, or none at all. */
export type ChatPanelState = ChatAvailability

export interface ChatPanelValue {
  readonly state: ChatPanelState
  /** False on screens the prototype gives no panel at all (onboarding, dev routes). */
  readonly isAvailable: boolean
  readonly isOpen: boolean
  /** True when the panel floats above the page instead of taking a grid column. */
  readonly isOverlay: boolean
  readonly open: () => void
  readonly close: () => void
  readonly toggle: () => void
  /** Opens the panel and puts the caret in the composer. Bound to `/`. */
  readonly focusComposer: () => void
  /** S09 hands its composer element to the shell so `/` keeps working once the real
   *  chat replaces the placeholder. Pass `null` on unmount. */
  readonly registerComposer: (element: HTMLTextAreaElement | null) => void
  /** What Sage may see on this screen: context line, attachment chip, quick replies. */
  readonly screen: ChatScreen
}

export const ChatPanelContext = createContext<ChatPanelValue | null>(null)

export interface CommandPaletteValue {
  readonly isOpen: boolean
  readonly open: () => void
  readonly close: () => void
  readonly toggle: () => void
}

export const CommandPaletteContext = createContext<CommandPaletteValue | null>(null)
