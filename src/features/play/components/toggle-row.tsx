import { useId } from 'react'

import { Switch } from '@/design'

import type { LucideIcon } from 'lucide-react'

export interface ToggleRowProps {
  readonly icon: LucideIcon
  readonly label: string
  readonly hint: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}

/**
 * One switch with its explanation.
 *
 * The row is not a `<label>`: the switch is a Radix button, and wrapping a button
 * in a label gives a screen reader two different names for one control. The text
 * names it through `aria-labelledby` instead, which is what the pattern wants.
 */
export function ToggleRow({ icon: Icon, label, hint, checked, onChange }: ToggleRowProps) {
  const labelId = useId()
  const hintId = useId()
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
      <Icon aria-hidden="true" className="size-4 text-primary" />
      <span className="flex-1">
        <span id={labelId} className="block font-medium">
          {label}
        </span>
        <span id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={labelId}
        aria-describedby={hintId}
      />
    </div>
  )
}
