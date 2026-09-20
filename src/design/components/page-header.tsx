import { cn } from '@/design/lib/utils'

import type * as React from 'react'

export interface PageHeaderProps extends Omit<React.ComponentProps<'header'>, 'title'> {
  /** The small uppercase-ish line above the title: the section this page belongs to. */
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Buttons, badges or a search field, right-aligned on wide screens. */
  actions?: React.ReactNode
}

/** The title block at the top of every screen. One component so the eyebrow/title/
 *  description rhythm and the `h1` stay identical across all 23 pages. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn('flex flex-wrap items-end justify-between gap-4', className)}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow !== undefined ? <p className="label">{eyebrow}</p> : null}
        <h1 className="page-title mt-1">{title}</h1>
        {description !== undefined ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions !== undefined ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
