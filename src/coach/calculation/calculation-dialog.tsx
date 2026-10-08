import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/design'
import type { CalculationAttachment } from '@/domain'

import { ExplorePanel } from './explore-panel'
import { TestMe } from './test-me'
import { useTestSession } from './use-test-session'

export type CalculationMode = 'explore' | 'test'

export interface CalculationDialogProps {
  readonly attachment: CalculationAttachment
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly initialMode?: CalculationMode
}

/**
 * The full-screen calculation tree. Sage's board lives only in here; it never changes
 * the board the user is playing or analysing on.
 */
export function CalculationDialog({
  attachment,
  open,
  onOpenChange,
  initialMode = 'explore',
}: CalculationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <DialogBody attachment={attachment} initialMode={initialMode} /> : null}
    </Dialog>
  )
}

function DialogBody({
  attachment,
  initialMode,
}: {
  readonly attachment: CalculationAttachment
  readonly initialMode: CalculationMode
}) {
  const [mode, setMode] = useState<CalculationMode>(initialMode)
  const session = useTestSession()
  return (
    <DialogContent
      data-slot="calc-dialog"
      className="top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 content-start gap-3 overflow-y-auto rounded-none border-0 p-3 sm:max-w-none sm:p-6"
    >
      <Tabs
        value={mode}
        onValueChange={(value) => {
          setMode(value === 'test' ? 'test' : 'explore')
        }}
        className="gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
          <div className="min-w-0">
            <DialogTitle className="truncate">{attachment.title}</DialogTitle>
            <DialogDescription className="text-xs">
              Sage's own board. Your game and analysis boards are not touched.
            </DialogDescription>
          </div>
          <TabsList aria-label="Calculation mode">
            <TabsTrigger value="explore">Explore</TabsTrigger>
            <TabsTrigger value="test">Test me</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="explore">
          <ExplorePanel
            attachment={attachment}
            active={mode === 'explore'}
            onTestMe={() => {
              setMode('test')
            }}
          />
        </TabsContent>
        <TabsContent value="test">
          <TestMe attachment={attachment} session={session} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  )
}
