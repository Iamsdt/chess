import { cn } from '@/design/lib/utils'

import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

export interface EmptyStateProps extends Omit<React.ComponentProps<'div'>, 'title' | 'children'> {
  icon: LucideIcon
  title: React.ReactNode
  /** One sentence naming the next move, not an apology. */
  description?: React.ReactNode
  /** Label above the icon, e.g. "When a filter finds nothing". */
  eyebrow?: React.ReactNode
  action?: React.ReactNode
}

/** The dashed placeholder shown wherever a list can legitimately be empty. Centralised
 *  so "nothing here yet" always reads as an invitation and never as an error. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  eyebrow,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn('rounded-xl border border-dashed p-5 text-center', className)}
      {...props}
    >
      {eyebrow !== undefined ? <p className="eyebrow">{eyebrow}</p> : null}
      <span className="mx-auto mt-3 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <p className="mt-2 text-sm font-medium">{title}</p>
      {description !== undefined ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
