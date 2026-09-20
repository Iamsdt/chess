import { cn } from '@/design'

import type { ReactNode } from 'react'

/**
 * A choice between two or more options, as native radios.
 *
 * Why radios and not buttons: the prototype draws these as cards, but arrow-key
 * navigation, `aria-checked` and the "one tab stop per group" behaviour all come
 * free with `input[type=radio]` and have to be rebuilt by hand with anything else.
 * The input is visually hidden and the label carries the styling, so the picture
 * matches the prototype and the keyboard matches the platform.
 */

export interface OptionItem<Value extends string> {
  readonly value: Value
  readonly label: string
  readonly hint?: string
  readonly icon?: ReactNode
}

export interface OptionGroupProps<Value extends string> {
  readonly legend: string
  /** Hidden legends still name the group for a screen reader. */
  readonly hideLegend?: boolean
  readonly name: string
  readonly value: Value
  readonly options: readonly OptionItem<Value>[]
  readonly onChange: (value: Value) => void
  readonly layout?: 'row' | 'grid' | 'stack'
  readonly className?: string
}

export function OptionGroup<Value extends string>({
  legend,
  hideLegend = false,
  name,
  value,
  options,
  onChange,
  layout = 'grid',
  className,
}: OptionGroupProps<Value>) {
  return (
    <fieldset className={className}>
      <legend className={cn('text-lg font-bold', hideLegend && 'sr-only')}>{legend}</legend>
      <div
        className={cn(
          'mt-3 gap-2',
          layout === 'row' && 'flex flex-wrap',
          layout === 'grid' && 'grid grid-cols-1 sm:grid-cols-3',
          layout === 'stack' && 'grid grid-cols-1',
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border-2 bg-card p-3 text-left transition-colors',
              'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
              option.value === value
                ? 'border-primary bg-accent/40'
                : 'border-border hover:bg-muted/50',
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value)
              }}
            />
            {option.icon === undefined ? null : (
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground">
                {option.icon}
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{option.label}</span>
              {option.hint === undefined ? null : (
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
