import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/design/lib/utils'

import type * as React from 'react'

const spinnerVariants = cva('shrink-0 animate-spin', {
  variants: {
    size: {
      xs: 'size-3.5',
      sm: 'size-4',
      default: 'size-5',
      lg: 'size-6',
      xl: 'size-8',
    },
    tone: {
      default: 'text-primary',
      cta: 'text-cta',
      muted: 'text-muted-foreground',
      current: 'text-current',
      white: 'text-white',
      destructive: 'text-destructive',
      reward: 'text-reward',
    },
  },
  defaultVariants: {
    size: 'default',
    tone: 'default',
  },
})

export interface SpinnerProps
  extends React.ComponentProps<'svg'>, VariantProps<typeof spinnerVariants> {
  readonly label?: string
}

/** Accessible, lightweight SVG loader with smooth spinning animation. */
export function Spinner({ size, tone, className, label = 'Loading...', ...props }: SpinnerProps) {
  return (
    <svg
      data-slot="spinner"
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
      className={cn(spinnerVariants({ size, tone }), className)}
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
