import { Check, ChevronDown } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/design'
import { COACH_MODES, type CoachMode } from '@/domain'

import { MODE_INFO } from '../modes'

/** Shows the current mode and lets the user override the screen's choice. */
export function ModeChip({
  mode,
  onChange,
}: {
  readonly mode: CoachMode
  readonly onChange: (mode: CoachMode) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 rounded-md px-2 text-[11px]"
          aria-label={`Mode: ${MODE_INFO[mode].label}. Change mode`}
          data-slot="coach-mode-chip"
        >
          {MODE_INFO[mode].label}
          <ChevronDown aria-hidden="true" className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>How should Sage help?</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => {
            onChange(value as CoachMode)
          }}
        >
          {COACH_MODES.map((item) => (
            <DropdownMenuRadioItem key={item} value={item} className="flex-col items-start gap-0">
              <span className="flex items-center gap-1 font-medium">
                {MODE_INFO[item].label}
                {item === mode ? <Check aria-hidden="true" className="size-3" /> : null}
              </span>
              <span className="text-xs text-muted-foreground">{MODE_INFO[item].blurb}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
