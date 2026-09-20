import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  readStoredBoard,
  readStoredPieceSet,
  readStoredTheme,
  writeStoredBoard,
  writeStoredPieceSet,
  writeStoredTheme,
} from './storage'
import { ThemeContext } from './theme-context'

import type { BoardTheme, PieceSet, ResolvedTheme, ThemeContextValue, ThemeMode } from './types'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function darkMediaQuery(): MediaQueryList | null {
  if (typeof globalThis.matchMedia !== 'function') return null
  try {
    return globalThis.matchMedia(DARK_QUERY)
  } catch {
    // Some embedded webviews reject unknown queries; treat it as "no preference".
    return null
  }
}

export interface ThemeProviderProps {
  children: ReactNode
  /** Used only when nothing is persisted yet. */
  defaultTheme?: ThemeMode
}

/** Owns the `.dark` class and `data-board` attribute on `<html>` and persists them under the
 *  same `ck-*` keys the prototype uses, so a saved look survives the move to React. */
export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme() ?? defaultTheme)
  const [board, setBoardState] = useState<BoardTheme>(readStoredBoard)
  const [pieceSet, setPieceSetState] = useState<PieceSet>(readStoredPieceSet)
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => darkMediaQuery()?.matches ?? false,
  )

  useEffect(() => {
    const query = darkMediaQuery()
    if (!query) return
    const onChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches)
    }
    query.addEventListener('change', onChange)
    return () => {
      query.removeEventListener('change', onChange)
    }
  }, [])

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    const root = document.documentElement
    if (board === 'grove') root.removeAttribute('data-board')
    else root.dataset.board = board
  }, [board])

  const setTheme = useCallback((next: ThemeMode) => {
    writeStoredTheme(next)
    setThemeState(next)
  }, [])

  const setBoard = useCallback((next: BoardTheme) => {
    writeStoredBoard(next)
    setBoardState(next)
  }, [])

  const setPieceSet = useCallback((next: PieceSet) => {
    writeStoredPieceSet(next)
    setPieceSetState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      board,
      setBoard,
      pieceSet,
      setPieceSet,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme, board, setBoard, pieceSet, setPieceSet],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
