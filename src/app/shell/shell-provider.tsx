import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { initialChatState, shouldPersistChatState } from './chat-state'
import { writeStoredChatState, type StoredChatState } from './chat-storage'
import {
  ChatPanelContext,
  CommandPaletteContext,
  type ChatPanelState,
  type ChatPanelValue,
  type CommandPaletteValue,
} from './shell-contexts'

import type { ShellScreen } from '../screens'
import type { ShellViewport } from './use-viewport'

export interface ShellProviderProps {
  screen: ShellScreen
  viewport: ShellViewport
  children: ReactNode
}

/** Owns the two pieces of shell state every screen can reach: the Sage panel and the
 *  command palette. Separate contexts so opening the palette never re-renders the chat. */
export function ShellProvider({ screen, viewport, children }: ShellProviderProps) {
  const { width, isOverlayChat } = viewport
  const isAvailable = screen.chat.initial !== 'none'

  const [state, setState] = useState<ChatPanelState>(() => initialChatState(screen.chat, width))
  const [renderedScreenId, setRenderedScreenId] = useState(screen.id)
  const [focusTicket, setFocusTicket] = useState(0)
  const [isPaletteOpen, setPaletteOpen] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  /** A `/` that arrived before the panel's chunk did, waiting to be honoured. */
  const pendingFocusRef = useRef(false)

  // Every screen declares its own panel state, the way a fresh page load does in the
  // prototype. Re-deriving during render — rather than in an effect — means navigation
  // never paints the previous screen's panel first.
  if (renderedScreenId !== screen.id) {
    setRenderedScreenId(screen.id)
    setState(initialChatState(screen.chat, width))
  }

  const setChat = useCallback(
    (next: StoredChatState) => {
      if (!isAvailable) return
      setState(next)
      if (shouldPersistChatState(width)) writeStoredChatState(next)
    },
    [isAvailable, width],
  )

  const open = useCallback(() => {
    setChat('open')
  }, [setChat])

  const close = useCallback(() => {
    setChat('closed')
  }, [setChat])

  const toggle = useCallback(() => {
    setChat(state === 'open' ? 'closed' : 'open')
  }, [setChat, state])

  const focusComposer = useCallback(() => {
    setChat('open')
    setFocusTicket((ticket) => ticket + 1)
  }, [setChat])

  const registerComposer = useCallback((element: HTMLTextAreaElement | null) => {
    composerRef.current = element
    // `/` can be pressed before the code-split panel has arrived. Honour the request as
    // soon as the composer exists rather than dropping the keystroke.
    if (element && pendingFocusRef.current) {
      pendingFocusRef.current = false
      element.focus()
    }
  }, [])

  // The composer may only have mounted in this commit, so focus after the panel renders.
  useEffect(() => {
    if (focusTicket === 0) return
    const composer = composerRef.current
    if (composer) composer.focus()
    else pendingFocusRef.current = true
  }, [focusTicket])

  const chat = useMemo<ChatPanelValue>(
    () => ({
      state,
      isAvailable,
      isOpen: state === 'open',
      isOverlay: isOverlayChat,
      open,
      close,
      toggle,
      focusComposer,
      registerComposer,
      screen: screen.chat,
    }),
    [
      state,
      isAvailable,
      isOverlayChat,
      open,
      close,
      toggle,
      focusComposer,
      registerComposer,
      screen.chat,
    ],
  )

  const palette = useMemo<CommandPaletteValue>(
    () => ({
      isOpen: isPaletteOpen,
      open: () => {
        setPaletteOpen(true)
      },
      close: () => {
        setPaletteOpen(false)
      },
      toggle: () => {
        setPaletteOpen((current) => !current)
      },
    }),
    [isPaletteOpen],
  )

  return (
    <ChatPanelContext.Provider value={chat}>
      <CommandPaletteContext.Provider value={palette}>{children}</CommandPaletteContext.Provider>
    </ChatPanelContext.Provider>
  )
}
