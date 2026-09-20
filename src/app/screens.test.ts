import { describe, expect, it } from 'vitest'

import {
  NOT_FOUND_SCREEN,
  SCREENS,
  SCREEN_IDS,
  SCREEN_LIST,
  screenByPath,
  screenPath,
} from './screens'

// Enumerated from disk rather than typed out, so a prototype page added later fails this
// test instead of quietly ending up without a route.
const prototypePages = Object.keys(import.meta.glob('../../prototype/*.html')).map((file) =>
  file.slice(file.lastIndexOf('/') + 1),
)

describe('screen registry', () => {
  it('covers every page in the prototype', () => {
    const ported = new Set(SCREEN_LIST.map((screen) => screen.prototype))
    expect(prototypePages).not.toHaveLength(0)
    for (const page of prototypePages) {
      expect(ported, `prototype/${page} has no route`).toContain(page)
    }
  })

  it('never points two screens at the same prototype page or path', () => {
    const paths = SCREEN_LIST.map((screen) => screen.path)
    expect(new Set(paths).size).toBe(paths.length)

    const pages = SCREEN_LIST.map((screen) => screen.prototype).filter(
      (page): page is string => page !== undefined,
    )
    expect(new Set(pages).size).toBe(pages.length)
  })

  it('keys every entry by its own id', () => {
    for (const id of SCREEN_IDS) expect(SCREENS[id].id).toBe(id)
  })

  it('gives a chat panel to every screen inside the shell', () => {
    for (const screen of SCREEN_LIST) {
      if (screen.frame === 'shell') expect(screen.chat.initial).not.toBe('none')
      else expect(screen.chat.initial).toBe('none')
    }
  })

  it('resolves a path back to its screen, trailing slash or not', () => {
    expect(screenByPath('/')).toBe(SCREENS.today)
    expect(screenByPath('/puzzles/rush')).toBe(SCREENS['puzzle-rush'])
    expect(screenByPath('/puzzles/rush/')).toBe(SCREENS['puzzle-rush'])
    expect(screenByPath('/nope')).toBeUndefined()
  })

  it('exposes each path by id for typed links', () => {
    expect(screenPath('today')).toBe('/')
    expect(screenPath('kitchen-sink')).toBe('/dev/kitchen-sink')
  })

  it('frames a 404 without claiming to be a route', () => {
    expect(SCREEN_LIST.map((screen) => screen.id)).not.toContain(NOT_FOUND_SCREEN.id)
    expect(NOT_FOUND_SCREEN.nav).toBeNull()
  })
})
