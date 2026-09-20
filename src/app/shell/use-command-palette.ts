import { useContext } from 'react'

import { CommandPaletteContext, type CommandPaletteValue } from './shell-contexts'

/** Lets a screen open the ⌘K palette from its own header button. */
export function useCommandPalette(): CommandPaletteValue {
  const value = useContext(CommandPaletteContext)
  if (!value) throw new Error('useCommandPalette must be used inside <AppShell>')
  return value
}
