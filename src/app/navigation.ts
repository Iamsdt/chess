import {
  BookOpen,
  Leaf,
  Library,
  Microscope,
  Puzzle,
  RotateCcw,
  Settings,
  Sprout,
  Sun,
  Swords,
  Users,
  type LucideIcon,
} from 'lucide-react'

import type { NavId, ScreenId } from './screens'

/** A count or a dot beside a sidebar entry. Static until S15 and S28 supply real numbers;
 *  the prototype shows both shapes, so the shell has to lay both out. */
export type NavBadge = { readonly count: number } | { readonly dot: true }

export interface NavItem {
  readonly id: NavId
  readonly label: string
  readonly icon: LucideIcon
  readonly screen: ScreenId
  /** The letter that follows `g` in the navigation chord. */
  readonly key: string
  readonly badge?: NavBadge
}

export interface NavGroup {
  /** Small heading above the group; the first group has none, as in the prototype. */
  readonly label?: string
  readonly items: readonly NavItem[]
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { id: 'home', label: 'Today', icon: Sun, screen: 'today', key: 'h' },
      { id: 'play', label: 'Play', icon: Swords, screen: 'play-setup', key: 'p' },
      { id: 'puzzles', label: 'Puzzles', icon: Puzzle, screen: 'puzzles', key: 'z' },
      { id: 'learn', label: 'Learn', icon: Sprout, screen: 'learn', key: 'l' },
      {
        id: 'mistakes',
        label: 'Mistakes',
        icon: RotateCcw,
        screen: 'mistakes',
        key: 'm',
        badge: { count: 7 },
      },
    ],
  },
  {
    label: 'Library',
    items: [
      { id: 'games', label: 'My games', icon: Library, screen: 'games', key: 'g' },
      { id: 'analysis', label: 'Analysis', icon: Microscope, screen: 'analysis', key: 'a' },
      { id: 'openings', label: 'Openings', icon: BookOpen, screen: 'openings', key: 'o' },
    ],
  },
  {
    label: 'You',
    items: [
      {
        id: 'friends',
        label: 'Friends',
        icon: Users,
        screen: 'friends',
        key: 'f',
        badge: { dot: true },
      },
      { id: 'progress', label: 'Growth', icon: Leaf, screen: 'progress', key: 'w' },
    ],
  },
]

/** Settings sits in the sidebar footer rather than the groups, as in the prototype. */
export const SETTINGS_NAV_ITEM: NavItem = {
  id: 'settings',
  label: 'Settings',
  icon: Settings,
  screen: 'settings',
  key: 's',
}

export const NAV_ITEMS: readonly NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_NAV_ITEM,
]

/** The four entries the mobile bar shows beside the Sage button. */
export const BOTTOM_NAV_IDS = ['home', 'play', 'puzzles', 'learn'] as const

export const BOTTOM_NAV_ITEMS: readonly NavItem[] = BOTTOM_NAV_IDS.map((id) => {
  const item = NAV_ITEMS.find((candidate) => candidate.id === id)
  if (!item) throw new Error(`Bottom nav references an unknown sidebar entry: ${id}`)
  return item
})

/** `g` followed by one of these letters jumps to a screen. */
export const NAV_CHORDS: ReadonlyMap<string, ScreenId> = new Map(
  NAV_ITEMS.map((item) => [item.key, item.screen]),
)

/** The hint the palette and tooltips print, e.g. `g h`. */
export function chordHint(item: NavItem): string {
  return `g ${item.key}`
}
