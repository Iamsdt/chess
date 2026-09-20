import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/design/lib/utils'

import type * as React from 'react'

const ctaButtonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cta font-semibold whitespace-nowrap text-cta-foreground shadow-[0_4px_0_var(--cta-strong)] transition-all outline-none select-none hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-[3px] active:shadow-[0_1px_0_var(--cta-strong)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      size: {
        sm: 'h-9 px-4 text-sm',
        default: 'h-11 px-6 text-[15px]',
        lg: 'h-12 px-7 text-base',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { size: 'default', block: false },
  },
)

export interface CtaButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof ctaButtonVariants> {
  /** Render the styling onto the child (a link, usually) instead of a `<button>`. */
  asChild?: boolean
}

/** The one loud call to action per screen. Separate from `Button` because its raised
 *  clay slab — and the "only one of these is on screen" rule — is a design decision,
 *  not a variant someone should reach for by accident. */
export function CtaButton({ className, size, block, asChild = false, ...props }: CtaButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="cta-button"
      className={cn(ctaButtonVariants({ size, block }), className)}
      {...props}
    />
  )
}

export { ctaButtonVariants }
