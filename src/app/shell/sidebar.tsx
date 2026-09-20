import { Link } from '@tanstack/react-router'
import { Crown, Settings } from 'lucide-react'

import { cn, ThemeToggle } from '@/design'

import { NAV_GROUPS, SETTINGS_NAV_ITEM, chordHint, type NavItem } from '../navigation'
import { screenPath } from '../screens'

import type { ShellScreen } from '../screens'

export interface SidebarProps {
  screen: ShellScreen
  /** Icon rail: labels, group headings and the garden card step aside for the board. */
  compact: boolean
}

function NavBadgeMark({ item, compact }: { item: NavItem; compact: boolean }) {
  if (!item.badge) return null
  if ('dot' in item.badge) {
    return <span className="ml-auto size-2 shrink-0 rounded-full bg-cta" aria-hidden="true" />
  }
  return (
    <span
      className={cn(
        'ml-auto grid size-5 shrink-0 place-items-center rounded-full bg-cta text-[10px] font-bold text-white',
        compact && 'hidden',
      )}
    >
      {item.badge.count}
    </span>
  )
}

/** The prototype's left column: brand, grouped navigation, garden card and profile foot.
 *  `aria-current` follows the screen's nav group, so the solver still highlights Puzzles. */
export function Sidebar({ screen, compact }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col bg-sidebar py-4',
        compact ? 'items-stretch px-3' : 'px-3',
      )}
      aria-label="Sidebar"
    >
      <Link
        to="/"
        className={cn('flex items-center gap-2.5 pb-5', compact ? 'justify-center' : 'px-2')}
        aria-label="Chess King home"
      >
        <span className="grid size-9 -rotate-6 place-items-center rounded-xl bg-primary text-reward shadow-sm">
          <Crown className="size-5" aria-hidden="true" />
        </span>
        <span className={cn('font-display text-lg font-bold tracking-tight', compact && 'sr-only')}>
          Chess King
        </span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-auto" aria-label="Main navigation">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label ?? 'primary'} className="space-y-1">
            {group.label !== undefined && !compact ? (
              <div className="label px-3 pt-4 pb-1">{group.label}</div>
            ) : null}
            {group.label !== undefined && compact && index > 0 ? (
              <div className="mx-auto my-2 h-px w-8 bg-border" aria-hidden="true" />
            ) : null}
            {group.items.map((item) => (
              <Link
                key={item.id}
                to={screenPath(item.screen)}
                className={cn('nav-item relative', compact && 'justify-center px-0')}
                title={`${item.label} · ${chordHint(item)}`}
                {...(screen.nav === item.id ? { 'aria-current': 'page' as const } : {})}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className={cn('truncate', compact && 'sr-only')}>{item.label}</span>
                <NavBadgeMark item={item} compact={compact} />
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* The prototype drops the garden on short viewports so the foot never scrolls. */}
      {compact ? null : (
        <Link
          to="/progress"
          className="card card-hover mt-3 block overflow-hidden p-4 [@media(max-height:760px)]:hidden"
        >
          <div className="flex items-center justify-between">
            <span className="label">Your chess garden</span>
            <span className="badge badge-soft">Lv 4</span>
          </div>
          <svg viewBox="0 0 180 70" className="mt-2 h-14 w-full" aria-hidden="true">
            <path d="M0 62 Q90 54 180 62 L180 70 L0 70Z" fill="var(--accent)" />
            <path
              d="M90 62 C90 48 90 38 91 26"
              stroke="#5f8b6c"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            <path d="M91 40 C80 36 72 30 70 20 C82 20 90 28 91 40Z" fill="#8fb88f" />
            <path d="M91 32 C101 28 110 22 112 12 C100 12 92 20 91 32Z" fill="#6c9d73" />
            <circle cx="91" cy="22" r="5" fill="var(--reward)" />
          </svg>
          <p className="text-sm font-medium">Sapling · 12-day streak</p>
          <p className="text-xs text-muted-foreground">3 more days to bloom · 1 freeze saved</p>
        </Link>
      )}

      <div className={cn('mt-3 flex items-center gap-1', compact && 'flex-col')}>
        <Link
          to="/settings"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1.5 hover:bg-card"
          title="Profile & settings"
        >
          <span className="avatar size-8 bg-primary text-primary-foreground">SK</span>
          <span className={cn('min-w-0 leading-tight', compact && 'sr-only')}>
            <span className="block truncate text-sm font-medium">Shudipto</span>
            <span className="block text-xs text-muted-foreground">Local profile</span>
          </span>
        </Link>
        <Link
          to="/settings"
          className={cn(
            'btn btn-ghost btn-icon btn-sm',
            screen.nav === SETTINGS_NAV_ITEM.id && 'bg-card ring-1 ring-border',
          )}
          title={`Settings · ${chordHint(SETTINGS_NAV_ITEM)}`}
          aria-label="Settings"
        >
          <Settings className="size-4" aria-hidden="true" />
        </Link>
        <ThemeToggle className="size-8 rounded-md border-0 bg-transparent shadow-none hover:bg-accent" />
      </div>
    </aside>
  )
}
