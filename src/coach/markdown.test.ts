import { describe, expect, it } from 'vitest'

import { coachMarkdownToPlainText, parseCoachMarkdown } from './markdown'

describe('parseCoachMarkdown', () => {
  it('reads bold, inline san and plain text in one paragraph', () => {
    expect(parseCoachMarkdown('Play `Re1` and **then** push.')).toEqual([
      {
        kind: 'paragraph',
        spans: [
          { kind: 'text', text: 'Play ' },
          { kind: 'san', text: 'Re1' },
          { kind: 'text', text: ' and ' },
          { kind: 'bold', text: 'then' },
          { kind: 'text', text: ' push.' },
        ],
      },
    ])
  })

  it('separates paragraphs on a blank line', () => {
    const blocks = parseCoachMarkdown('First.\n\nSecond.')
    expect(blocks).toHaveLength(2)
    expect(blocks.every((block) => block.kind === 'paragraph')).toBe(true)
  })

  it('reads bullet and numbered lists', () => {
    expect(parseCoachMarkdown('- one\n- two')).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [[{ kind: 'text', text: 'one' }], [{ kind: 'text', text: 'two' }]],
      },
    ])
    const ordered = parseCoachMarkdown('1. one\n2. two')
    expect(ordered[0]).toMatchObject({ kind: 'list', ordered: true })
  })

  it('leaves a half-arrived marker literal, which is what streaming produces', () => {
    expect(parseCoachMarkdown('Look at **the')).toEqual([
      { kind: 'paragraph', spans: [{ kind: 'text', text: 'Look at **the' }] },
    ])
  })

  it('never produces markup for angle brackets, because the text is untrusted', () => {
    const blocks = parseCoachMarkdown('<img src=x onerror=alert(1)>')
    expect(blocks).toEqual([
      { kind: 'paragraph', spans: [{ kind: 'text', text: '<img src=x onerror=alert(1)>' }] },
    ])
  })
})

describe('coachMarkdownToPlainText', () => {
  it('strips the markers so the live region reads prose', () => {
    expect(coachMarkdownToPlainText('**Nudge:** play `Re1`\n\n- look for checks')).toBe(
      'Nudge: play Re1 look for checks',
    )
  })
})
