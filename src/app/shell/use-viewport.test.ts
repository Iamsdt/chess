import { describe, expect, it } from 'vitest'

import { resolveViewport } from './use-viewport'

describe('resolveViewport', () => {
  it('drops the sidebar for the bottom bar at 900px and below', () => {
    expect(resolveViewport(390, 'page').isMobile).toBe(true)
    expect(resolveViewport(900, 'page').isMobile).toBe(true)
    expect(resolveViewport(901, 'page').isMobile).toBe(false)
  })

  it('uses the icon rail below 1100px on a page screen', () => {
    expect(resolveViewport(1100, 'page').isCompactNav).toBe(true)
    expect(resolveViewport(1101, 'page').isCompactNav).toBe(false)
    expect(resolveViewport(390, 'page').isCompactNav).toBe(false)
  })

  it('uses the icon rail much earlier on a board screen, so the board keeps its width', () => {
    expect(resolveViewport(1440, 'board').isCompactNav).toBe(true)
    expect(resolveViewport(1600, 'board').isCompactNav).toBe(false)
    expect(resolveViewport(1440, 'page').isCompactNav).toBe(false)
  })

  it('overlays the chat panel at 1280px and below', () => {
    expect(resolveViewport(1280, 'page').isOverlayChat).toBe(true)
    expect(resolveViewport(1281, 'page').isOverlayChat).toBe(false)
  })
})
