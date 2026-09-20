/** Theme preference. `system` is stored as the absence of a key so the
 *  index.html boot script and the prototype both keep working. */
export type ThemeMode = 'light' | 'dark' | 'system'

/** The resolved appearance actually applied to `<html>`. */
export type ResolvedTheme = 'light' | 'dark'

/** Board palettes from `[data-board]` in globals.css. `grove` is the unset default. */
export type BoardTheme = 'grove' | 'walnut' | 'slate' | 'dusk' | 'sand'

/** Piece artwork folders under `public/pieces/`. Consumed by S08's `<Board>`. */
export type PieceSet = 'california' | 'staunty' | 'maestro' | 'alpha'

export const THEME_MODES = ['light', 'dark', 'system'] as const satisfies readonly ThemeMode[]
export const BOARD_THEMES = [
  'grove',
  'walnut',
  'slate',
  'dusk',
  'sand',
] as const satisfies readonly BoardTheme[]
export const PIECE_SETS = [
  'california',
  'staunty',
  'maestro',
  'alpha',
] as const satisfies readonly PieceSet[]

/** Keys shared with the prototype — changing them would orphan a user's saved look. */
export const STORAGE_KEYS = {
  theme: 'ck-theme',
  board: 'ck-board',
  pieceSet: 'ck-set',
} as const

export interface ThemeContextValue {
  /** What the user chose, including `system`. */
  theme: ThemeMode
  /** What `system` currently resolves to; always `light` or `dark`. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeMode) => void
  /** Flips between light and dark, resolving `system` first. */
  toggleTheme: () => void
  board: BoardTheme
  setBoard: (board: BoardTheme) => void
  pieceSet: PieceSet
  setPieceSet: (pieceSet: PieceSet) => void
}
