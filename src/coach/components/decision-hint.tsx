import { X } from 'lucide-react'
import { useState } from 'react'

const STORAGE_KEY = 'ck-decision-hint-dismissed'

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** A one-line, dismissible pointer to the on-device decision model in Settings. */
export function DecisionHint({ href }: { readonly href: string }) {
  const [hidden, setHidden] = useState(wasDismissed)
  if (hidden) return null
  return (
    <p
      className="flex items-center gap-2 border-b bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground"
      data-slot="coach-decision-hint"
    >
      <a href={href} className="min-w-0 flex-1 truncate font-medium text-primary hover:underline">
        Try the on-device decision model
      </a>
      <button
        type="button"
        aria-label="Dismiss"
        className="rounded p-0.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => {
          try {
            window.localStorage.setItem(STORAGE_KEY, '1')
          } catch {
            // Private windows can refuse storage; the hint just comes back next visit.
          }
          setHidden(true)
        }}
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </p>
  )
}
