import { useNavigate } from '@tanstack/react-router'
import { Brain } from 'lucide-react'
import { useCallback, useRef, type ReactNode } from 'react'

import { cn } from '@/design'

import { screenPath, type ScreenId, type ShellScreen } from '../screens'

import { BottomNav } from './bottom-nav'
import { SHELL_SIZES } from './breakpoints'
import { ChatPanel } from './chat-panel'
import { CommandPalette } from './command-palette'
import { ShellProvider } from './shell-provider'
import { Sidebar } from './sidebar'
import { useChatPanel } from './use-chat-panel'
import { useCommandPalette } from './use-command-palette'
import { useShellShortcuts } from './use-shell-shortcuts'
import { useShellViewport, type ShellViewport } from './use-viewport'

export interface AppShellProps {
  /** Which screen is on show: decides the current nav entry, the rail and Sage's context. */
  screen: ShellScreen
  children: ReactNode
  /** S09's Sage thread and composer. Left out, the shell renders its own placeholder. */
  chat?: ReactNode
}

/** The frame every screen lives in: sidebar or bottom bar, the page, and the Sage panel.
 *  Takes its screen as a prop rather than reading the router, so the 404 and the error
 *  page get the same frame as a matched route. */
export function AppShell({ screen, children, chat }: AppShellProps) {
  const viewport = useShellViewport(screen.layout)

  return (
    <ShellProvider screen={screen} viewport={viewport}>
      <ShellFrame screen={screen} viewport={viewport} chat={chat}>
        {children}
      </ShellFrame>
    </ShellProvider>
  )
}

interface ShellFrameProps extends AppShellProps {
  viewport: ShellViewport
}

function ShellFrame({ screen, viewport, chat, children }: ShellFrameProps) {
  const panel = useChatPanel()
  const palette = useCommandPalette()
  const navigate = useNavigate()
  const fabRef = useRef<HTMLButtonElement>(null)

  const isDocked = panel.isOpen && !viewport.isOverlayChat
  const isOverlayOpen = panel.isOpen && viewport.isOverlayChat

  const closeChat = useCallback(() => {
    panel.close()
    // The FAB takes the panel's place, so focus follows it and the keyboard path holds.
    window.requestAnimationFrame(() => fabRef.current?.focus())
  }, [panel])

  useShellShortcuts({
    onFocusChat: panel.focusComposer,
    onEscape: () => {
      if (!palette.isOpen && isOverlayOpen) closeChat()
    },
    onTogglePalette: palette.toggle,
    onNavigate: (id: ScreenId) => {
      void navigate({ to: screenPath(id) })
    },
  })

  const navWidth = viewport.isCompactNav ? SHELL_SIZES.sidebarCompact : SHELL_SIZES.sidebar
  const gridTemplateColumns = viewport.isMobile
    ? 'minmax(0,1fr)'
    : `${String(navWidth)}px minmax(0,1fr)${isDocked ? ` ${String(SHELL_SIZES.chatPanel)}px` : ''}`

  return (
    <>
      <div className="grid h-dvh" style={{ gridTemplateColumns }}>
        {viewport.isMobile ? null : <Sidebar screen={screen} compact={viewport.isCompactNav} />}
        <main className={cn('relative min-h-0 overflow-auto', viewport.isMobile && 'pb-[76px]')}>
          {children}
        </main>
        {isDocked ? (
          <ChatPanel overlay={false} onClose={closeChat}>
            {chat}
          </ChatPanel>
        ) : null}
      </div>

      {isOverlayOpen ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={closeChat}
            className="fixed inset-0 z-55 bg-black/35"
          />
          <ChatPanel overlay onClose={closeChat}>
            {chat}
          </ChatPanel>
        </>
      ) : null}

      {panel.state === 'closed' ? (
        <button
          ref={fabRef}
          type="button"
          onClick={panel.open}
          aria-expanded={false}
          className={cn(
            'fixed right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary py-2 pr-4 pl-2 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90',
            viewport.isMobile ? 'bottom-[88px]' : 'bottom-6',
          )}
        >
          <span className="grid size-8 place-items-center rounded-full bg-primary-foreground/15 text-reward">
            <Brain className="size-4" aria-hidden="true" />
          </span>
          Ask Sage
        </button>
      ) : null}

      {viewport.isMobile ? <BottomNav screen={screen} /> : null}
      <CommandPalette />
    </>
  )
}
