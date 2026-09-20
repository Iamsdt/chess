import { Brain, KeyRound, PanelRightClose, Plus, SlidersHorizontal, SquarePen } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button, cn, EmptyState, TooltipProvider } from '@/design'
import { now as nowTimestamp } from '@/domain'
import type { CoachAttachment, CoachContext, Timestamp } from '@/domain'

import { newThreadId } from '../ids'
import { createMockCoach } from '../mock-coach'
import { seedThreadFor, type CoachSeedScreen } from '../seeds'
import { useCoach } from '../use-coach'

import { CoachComposer } from './coach-composer'
import { CoachThread } from './coach-thread'
import { ThreadHistory } from './thread-history'

import type { CoachPort } from '../port'
import type { ReactNode } from 'react'

/**
 * Everything inside the Sage panel.
 *
 * S04 owns the panel's chrome — whether it is a column, an overlay or closed —
 * and mounts this as the contents. This component draws the header, the thread
 * and the composer, and knows nothing about routing or about which provider is
 * answering.
 */

/** The context minus the two switches the composer itself owns. */
export type CoachContextBase = Omit<CoachContext, 'spoilerGuard' | 'allowEngineLines'>

export interface CoachPanelProps {
  /** Defaults to a scripted `MockCoach`; S21 passes its provider port here. */
  readonly port?: CoachPort | undefined
  readonly context: CoachContextBase
  /** Which prototype seed the thread opens with. Changing it starts a new thread. */
  readonly seedScreen?: CoachSeedScreen | undefined
  /** Overrides the seed's "Sage sees:" line. */
  readonly contextSummary?: string | undefined
  /** The prototype's one-off banner under the header. */
  readonly note?: ReactNode
  /** Label for the composer's position chip, e.g. "Current position". */
  readonly attachmentLabel?: string | undefined
  readonly quickReplies?: readonly string[] | undefined
  /** False renders the bring-your-own-key state; the composer stays visible but inert. */
  readonly hasKey?: boolean | undefined
  readonly settingsHref?: string | undefined
  /** Swap the static position preview for S08's board once it exists. */
  readonly renderAttachment?: ((attachment: CoachAttachment) => ReactNode) | undefined
  /** Rendered only when given, because S04 owns whether the panel can be closed. */
  readonly onClose?: (() => void) | undefined
  /** The screen is still working out what Sage can see. */
  readonly loading?: boolean | undefined
  readonly defaultSpoilerGuard?: boolean | undefined
  readonly defaultAllowEngineLines?: boolean | undefined
  readonly now?: (() => Timestamp) | undefined
  readonly locale?: string | undefined
  readonly className?: string
}

function NoKeyNotice({ settingsHref }: { readonly settingsHref: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-4 text-sm" data-slot="coach-no-key">
      <div className="flex items-center gap-2 font-semibold">
        <KeyRound className="size-4 text-cta" />
        Bring your own key
      </div>
      <p className="mt-1.5 text-muted-foreground">
        Sage runs on a key you provide. It is encrypted in this browser and only ever sent to the
        provider you chose.
      </p>
      <Button asChild size="sm" className="mt-3">
        <a href={settingsHref}>
          <Plus />
          Add API key
        </a>
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        Everything else in Chess King works without it.
      </p>
    </div>
  )
}

function CoachPanelContents({
  port,
  context,
  seedScreen,
  contextSummary,
  note,
  attachmentLabel,
  quickReplies,
  hasKey = true,
  settingsHref = '/settings#coach',
  renderAttachment,
  onClose,
  loading = false,
  defaultSpoilerGuard = true,
  defaultAllowEngineLines = false,
  now,
  locale,
  className,
}: CoachPanelProps) {
  const clock = now ?? nowTimestamp
  const [spoilerGuard, setSpoilerGuard] = useState(defaultSpoilerGuard)
  const [allowEngineLines, setAllowEngineLines] = useState(defaultAllowEngineLines)
  const [attachment, setAttachment] = useState(attachmentLabel)

  // The mock is created once so its rotation through the script survives re-renders.
  const fallbackPort = useMemo(() => createMockCoach(), [])
  // Built once per mount; the wrapper below remounts this when the screen changes.
  const [seed] = useState(() =>
    seedScreen === undefined ? undefined : seedThreadFor(seedScreen, newThreadId(), clock()),
  )

  const fullContext = useMemo<CoachContext>(
    () => ({
      ...context,
      spoilerGuard,
      allowEngineLines,
      ...(allowEngineLines ? {} : { engineLines: [] }),
    }),
    [context, spoilerGuard, allowEngineLines],
  )

  const coach = useCoach({
    port: port ?? fallbackPort,
    context: fullContext,
    ...(seed === undefined ? {} : { seed }),
    ...(now === undefined ? {} : { now }),
  })

  const busy = coach.status === 'thinking' || coach.status === 'streaming'
  const summary = contextSummary ?? seed?.contextSummary
  const replies = quickReplies ?? seed?.quickReplies

  const statusLine = !hasKey
    ? 'Needs your API key'
    : busy
      ? 'Writing…'
      : 'Online · answers from your own key'

  return (
    <TooltipProvider delayDuration={300}>
      <section
        aria-label="Chat with Sage"
        data-slot="coach-panel"
        className={cn('flex min-h-0 flex-1 flex-col bg-card', className)}
      >
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <div className="relative grid size-10 place-items-center rounded-2xl bg-primary text-reward">
            <Brain className="size-5" />
            <span
              aria-hidden="true"
              className={cn(
                'absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card',
                hasKey ? 'bg-success' : 'bg-muted-foreground',
              )}
            />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-display text-base font-bold">Sage</div>
            <div className="truncate text-xs text-muted-foreground">{statusLine}</div>
          </div>
          <Button asChild variant="ghost" size="icon-sm" title="Coach settings">
            <a href={settingsHref} aria-label="Coach settings">
              <SlidersHorizontal />
            </a>
          </Button>
          <ThreadHistory
            threads={coach.threads}
            currentId={coach.threadId}
            onOpen={coach.openThread}
            locale={locale}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New chat"
            title="New chat"
            onClick={coach.newThread}
          >
            <SquarePen />
          </Button>
          {onClose === undefined ? null : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close chat"
              title="Close chat"
              onClick={onClose}
            >
              <PanelRightClose />
            </Button>
          )}
        </header>

        {summary === undefined ? null : (
          <p
            className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground"
            data-slot="coach-context-summary"
          >
            <span className="truncate">Sage sees: {summary}</span>
          </p>
        )}

        {note === undefined ? null : (
          <div className="m-3 mb-0 flex gap-2 rounded-xl border border-reward/40 bg-reward-soft px-3 py-2.5 text-xs text-reward-ink">
            {note}
          </div>
        )}

        {hasKey ? (
          <CoachThread
            messages={coach.messages}
            status={coach.status}
            threadLabel={coach.threadLabel}
            onQuickReply={coach.send}
            onRetry={coach.canRetry ? coach.retry : undefined}
            renderPreview={renderAttachment}
            loading={loading}
            locale={locale}
            empty={
              <EmptyState
                icon={Brain}
                title="Ask Sage anything"
                description="Why a move works beats what the move is. Start with a why."
              />
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto px-4 py-5">
            <NoKeyNotice settingsHref={settingsHref} />
          </div>
        )}

        <CoachComposer
          onSend={coach.send}
          onCancel={coach.cancel}
          busy={busy}
          disabled={!hasKey}
          quickReplies={replies}
          onQuickReply={coach.send}
          attachmentLabel={attachment}
          onRemoveAttachment={() => {
            setAttachment(undefined)
          }}
          spoilerGuard={spoilerGuard}
          onSpoilerGuardChange={setSpoilerGuard}
          allowEngineLines={allowEngineLines}
          onAllowEngineLinesChange={setAllowEngineLines}
        />
      </section>
    </TooltipProvider>
  )
}

/**
 * Why the wrapper: the thread is seeded once, at mount. Keying on the screen is
 * what makes "each screen opens its own conversation" true without the hook
 * silently rewriting a thread someone is in the middle of.
 */
export function CoachPanel(props: CoachPanelProps) {
  return <CoachPanelContents key={props.seedScreen ?? 'default'} {...props} />
}
