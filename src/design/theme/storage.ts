import {
  BOARD_THEMES,
  PIECE_SETS,
  STORAGE_KEYS,
  type BoardTheme,
  type PieceSet,
  type ThemeMode,
} from './types'

/** Reads persisted preferences. Storage throws in private mode, so every access is guarded. */
function read(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key)
  } catch {
    // Storage disabled (private mode, blocked cookies) — fall back to defaults.
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage.removeItem(key)
    else globalThis.localStorage.setItem(key, value)
  } catch {
    // Preferences simply do not persist; the session still works.
  }
}

export function readStoredTheme(): ThemeMode | null {
  const value = read(STORAGE_KEYS.theme)
  return value === 'dark' || value === 'light' ? value : null
}

/** Only `dark`/`light` are ever written; `system` clears the key. */
export function writeStoredTheme(theme: ThemeMode): void {
  write(STORAGE_KEYS.theme, theme === 'system' ? null : theme)
}

export function readStoredBoard(): BoardTheme {
  const value = read(STORAGE_KEYS.board)
  return BOARD_THEMES.find((board) => board === value) ?? 'grove'
}

/** `grove` is the unset default, matching the prototype's blank swatch. */
export function writeStoredBoard(board: BoardTheme): void {
  write(STORAGE_KEYS.board, board === 'grove' ? null : board)
}

export function readStoredPieceSet(): PieceSet {
  const value = read(STORAGE_KEYS.pieceSet)
  return PIECE_SETS.find((set) => set === value) ?? 'california'
}

export function writeStoredPieceSet(pieceSet: PieceSet): void {
  write(STORAGE_KEYS.pieceSet, pieceSet)
}
