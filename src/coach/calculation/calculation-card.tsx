import { GitBranch } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button, cn } from '@/design'
import type { CalculationAttachment } from '@/domain'

import { CalculationDialog, type CalculationMode } from './calculation-dialog'
import { TAG_STYLE } from './tag-style'
import { formatEval, summariseCandidates } from './tree-model'

/**
 * The chat card for a calculation tree: the candidates at a glance, and two ways in.
 * The tree itself only ever opens in its own dialog.
 */
export function CalculationCard({ attachment }: { readonly attachment: CalculationAttachment }) {
  const [mode, setMode] = useState<CalculationMode | null>(null)
  const side = attachment.fen.split(' ')[1] === 'b' ? 'black' : 'white'
  const candidates = useMemo(() => summariseCandidates(attachment, side), [attachment, side])

  return (
    <div data-slot="calc-card" className="chat-card flex flex-col gap-2.5 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <GitBranch className="size-4 text-primary" aria-hidden="true" />
        {attachment.title}
      </p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Candidate moves">
        {candidates.map((row) => (
          <li
            key={row.node.id}
            data-tag={row.node.tag}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
              TAG_STYLE[row.node.tag].chip,
            )}
          >
            <span className="font-medium">{row.node.san}</span>
            <span className="text-muted-foreground tabular-nums">{formatEval(row.finalEval)}</span>
            <span className="sr-only">{TAG_STYLE[row.node.tag].label}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            setMode('explore')
          }}
        >
          Open full screen
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setMode('test')
          }}
        >
          Test me
        </Button>
      </div>
      <CalculationDialog
        attachment={attachment}
        open={mode !== null}
        initialMode={mode ?? 'explore'}
        onOpenChange={(open) => {
          if (!open) setMode(null)
        }}
      />
    </div>
  )
}
