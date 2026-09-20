import { createContext } from 'react'

import type { ThemeContextValue } from './types'

/** Undefined outside a provider so `useTheme` can fail loudly instead of silently defaulting. */
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
