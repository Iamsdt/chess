import { useContext } from 'react'

import { ThemeContext } from './theme-context'

import type { ThemeContextValue } from './types'

/** Reads the persisted appearance preferences. Throws outside `<ThemeProvider>` so the
 *  mistake shows up at the first render rather than as a silently wrong theme. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
