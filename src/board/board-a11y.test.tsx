import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'

import { START_FEN, toFen, toSquare } from '@/domain'
import type { Square } from '@/domain'

import { Board } from './board'

import type { LegalMoveMap } from './types'

const sq = (name: string): Square => toSquare(name)

const legalFrom = (entries: Record<string, readonly string[]>): LegalMoveMap =>
  new Map(Object.entries(entries).map(([from, tos]) => [sq(from), tos.map(sq)]))

/** The pointer shims the board's handlers need; jsdom ships none of them. */
beforeAll(() => {
  Element.prototype.setPointerCapture = function setPointerCapture(): void {
    // Capture is meaningless without a real pointer.
  }
  Element.prototype.releasePointerCapture = function releasePointerCapture(): void {
    // See above.
  }
  Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
    return false
  }
})

/** colour-contrast needs real pixels to sample; jsdom has none, so it is judged by eye. */
const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

describe('<Board> accessibility', () => {
  it('has no axe violations as a display board', async () => {
    const { container } = render(
      <Board
        fen={START_FEN}
        label="Italian Game position"
        shapes={{
          highlight: [sq('e2'), sq('e4')],
          focus: [sq('f7')],
          check: sq('e8'),
          arrows: [{ from: sq('g1'), to: sq('f3'), kind: 'best' }],
          marks: [{ square: sq('e4'), quality: 'blunder' }],
        }}
      />,
    )

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  }, 30_000)

  it('has no axe violations as a playable grid', async () => {
    const { container } = render(
      <Board
        fen={START_FEN}
        movable="white"
        legalMoves={legalFrom({ e2: ['e3', 'e4'] })}
        label="Game board"
      />,
    )

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  }, 30_000)

  it('has no axe violations with the promotion picker open', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Board
        fen={toFen('8/4P3/8/8/8/8/8/4K2k w - - 0 1')}
        movable="white"
        legalMoves={legalFrom({ e7: ['e8'] })}
        isPromotion={() => true}
      />,
    )

    await user.click(container.querySelector('[data-square="e7"]')!)
    await user.click(container.querySelector('[data-square="e8"]')!)

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  }, 30_000)

  it('names every square, and every piece standing on one', () => {
    const { container } = render(
      <Board fen={START_FEN} movable="white" legalMoves={legalFrom({})} />,
    )

    const cells = [...container.querySelectorAll('[role="gridcell"]')]
    expect(cells).toHaveLength(64)
    expect(cells.every((cell) => (cell.getAttribute('aria-label') ?? '').length > 0)).toBe(true)
    expect(container.querySelector('[data-square="b8"]')).toHaveAccessibleName('b8, black knight')
  })

  it('carries a polite live region for the moves it reports', () => {
    const { container } = render(<Board fen={START_FEN} />)
    const region = container.querySelector('[role="status"]')

    expect(region).not.toBeNull()
    expect(region).toHaveAttribute('aria-atomic', 'true')
    expect(region).toHaveClass('sr-only')
  })

  it('moves focus onto the square the cursor reaches, so the ring follows the play', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Board fen={START_FEN} movable="white" legalMoves={legalFrom({ a2: ['a3'] })} />,
    )

    await user.tab()
    expect(document.activeElement).toBe(container.querySelector('[data-square="a1"]'))

    await user.keyboard('{ArrowUp}{Enter}')
    expect(document.activeElement).toBe(container.querySelector('[data-square="a2"]'))
    expect(container.querySelector('[data-square="a3"]')).toHaveClass('dot')
  })
})
