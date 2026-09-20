import { ArrowUp, Cpu, EyeOff, LayoutGrid, Square, X } from 'lucide-react'
import { useState } from 'react'

import { Button, cn, Tooltip, TooltipContent, TooltipTrigger } from '@/design'

import type { KeyboardEvent } from 'react'

/**
 * The composer: quick replies, the attachment chip, the two toggles that decide
 * what Sage is allowed to see, and one button that is Send or Stop.
 *
 * The toggles are lifted, not local, because they belong to the `CoachContext`
 * the screen builds — the panel only draws them.
 */

export interface CoachComposerProps {
  readonly onSend: (text: string) => void
  readonly onCancel?: (() => void) | undefined
  /** A reply is streaming: the send button becomes Stop. */
  readonly busy: boolean
  /** No key yet — the composer is visible but inert, as in the prototype. */
  readonly disabled?: boolean | undefined
  readonly quickReplies?: readonly string[] | undefined
  readonly onQuickReply?: ((reply: string) => void) | undefined
  /** e.g. "Current position". Omitted when there is nothing to attach. */
  readonly attachmentLabel?: string | undefined
  readonly onRemoveAttachment?: (() => void) | undefined
  readonly spoilerGuard: boolean
  readonly onSpoilerGuardChange: (next: boolean) => void
  readonly allowEngineLines: boolean
  readonly onAllowEngineLinesChange: (next: boolean) => void
}

interface ToggleProps {
  readonly pressed: boolean
  readonly onPressedChange: (next: boolean) => void
  readonly label: string
  readonly hint: string
  readonly icon: typeof EyeOff
  readonly disabled: boolean
}

function ComposerToggle({
  pressed,
  onPressedChange,
  label,
  hint,
  icon: Icon,
  disabled,
}: ToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={pressed}
          disabled={disabled}
          className={cn(pressed ? 'text-primary' : 'text-muted-foreground')}
          onClick={() => {
            onPressedChange(!pressed)
          }}
        >
          <Icon className="size-3.5" />
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

export function CoachComposer({
  onSend,
  onCancel,
  busy,
  disabled = false,
  quickReplies,
  onQuickReply,
  attachmentLabel,
  onRemoveAttachment,
  spoilerGuard,
  onSpoilerGuardChange,
  allowEngineLines,
  onAllowEngineLinesChange,
}: CoachComposerProps) {
  const [draft, setDraft] = useState('')

  const submit = (): void => {
    const text = draft.trim()
    if (text === '' || disabled) return
    setDraft('')
    onSend(text)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t p-3" data-slot="coach-composer">
      {quickReplies !== undefined && quickReplies.length > 0 && onQuickReply !== undefined ? (
        <div className="mb-2 flex [scrollbar-width:none] gap-1.5 overflow-x-auto">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              className="reply shrink-0 whitespace-nowrap"
              disabled={disabled}
              onClick={() => {
                onQuickReply(reply)
              }}
            >
              {reply}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="rounded-2xl border bg-background focus-within:ring-[3px] focus-within:ring-ring/40"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {attachmentLabel === undefined ? null : (
          <div className="flex items-center gap-1.5 px-3 pt-2.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <LayoutGrid className="size-3" />
              Attached: {attachmentLabel}
              {onRemoveAttachment === undefined ? null : (
                <button
                  type="button"
                  className="ml-0.5 hover:text-foreground"
                  aria-label="Remove attachment"
                  onClick={onRemoveAttachment}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          </div>
        )}

        <textarea
          rows={2}
          value={draft}
          disabled={disabled}
          aria-label="Message Sage"
          placeholder="Message Sage…"
          className="block w-full resize-none bg-transparent px-3 pt-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onKeyDown={onKeyDown}
        />

        <div className="flex items-center gap-0.5 p-1.5">
          <ComposerToggle
            pressed={spoilerGuard}
            onPressedChange={onSpoilerGuardChange}
            label="No spoilers"
            hint="Sage nudges but never reveals a puzzle answer"
            icon={EyeOff}
            disabled={disabled}
          />
          <ComposerToggle
            pressed={allowEngineLines}
            onPressedChange={onAllowEngineLinesChange}
            label="Engine"
            hint="Let Sage read the engine's lines for this position"
            icon={Cpu}
            disabled={disabled}
          />
          {busy ? (
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="ml-auto rounded-full"
              aria-label="Stop"
              onClick={onCancel}
            >
              <Square className="size-3.5" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              className="ml-auto rounded-full"
              aria-label="Send"
              disabled={disabled || draft.trim() === ''}
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Enter to send · your key stays encrypted in this browser
      </p>
    </div>
  )
}
