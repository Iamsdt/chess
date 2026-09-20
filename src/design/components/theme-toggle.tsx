import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/design/theme'
import { Button } from '@/design/ui/button'

export interface ThemeToggleProps {
  className?: string
}

/** The round light/dark button the prototype puts in every page header. Lives in the
 *  design system so its label stays correct — it names the theme it switches *to*. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} mode`}
      {...(className === undefined ? {} : { className })}
    >
      {resolvedTheme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}
