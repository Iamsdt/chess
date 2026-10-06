import { Crown, Laptop } from 'lucide-react'

import { SHELL_BREAKPOINTS } from './breakpoints'
import { useViewportWidth } from './use-viewport'

import type { ReactNode } from 'react'

/** Chess King is built for a board you can actually see, so phones get a polite no. */
export function DesktopOnlyGate({ children }: { readonly children: ReactNode }) {
  const width = useViewportWidth()

  if (width >= SHELL_BREAKPOINTS.tablet) return children

  return (
    <main
      aria-labelledby="desktop-only-title"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 py-10 text-center text-foreground"
    >
      <div className="relative">
        <Crown aria-hidden className="size-16 text-primary" />
        <Laptop
          aria-hidden
          className="absolute -right-5 -bottom-2 size-8 rounded-full bg-background p-1 text-muted-foreground"
        />
      </div>
      <h1 id="desktop-only-title" className="text-2xl font-semibold text-balance">
        Whoa, this king is too big for your pocket
      </h1>
      <p className="max-w-sm text-balance text-muted-foreground">
        Even a pawn needs 64 squares to get anywhere, and your screen is giving it about six. Come
        back on a tablet or a computer and we will give the knights some room to jump.
      </p>
      <p className="text-sm text-muted-foreground">
        Pro tip: rotating your phone does not count. We checked.
      </p>
    </main>
  )
}
