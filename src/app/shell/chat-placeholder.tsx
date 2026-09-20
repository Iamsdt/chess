import { Link } from '@tanstack/react-router'
import {
  ArrowUp,
  Brain,
  Eye,
  Info,
  KeyRound,
  LayoutGrid,
  PanelRightClose,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { toast } from '@/design'

import { useChatPanel } from './use-chat-panel'

export interface ChatPlaceholderProps {
  readonly onClose: () => void
}

/**
 * The panel body for screens with no coach behind them — today just the 404 frame, which
 * renders no `<CoachPanel>`. It carries its own header because the shell frame owns only
 * the column; anywhere S09's panel is mounted, that panel draws the header instead.
 */
export function ChatPlaceholder({ onClose }: ChatPlaceholderProps) {
  const chat = useChatPanel()
  const { registerComposer } = chat
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState('')

  // The shell focuses whichever composer is mounted, so it has to be told about this one.
  useEffect(() => {
    registerComposer(composerRef.current)
    return () => {
      registerComposer(null)
    }
  }, [registerComposer])

  const send = () => {
    if (draft.trim() === '') return
    setDraft('')
    toast.info('Sage needs a coach key', {
      description: 'Add your Gemini, OpenAI or Anthropic key in Settings and she can answer.',
    })
  }

  const { context, note } = chat.screen

  return (
    <>
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <div className="relative grid size-10 place-items-center rounded-2xl bg-primary text-reward">
          <Brain className="size-5" aria-hidden="true" />
          <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card bg-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-base font-bold">Sage</div>
          <div className="truncate text-xs text-muted-foreground">Waiting on a coach key</div>
        </div>
        <Link
          to="/settings"
          hash="coach"
          className="btn btn-ghost btn-icon btn-sm"
          title="Coach settings"
          aria-label="Coach settings"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-icon btn-sm"
          title="Close chat"
          aria-label="Close chat"
        >
          <PanelRightClose className="size-4" aria-hidden="true" />
        </button>
      </header>

      {context === undefined ? null : (
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <Eye className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Sage sees: {context}</span>
        </div>
      )}

      {note === undefined ? null : (
        <div className="m-3 mb-0 flex gap-2 rounded-xl border border-reward/40 bg-reward-soft px-3 py-2.5 text-xs text-reward-ink">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{note}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-5 overflow-auto px-4 py-5" aria-live="polite">
        <div className="rounded-2xl border border-dashed p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-4 text-cta" aria-hidden="true" />
            Bring your own key
          </div>
          <p className="mt-1.5 text-muted-foreground">
            Sage runs on your Gemini, OpenAI or Anthropic key. It is encrypted in this browser and
            only ever sent to the provider.
          </p>
          <Link to="/settings" hash="coach" className="btn btn-default btn-sm mt-3">
            <Plus className="size-4" aria-hidden="true" />
            Add API key
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">
            Everything else in Chess King works without it.
          </p>
        </div>
      </div>

      <div className="border-t p-3">
        {chat.screen.quick.length > 0 ? (
          <div className="mb-2 flex [scrollbar-width:none] gap-1.5 overflow-x-auto">
            {chat.screen.quick.map((question) => (
              <button
                key={question}
                type="button"
                className="reply shrink-0 whitespace-nowrap"
                onClick={() => {
                  setDraft(question)
                  composerRef.current?.focus()
                }}
              >
                {question}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="rounded-2xl border bg-background focus-within:ring-[3px] focus-within:ring-ring/40"
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
        >
          {chat.screen.attach === undefined ? null : (
            <div className="flex items-center gap-1.5 px-3 pt-2.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <LayoutGrid className="size-3" aria-hidden="true" />
                Attached: {chat.screen.attach}
              </span>
            </div>
          )}
          <textarea
            ref={composerRef}
            rows={2}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            className="block w-full resize-none bg-transparent px-3 pt-2 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Message Sage…"
            aria-label="Message Sage"
          />
          <div className="flex items-center gap-0.5 p-1.5">
            <button
              type="submit"
              className="btn btn-default btn-icon btn-sm ml-auto rounded-full"
              aria-label="Send"
            >
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
          </div>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Enter to send · your key stays encrypted in this browser
        </p>
      </div>
    </>
  )
}
