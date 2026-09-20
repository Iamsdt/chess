/** The shell's loading state: the page's shape, before its content arrives. Deliberately
 *  silent — a spinner for a load that usually finishes in a frame reads as a stutter. */
export function RoutePending() {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-9 w-64 animate-pulse rounded bg-muted" />
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  )
}
