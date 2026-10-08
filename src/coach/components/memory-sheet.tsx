import { useState } from 'react'

import {
  Button,
  Progress,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/design'

import {
  MEMORY_BUDGET_TOKENS,
  MEMORY_LAYER_DATA,
  MONTHLY_CAP_USD,
  MONTHLY_SPEND_USD,
  formatTokens,
  type MemoryLayerId,
} from '../memory-mock'

/** "What Sage sees": the five memory layers, the budget, and the monthly cost meter (mock). */
export function MemorySheet({
  open,
  onOpenChange,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  const [cleared, setCleared] = useState<ReadonlySet<MemoryLayerId>>(new Set())
  const total = MEMORY_LAYER_DATA.reduce(
    (sum, layer) => (cleared.has(layer.id) ? sum : sum + layer.tokens),
    0,
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
        data-slot="coach-memory-sheet"
      >
        <SheetHeader>
          <SheetTitle>What Sage sees</SheetTitle>
          <SheetDescription>
            This is everything sent with your question. Clear a layer and Sage forgets it.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Context budget</span>
              <span>
                {formatTokens(total)} of {formatTokens(MEMORY_BUDGET_TOKENS)} tokens
              </span>
            </div>
            <Progress
              value={(total / MEMORY_BUDGET_TOKENS) * 100}
              aria-label="Context tokens used"
            />
          </div>

          <ul className="space-y-2">
            {MEMORY_LAYER_DATA.map((layer) => {
              const isCleared = cleared.has(layer.id)
              return (
                <li key={layer.id} className="rounded-xl border p-3 text-sm" data-layer={layer.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{layer.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {isCleared ? 0 : layer.tokens} tokens
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{layer.holds}</p>
                  <p className="mt-1.5 text-xs">{isCleared ? 'Cleared.' : layer.sample}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-1"
                    disabled={isCleared}
                    aria-label={`Clear ${layer.label}`}
                    onClick={() => {
                      setCleared((previous) => new Set(previous).add(layer.id))
                    }}
                  >
                    Clear
                  </Button>
                </li>
              )
            })}
          </ul>

          <div data-slot="coach-monthly-meter">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>This month (estimated)</span>
              <span>
                ${MONTHLY_SPEND_USD.toFixed(2)} of ${MONTHLY_CAP_USD.toFixed(2)} cap
              </span>
            </div>
            <Progress
              value={(MONTHLY_SPEND_USD / MONTHLY_CAP_USD) * 100}
              aria-label="Monthly spend"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
