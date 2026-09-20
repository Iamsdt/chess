import { Link } from '@tanstack/react-router'
import { MessageCircle } from 'lucide-react'

import { cn } from '@/design'

import { BOTTOM_NAV_ITEMS } from '../navigation'
import { screenPath } from '../screens'

import { useChatPanel } from './use-chat-panel'

import type { ShellScreen } from '../screens'

export interface BottomNavProps {
  screen: ShellScreen
}

/** The mobile bar that replaces the sidebar below 900px: four destinations and Sage.
 *  Rendered only on mobile, so it never competes with the sidebar for the nav landmark. */
export function BottomNav({ screen }: BottomNavProps) {
  const chat = useChatPanel()

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur"
    >
      {BOTTOM_NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          to={screenPath(item.screen)}
          className={cn(
            'flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
            screen.nav === item.id ? 'text-primary' : 'text-muted-foreground',
          )}
          {...(screen.nav === item.id ? { 'aria-current': 'page' as const } : {})}
        >
          <item.icon className="size-5" aria-hidden="true" />
          {item.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={chat.toggle}
        disabled={!chat.isAvailable}
        aria-expanded={chat.isOpen}
        className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-cta disabled:opacity-50"
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        Sage
      </button>
    </nav>
  )
}
