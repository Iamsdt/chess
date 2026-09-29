import { cn } from '@/design/lib/utils'

import type * as React from 'react'

export interface SkeletonProps extends React.ComponentProps<'div'> {
  /** Optional shimmer effect sweep across the pulse */
  readonly shimmer?: boolean
}

/** Accessible skeleton loading placeholder with pulse or shimmer animation. */
export function Skeleton({ className, shimmer = false, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-muted', shimmer && 'animate-shimmer', className)}
      {...props}
    />
  )
}
