import { useSyncExternalStore } from 'react'

import { SHELL_BREAKPOINTS } from './breakpoints'

import type { ScreenLayout } from '../screens'

/** Width used before the first client measurement — wide enough that the desktop shell,
 *  not the mobile one, is what renders first in a non-browser environment. */
const FALLBACK_WIDTH = 1440

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
  }
}

function currentWidth(): number {
  return window.innerWidth
}

function fallbackWidth(): number {
  return FALLBACK_WIDTH
}

/** The live viewport width. `useSyncExternalStore` so the first paint already has the
 *  real width instead of a mobile-then-desktop flicker on every mount. */
export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, currentWidth, fallbackWidth)
}

export interface ShellViewport {
  readonly width: number
  /** Sidebar hidden, bottom bar shown. */
  readonly isMobile: boolean
  /** Sidebar reduced to the icon rail. */
  readonly isCompactNav: boolean
  /** Chat panel floats over the page with a scrim instead of taking a grid column. */
  readonly isOverlayChat: boolean
}

/** Resolves the prototype's layout rules for one screen. Board screens collapse the nav
 *  to the rail much earlier, because there the width belongs to the board. */
export function resolveViewport(width: number, layout: ScreenLayout): ShellViewport {
  const isMobile = width <= SHELL_BREAKPOINTS.mobile
  const isCompactNav =
    !isMobile &&
    (layout === 'board'
      ? width < SHELL_BREAKPOINTS.compactBoard
      : width <= SHELL_BREAKPOINTS.compactNav)

  return {
    width,
    isMobile,
    isCompactNav,
    isOverlayChat: width <= SHELL_BREAKPOINTS.overlayChat,
  }
}

export function useShellViewport(layout: ScreenLayout): ShellViewport {
  return resolveViewport(useViewportWidth(), layout)
}
