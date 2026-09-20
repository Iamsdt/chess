import { cn } from '@/design'

/**
 * S01 placeholder route. S04 replaces this with the TanStack Router shell —
 * it exists so the scaffold has something real to boot, type-check and smoke-test.
 */
export function App() {
  return (
    <main className="grid min-h-full place-items-center p-6">
      <div
        className={cn(
          'w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground',
          'shadow-[0_1px_2px_rgba(40,30,10,.04)]',
        )}
      >
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Scaffold
        </p>
        <h1 className="mt-2 text-[32px] leading-tight font-bold">Chess King</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The Grove Bloom token contract is loaded. Screens arrive in S04.
        </p>
      </div>
    </main>
  )
}
