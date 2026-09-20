import { Fragment } from 'react'

import { cn } from '@/design'

import { parseCoachMarkdown, type CoachSpan } from '../markdown'

/**
 * Renders the markdown subset as React elements.
 *
 * Why there is no `dangerouslySetInnerHTML` anywhere in this file: the text came
 * from a model. Building elements means React escapes every character for us and
 * the worst a malicious reply can do is look odd.
 */

function Spans({ spans }: { readonly spans: readonly CoachSpan[] }) {
  return (
    <>
      {spans.map((span, index) => (
        <Fragment key={index}>
          {span.kind === 'bold' ? (
            <b>{span.text}</b>
          ) : span.kind === 'san' ? (
            <span className="san">{span.text}</span>
          ) : (
            span.text
          )}
        </Fragment>
      ))}
    </>
  )
}

export interface CoachMarkdownProps {
  readonly text: string
  readonly className?: string
}

export function CoachMarkdown({ text, className }: CoachMarkdownProps) {
  const blocks = parseCoachMarkdown(text)
  return (
    <div className={cn('space-y-2', className)}>
      {blocks.map((block, index) =>
        block.kind === 'paragraph' ? (
          <p key={index} className="whitespace-pre-line">
            <Spans spans={block.spans} />
          </p>
        ) : block.ordered ? (
          <ol key={index} className="list-decimal space-y-1 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Spans spans={item} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={index} className="list-disc space-y-1 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Spans spans={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}
