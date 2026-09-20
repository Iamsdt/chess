'use client'

import { Progress as ProgressPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/design/lib/utils'

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${String(100 - (value ?? 0))}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
