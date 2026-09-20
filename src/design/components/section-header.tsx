import { cn } from '@/design/lib/utils'

import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

export interface SectionHeaderProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  title: React.ReactNode
  /** Tucked into the primary-coloured tile before the title, like Sage's brain mark. */
  icon?: LucideIcon
  /** Quiet text on the right: counts, freshness, "2 of 3 done". */
  meta?: React.ReactNode
  /** Buttons or links on the right, after `meta`. */
  action?: React.ReactNode
  /** Heading level. Sections inside a page are `h2`; nested groups drop to `h3`. */
  as?: 'h2' | 'h3'
}

/** The `<h2>` row that opens every section on a screen. Exists so the heading id,
 *  the icon tile and the right-hand meta stay consistent for `aria-labelledby`. */
export function SectionHeader({
  title,
  icon: Icon,
  meta,
  action,
  as: Heading = 'h2',
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
      {...props}
    >
      <Heading
        className={cn(
          'flex items-center gap-2 font-display font-bold',
          Heading === 'h2' ? 'text-xl' : 'text-base',
        )}
      >
        {Icon ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-reward">
            <Icon aria-hidden="true" className="size-3.5" />
          </span>
        ) : null}
        {title}
      </Heading>
      {meta !== undefined || action !== undefined ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {meta}
          {action}
        </div>
      ) : null}
    </div>
  )
}
