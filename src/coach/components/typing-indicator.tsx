import { Brain } from 'lucide-react'

/**
 * The three bouncing dots while Sage composes.
 *
 * Aria-hidden on purpose: the thread's live region already says "Sage is
 * writing", and a screen reader does not need the decoration as well. The
 * bounce is dropped under `prefers-reduced-motion`.
 */
export function TypingIndicator() {
  return (
    <div aria-hidden="true" className="flex items-center gap-2.5" data-slot="coach-typing">
      <div className="sage-av">
        <Brain className="size-3.5" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-muted px-4 py-3">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:.15s] motion-reduce:animate-none" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:.3s] motion-reduce:animate-none" />
      </div>
    </div>
  )
}
