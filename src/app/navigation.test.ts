import { describe, expect, it } from 'vitest'

import {
  BOTTOM_NAV_IDS,
  BOTTOM_NAV_ITEMS,
  NAV_CHORDS,
  NAV_GROUPS,
  NAV_ITEMS,
  SETTINGS_NAV_ITEM,
  chordHint,
} from './navigation'
import { SCREENS } from './screens'

describe('navigation model', () => {
  it('points every entry at a real screen inside the shell', () => {
    for (const item of NAV_ITEMS) {
      const screen = SCREENS[item.screen]
      expect(screen.frame).toBe('shell')
      expect(screen.nav).toBe(item.id)
    }
  })

  it('gives every entry its own chord letter', () => {
    const keys = NAV_ITEMS.map((item) => item.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(NAV_CHORDS.size).toBe(NAV_ITEMS.length)
    expect(NAV_CHORDS.get('h')).toBe('today')
  })

  it('keeps settings out of the groups but inside the chords', () => {
    const grouped = NAV_GROUPS.flatMap((group) => group.items)
    expect(grouped).not.toContain(SETTINGS_NAV_ITEM)
    expect(NAV_ITEMS).toContain(SETTINGS_NAV_ITEM)
    expect(chordHint(SETTINGS_NAV_ITEM)).toBe('g s')
  })

  it('resolves the mobile bar from the sidebar entries', () => {
    expect(BOTTOM_NAV_ITEMS.map((item) => item.id)).toEqual([...BOTTOM_NAV_IDS])
  })
})
