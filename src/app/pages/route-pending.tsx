import { Skeleton } from '@/design'

/** The shell's loading state: the page's shape, before its content arrives. Deliberately
 *  silent — a spinner for a load that usually finishes in a frame reads as a stutter. */
export function RoutePending() {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-9 w-64" />
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  )
}
