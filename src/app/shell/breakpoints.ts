/**
 * S04 · The four widths the prototype's shell CSS switches on, kept as numbers because
 * the layout is decided in JavaScript (as it is in `prototype/assets/shell.js`) rather
 * than by media queries — the sidebar rail depends on the screen's layout as well as on
 * the viewport, which CSS alone cannot express.
 */
export const SHELL_BREAKPOINTS = {
  /** At or below this the sidebar gives way to the bottom bar. */
  mobile: 900,
  /** At or below this a page screen uses the icon rail. */
  compactNav: 1100,
  /** At or below this the chat panel floats over the page instead of taking a column. */
  overlayChat: 1280,
  /** Below this a board screen uses the icon rail, so the board keeps its width. */
  compactBoard: 1600,
} as const

/** Sidebar widths from the prototype grid: `232px | 1fr | 368px`, `76px` when compact. */
export const SHELL_SIZES = {
  sidebar: 232,
  sidebarCompact: 76,
  chatPanel: 368,
} as const
