/**
 * The markdown subset Sage is allowed to speak: bold, lists and inline SAN.
 *
 * Why we parse it ourselves instead of taking a markdown dependency: model
 * output is untrusted text, and a general parser that emits HTML is an XSS
 * surface we would then have to sanitise. This one emits *data* — spans and
 * blocks — which the renderer turns into React elements, so nothing can escape
 * into markup. Anything outside the subset stays literal, which also means a
 * half-arrived `**` mid-stream reads as two asterisks rather than swallowing
 * the rest of the answer.
 */

export type CoachSpan =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'bold'; readonly text: string }
  /** A move in algebraic notation, set in the prototype's `.san` chip. */
  | { readonly kind: 'san'; readonly text: string }

export type CoachBlock =
  | { readonly kind: 'paragraph'; readonly spans: readonly CoachSpan[] }
  | {
      readonly kind: 'list'
      readonly ordered: boolean
      readonly items: readonly (readonly CoachSpan[])[]
    }

/** `**bold**` or `` `san` ``. Both are non-greedy and never span a line. */
const INLINE_PATTERN = /\*\*([^\n]+?)\*\*|`([^`\n]+?)`/g
const BULLET_PATTERN = /^\s*[-*]\s+(.*)$/
const ORDERED_PATTERN = /^\s*\d+[.)]\s+(.*)$/

function parseSpans(line: string): readonly CoachSpan[] {
  const spans: CoachSpan[] = []
  let cursor = 0
  INLINE_PATTERN.lastIndex = 0

  for (let match = INLINE_PATTERN.exec(line); match !== null; match = INLINE_PATTERN.exec(line)) {
    if (match.index > cursor) {
      spans.push({ kind: 'text', text: line.slice(cursor, match.index) })
    }
    const bold = match[1]
    const san = match[2]
    if (bold !== undefined) spans.push({ kind: 'bold', text: bold })
    else if (san !== undefined) spans.push({ kind: 'san', text: san })
    cursor = match.index + match[0].length
  }

  if (cursor < line.length) spans.push({ kind: 'text', text: line.slice(cursor) })
  return spans
}

/** Turn a (possibly still-streaming) reply into blocks the renderer can draw. */
export function parseCoachMarkdown(text: string): readonly CoachBlock[] {
  const blocks: CoachBlock[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let listOrdered = false

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return
    blocks.push({ kind: 'paragraph', spans: parseSpans(paragraph.join('\n')) })
    paragraph = []
  }
  const flushList = (): void => {
    if (listItems.length === 0) return
    blocks.push({
      kind: 'list',
      ordered: listOrdered,
      items: listItems.map((item) => parseSpans(item)),
    })
    listItems = []
  }

  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      flushParagraph()
      flushList()
      continue
    }

    const bullet = BULLET_PATTERN.exec(line)
    const ordered = bullet === null ? ORDERED_PATTERN.exec(line) : null
    const item = bullet?.[1] ?? ordered?.[1]

    if (item === undefined) {
      flushList()
      paragraph.push(line)
      continue
    }

    const isOrdered = ordered !== null
    if (listItems.length > 0 && isOrdered !== listOrdered) flushList()
    flushParagraph()
    listOrdered = isOrdered
    listItems.push(item)
  }

  flushParagraph()
  flushList()
  return blocks
}

/** Why exported: the live region announces plain text, never markup or markers. */
export function coachMarkdownToPlainText(text: string): string {
  const lines = parseCoachMarkdown(text).flatMap((block) =>
    block.kind === 'paragraph'
      ? [block.spans.map((span) => span.text).join('')]
      : block.items.map((item) => item.map((span) => span.text).join('')),
  )
  return lines.join(' ').trim()
}
