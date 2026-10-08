import { BookmarkPlus, ChevronDown, LayoutGrid } from 'lucide-react'
import { useState } from 'react'

import { Button, cn, toast } from '@/design'
import type { ThinkingAttachment } from '@/domain'

import { SageBoardDialog } from '../sage-board/sage-board-dialog'

import { CoachMarkdown } from './coach-markdown'

/** The Grandmaster card: six numbered steps, each collapsible (coach-agent.md §4). */
export function ThinkingCard({ attachment }: { readonly attachment: ThinkingAttachment }) {
  const [openStep, setOpenStep] = useState<number | null>(0)
  const [boardFor, setBoardFor] = useState<number | null>(null)
  const dialogBoard = boardFor === null ? undefined : attachment.steps[boardFor]?.board

  return (
    <div className="chat-card" data-slot="coach-thinking">
      <ol className="divide-y">
        {attachment.steps.map((step, index) => {
          const open = openStep === index
          const panelId = `gm-step-${String(index)}`
          const isTakeaway = step.step === 'takeaway'
          return (
            <li key={step.step} data-step={step.step}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
                onClick={() => {
                  setOpenStep(open ? null : index)
                }}
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
                  {index + 1}
                </span>
                <span className="flex-1">{step.title}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'size-4 text-muted-foreground transition-transform',
                    open && 'rotate-180',
                  )}
                />
              </button>
              {open ? (
                <div id={panelId} className="space-y-2 px-3 pb-3 text-sm">
                  <CoachMarkdown text={step.text} />
                  <div className="flex flex-wrap gap-1.5">
                    {step.board === undefined ? null : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBoardFor(index)
                        }}
                      >
                        <LayoutGrid />
                        Show on board
                      </Button>
                    )}
                    {isTakeaway ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast.success('Saved to your notes (mock)')
                        }}
                      >
                        <BookmarkPlus />
                        Save to notes
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
      {dialogBoard === undefined ? null : (
        <SageBoardDialog
          attachment={dialogBoard}
          open
          onOpenChange={(next) => {
            if (!next) setBoardFor(null)
          }}
        />
      )}
    </div>
  )
}
