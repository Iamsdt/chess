import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/design/theme'
import { Button } from '@/design/ui/button'
import { SimpleTooltip } from '@/design/ui/tooltip'

export interface ThemeToggleProps {
  className?: string
}

/** The round light/dark button the prototype puts in every page header. Lives in the
 *  design system so its label stays correct — it names the theme it switches *to*. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <SimpleTooltip content={`Switch to ${next} mode`} side="bottom">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        aria-label={`Switch to ${next} mode`}
        {...(className === undefined ? {} : { className })}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="transition-transform duration-300 hover:rotate-45" aria-hidden="true" />
        ) : (
          <Moon className="transition-transform duration-300 hover:-rotate-12" aria-hidden="true" />
        )}
      </Button>
    </SimpleTooltip>
  )
}
