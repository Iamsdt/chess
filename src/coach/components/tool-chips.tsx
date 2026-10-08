import { Check, ChevronDown, Loader2, TriangleAlert, Wrench } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/design'
import type { CoachToolAttachment } from '@/domain'

/**
 * The tools Sage called, shown as small chips so "the engine said +0.8" is visibly the
 * engine's number. Several in a row collapse into one disclosure to keep bubbles short.
 */

const STATUS_ICON = {
  done: Check,
  running: Loader2,
  failed: TriangleAlert,
} as const

function ToolChip({ tool }: { readonly tool: CoachToolAttachment }) {
  const Icon = STATUS_ICON[tool.status]
  return (
    <span
      data-slot="coach-tool-chip"
      data-status={tool.status}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground',
        tool.status === 'failed' && 'text-destructive',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'size-3 shrink-0',
          tool.status === 'running' && 'animate-spin motion-reduce:animate-none',
        )}
      />
      <span className="truncate">
        <span className="font-medium">{tool.name}</span> · {tool.summary}
      </span>
    </span>
  )
}

export function ToolChips({ tools }: { readonly tools: readonly CoachToolAttachment[] }) {
  const [open, setOpen] = useState(false)
  if (tools.length === 0) return null

  if (tools.length === 1 && tools[0] !== undefined) {
    return (
      <div data-slot="coach-tools">
        <ToolChip tool={tools[0]} />
      </div>
    )
  }

  return (
    <div data-slot="coach-tools" className="space-y-1">
      <button
        type="button"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        <Wrench aria-hidden="true" className="size-3" />
        {tools.length} tools used
        <ChevronDown
          aria-hidden="true"
          className={cn('size-3 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <ul className="flex flex-col items-start gap-1">
          {tools.map((tool, index) => (
            <li key={`${tool.name}-${String(index)}`} className="max-w-full">
              <ToolChip tool={tool} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
