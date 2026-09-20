import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { START_FEN, toFen, toSquare } from '@/domain'
import type { Color, Fen, Square } from '@/domain'

import { Board } from './board'
import { screenColumn, screenRow } from './placement'

import type { BoardHandle, LegalMoveMap } from './types'

const BOARD_PX = 800
const SQUARE_PX = BOARD_PX / 8

/** jsdom has no pointer model at all; these are the smallest shims that give one. */
beforeAll(() => {
  class PointerEventStub extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  globalThis.PointerEvent = PointerEventStub as unknown as typeof PointerEvent

  Element.prototype.setPointerCapture = function setPointerCapture(): void {
    // Capture is meaningless without a real pointer; the handlers only need it not to throw.
  }
  Element.prototype.releasePointerCapture = function releasePointerCapture(): void {
    // See above.
  }
  Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
    return false
  }
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    return new DOMRect(0, 0, BOARD_PX, BOARD_PX)
  }
})

const sq = (name: string): Square => toSquare(name)

const legalFrom = (entries: Record<string, readonly string[]>): LegalMoveMap =>
  new Map(Object.entries(entries).map(([from, tos]) => [sq(from), tos.map(sq)]))

function cell(container: HTMLElement, name: string): HTMLElement {
  const element = container.querySelector(`[data-square="${name}"]`)
  if (!(element instanceof HTMLElement)) throw new Error(`No square ${name} rendered`)
  return element
}

function gridOf(container: HTMLElement): HTMLElement {
  const element = container.querySelector('.vb-grid')
  if (!(element instanceof HTMLElement)) throw new Error('No board grid rendered')
  return element
}

/** The live region's text. `trim()` also removes the alternating no-break space
 *  the board appends to force a repeated verdict to be spoken again. */
function spoken(container: HTMLElement): string {
  return (container.querySelector('[role="status"]')?.textContent ?? '').trim()
}

const pointAt = (name: string, orientation: Color = 'white') => ({
  clientX: (screenColumn(sq(name), orientation) + 0.5) * SQUARE_PX,
  clientY: (screenRow(sq(name), orientation) + 0.5) * SQUARE_PX,
  pointerId: 1,
  pointerType: 'mouse',
  button: 0,
})

/** White pawn on e7, so promotion has somewhere to happen. */
const PROMOTION_FEN: Fen = toFen('8/4P3/8/8/8/8/8/4K2k w - - 0 1')

describe('<Board> rendering', () => {
  it('draws the position it was given', () => {
    const { container } = render(<Board fen={START_FEN} />)

    expect(container.querySelectorAll('[data-square]')).toHaveLength(64)
    expect(cell(container, 'e1').querySelector('[data-piece]')).toHaveAttribute('data-piece', 'wK')
    expect(cell(container, 'e4').querySelector('[data-piece]')).toBeNull()
  })

  it('is an image, not a widget, until it is made movable', () => {
    const { container } = render(<Board fen={START_FEN} label="Puzzle board" />)

    expect(container.querySelector('[role="img"]')).toHaveAccessibleName('Puzzle board')
    expect(container.querySelector('[role="gridcell"]')).toBeNull()
    expect(container.querySelector('.vb')).not.toHaveAttribute('data-interactive')
  })

  it('serves the chosen piece set from the self-hosted folder', () => {
    const { container } = render(<Board fen={START_FEN} pieceSet="alpha" />)

    expect(cell(container, 'a2').querySelector('[data-piece]')).toHaveAttribute(
      'src',
      '/pieces/alpha/wP.svg',
    )
  })

  it('scopes a board palette to itself when asked', () => {
    const { container } = render(<Board fen={START_FEN} boardTheme="walnut" />)

    expect(container.querySelector('.vb')).toHaveAttribute('data-board', 'walnut')
  })

  it('flips with the orientation', () => {
    const { container: white } = render(<Board fen={START_FEN} />)
    expect(white.querySelectorAll('[data-square]')[0]).toHaveAttribute('data-square', 'a8')

    const { container: black } = render(<Board fen={START_FEN} orientation="black" />)
    expect(black.querySelectorAll('[data-square]')[0]).toHaveAttribute('data-square', 'h1')
  })

  it('shows coordinates on the edge files and ranks, and hides them on request', () => {
    const { container, rerender } = render(<Board fen={START_FEN} />)
    expect(cell(container, 'a8').querySelector('.vb-c.r')).toHaveTextContent('8')
    expect(cell(container, 'a1').querySelector('.vb-c.f')).toHaveTextContent('a')

    rerender(<Board fen={START_FEN} coordinates={false} />)
    expect(container.querySelectorAll('.vb-c')).toHaveLength(0)
  })

  it('draws the overlays the caller describes', () => {
    const { container } = render(
      <Board
        fen={START_FEN}
        shapes={{
          highlight: [sq('e2'), sq('e4')],
          focus: [sq('f7')],
          check: sq('e1'),
          arrows: [
            { from: sq('g1'), to: sq('f3'), kind: 'best' },
            { from: sq('d8'), to: sq('h4'), kind: 'threat' },
          ],
          marks: [{ square: sq('e4'), quality: 'blunder' }],
        }}
      />,
    )

    expect(cell(container, 'e2')).toHaveClass('hl')
    expect(cell(container, 'f7')).toHaveClass('fo')
    expect(cell(container, 'e1')).toHaveClass('ck')
    expect(
      [...container.querySelectorAll('.vb-arrow')].map((line) => line.getAttribute('data-kind')),
    ).toEqual(['best', 'threat'])
    expect(cell(container, 'e4').querySelector('[data-quality="blunder"]')).not.toBeNull()
  })

  it('folds a move-quality badge into the square it labels', () => {
    const { container } = render(
      <Board
        fen={START_FEN}
        movable="white"
        shapes={{
          highlight: [],
          focus: [],
          check: null,
          arrows: [],
          marks: [{ square: sq('e2'), quality: 'brilliant' }],
        }}
      />,
    )

    expect(cell(container, 'e2')).toHaveAccessibleName('e2, white pawn, brilliant')
  })
})

describe('<Board> click to move', () => {
  it('selects a movable piece and dots its legal destinations', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Board fen={START_FEN} movable="white" legalMoves={legalFrom({ e2: ['e3', 'e4'] })} />,
    )

    await user.click(cell(container, 'e2'))

    expect(cell(container, 'e2')).toHaveClass('sel')
    expect(cell(container, 'e3')).toHaveClass('dot')
    expect(cell(container, 'e4')).toHaveClass('dot')
    expect(spoken(container)).toBe('Selected white pawn on e2. 2 moves available.')
  })

  it('rings a legal capture rather than dotting it', async () => {
    const user = userEvent.setup()
    const fen = toFen('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2')
    const { container } = render(
      <Board fen={fen} movable="white" legalMoves={legalFrom({ e4: ['d5', 'e5'] })} />,
    )

    await user.click(cell(container, 'e4'))

    expect(cell(container, 'd5')).toHaveClass('cap')
    expect(cell(container, 'e5')).toHaveClass('dot')
  })

  it('emits a move the caller declared legal', async () => {
    const onMove = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <Board
        fen={START_FEN}
        movable="white"
        legalMoves={legalFrom({ e2: ['e3', 'e4'] })}
        onMove={onMove}
      />,
    )

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e4'))

    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
    expect(spoken(container)).toBe('White pawn e2 to e4.')
  })

  it('rejects a move the caller did not declare legal', async () => {
    const onMove = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <Board
        fen={START_FEN}
        movable="white"
        legalMoves={legalFrom({ e2: ['e3', 'e4'] })}
        onMove={onMove}
      />,
    )

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e5'))

    expect(onMove).not.toHaveBeenCalled()
    expect(container.querySelector('.vb')).toHaveAttribute('data-effect', 'shake')
    expect(spoken(container)).toBe('e2 to e5 is not a legal move.')
  })

  it('rejects every move when no legal moves were supplied at all', async () => {
    const onMove = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<Board fen={START_FEN} movable="white" onMove={onMove} />)

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e4'))

    expect(onMove).not.toHaveBeenCalled()
  })

  it('accepts any move on a free-placement board', async () => {
    const onMove = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <Board fen={START_FEN} movable="both" legalMoves="any" onMove={onMove} />,
    )

    await user.click(cell(container, 'b1'))
    await user.click(cell(container, 'd4'))

    expect(onMove).toHaveBeenCalledWith({ from: 'b1', to: 'd4' })
  })

  it('will not pick up the side the user is not playing', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Board fen={START_FEN} movable="white" legalMoves={legalFrom({ e7: ['e5'] })} />,
    )

    await user.click(cell(container, 'e7'))

    expect(cell(container, 'e7')).not.toHaveClass('sel')
  })

  it('reselects when the second click lands on another of your own pieces', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Board
        fen={START_FEN}
        movable="white"
        legalMoves={legalFrom({ e2: ['e3', 'e4'], d2: ['d3', 'd4'] })}
      />,
    )

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'd2'))

    expect(cell(container, 'e2')).not.toHaveClass('sel')
    expect(cell(container, 'd2')).toHaveClass('sel')
  })

  it('answers an assistive-technology activation, which arrives as a click with no pointer', () => {
    const { container } = render(
      <Board fen={START_FEN} movable="white" legalMoves={legalFrom({ e2: ['e4'] })} />,
    )

    fireEvent.click(cell(container, 'e2'), { detail: 0 })

    expect(cell(container, 'e2')).toHaveClass('sel')
  })
})

describe('<Board> dragging', () => {
  it('moves a piece dragged onto a legal square', () => {
    const onMove = vi.fn()
    const { container } = render(
      <Board
        fen={START_FEN}
        movable="white"
        legalMoves={legalFrom({ e2: ['e3', 'e4'] })}
        onMove={onMove}
      />,
    )
    const grid = gridOf(container)

    fireEvent.pointerDown(cell(container, 'e2'), pointAt('e2'))
    fireEvent.pointerMove(grid, pointAt('e4'))
    expect(cell(container, 'e4')).toHaveClass('over')

    fireEvent.pointerUp(grid, pointAt('e4'))

    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
  })

  it('rejects a drag onto a square the caller did not allow', () => {
    const onMove = vi.fn()
    const { container } = render(
      <Board
        fen={START_FEN}
        movable="white"
        legalMoves={legalFrom({ e2: ['e3', 'e4'] })}
        onMove={onMove}
      />,
    )
    const grid = gridOf(container)

    fireEvent.pointerDown(cell(container, 'e2'), pointAt('e2'))
    fireEvent.pointerMove(grid, pointAt('e6'))
    fireEvent.pointerUp(grid, pointAt('e6'))

    expect(onMove).not.toHaveBeenCalled()
    expect(spoken(container)).toBe('e2 to e6 is not a legal move.')
  })

  it('keeps the piece selected when a press never travels, so click-to-move still works', () => {
    const { container } = render(
      <Board fen={START_FEN} movable="white" legalMoves={legalFrom({ e2: ['e4'] })} />,
    )

    fireEvent.pointerDown(cell(container, 'e2'), pointAt('e2'))
    fireEvent.pointerUp(gridOf(container), pointAt('e2'))

    expect(cell(container, 'e2')).toHaveClass('sel')
  })

  it('puts the piece back when the drag is cancelled', () => {
    const onMove = vi.fn()
    const { container } = render(
      <Board
        fen={START_FEN}
        movable="white"
        legalMoves={legalFrom({ e2: ['e4'] })}
        onMove={onMove}
      />,
    )
    const grid = gridOf(container)

    fireEvent.pointerDown(cell(container, 'e2'), pointAt('e2'))
    fireEvent.pointerMove(grid, pointAt('e4'))
    fireEvent.pointerCancel(grid, pointAt('e4'))

    expect(onMove).not.toHaveBeenCalled()
    expect(cell(container, 'e2').querySelector('[data-piece]')).toHaveStyle({ transform: '' })
  })
})

describe('<Board> promotion', () => {
  const promotionBoard = (onMove: (move: { from: Square; to: Square }) => void) => (
    <Board
      fen={PROMOTION_FEN}
      movable="white"
      legalMoves={legalFrom({ e7: ['e8'] })}
      isPromotion={(_from, to) => to.endsWith('8')}
      onMove={onMove}
    />
  )

  it('asks which piece before emitting the move', async () => {
    const onMove = vi.fn()
    const user = userEvent.setup()
    const { container } = render(promotionBoard(onMove))

    await user.click(cell(container, 'e7'))
    await user.click(cell(container, 'e8'))

    expect(onMove).not.toHaveBeenCalled()
    expect(spoken(container)).toBe('Choose a promotion piece.')

    await user.click(screen.getByRole('button', { name: 'rook' }))

    expect(onMove).toHaveBeenCalledWith({ from: 'e7', to: 'e8', promotion: 'r' })
  })

  it('cancels on Escape without moving', async () => {
    const onMove = vi.fn()
    const user = userEvent.setup()
    const { container } = render(promotionBoard(onMove))

    await user.click(cell(container, 'e7'))
    await user.click(cell(container, 'e8'))
    await user.keyboard('{Escape}')

    expect(onMove).not.toHaveBeenCalled()
    expect(spoken(container)).toBe('Promotion cancelled.')
  })
})

describe('<Board> keyboard play', () => {
  it('walks the cursor with the arrow keys and moves with Enter', async () => {
    const onMove = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <Board
        fen={START_FEN}
        movable="white"
        legalMoves={legalFrom({ e2: ['e3', 'e4'] })}
        onMove={onMove}
      />,
    )

    cell(container, 'a1').focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowUp}')
    expect(document.activeElement).toBe(cell(container, 'e2'))

    await user.keyboard('{Enter}')
    expect(cell(container, 'e2')).toHaveClass('sel')

    await user.keyboard('{ArrowUp}{ArrowUp}{Enter}')
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
  })

  it('keeps exactly one tab stop and moves it with the cursor', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Board fen={START_FEN} movable="white" legalMoves={legalFrom({ e2: ['e4'] })} />,
    )

    expect(cell(container, 'a1')).toHaveAttribute('tabindex', '0')
    cell(container, 'a1').focus()
    await user.keyboard('{ArrowUp}')

    expect(cell(container, 'a1')).toHaveAttribute('tabindex', '-1')
    expect(cell(container, 'a2')).toHaveAttribute('tabindex', '0')
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1)
  })

  it('jumps to the ends of a rank with Home and End', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Board fen={START_FEN} movable="white" legalMoves={legalFrom({})} />,
    )

    cell(container, 'a1').focus()
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(cell(container, 'h1'))

    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(cell(container, 'a1'))
  })

  it('walks the cursor in screen space when the board is flipped', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Board fen={START_FEN} orientation="black" movable="black" legalMoves={legalFrom({})} />,
    )

    // Focusing a square that is not the current cursor moves the cursor to it.
    act(() => {
      cell(container, 'd4').focus()
    })
    await user.keyboard('{ArrowUp}')

    // Flipped, "up the screen" is down the ranks.
    expect(document.activeElement).toBe(cell(container, 'd3'))
  })

  it('clears a selection with Escape', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Board fen={START_FEN} movable="white" legalMoves={legalFrom({ e2: ['e4'] })} />,
    )

    await user.click(cell(container, 'e2'))
    await user.keyboard('{Escape}')

    expect(cell(container, 'e2')).not.toHaveClass('sel')
    expect(spoken(container)).toBe('Selection cleared.')
  })
})

describe('<Board> premoves', () => {
  const blackToMove = toFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1')

  it('stores a move chosen out of turn instead of playing it', async () => {
    const onMove = vi.fn()
    const onPremove = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <Board
        fen={blackToMove}
        movable="white"
        premove
        legalMoves={legalFrom({})}
        onMove={onMove}
        onPremove={onPremove}
      />,
    )

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e4'))

    expect(onMove).not.toHaveBeenCalled()
    expect(onPremove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
    expect(cell(container, 'e4')).toHaveClass('pre')
    expect(spoken(container)).toBe('Premove set: white pawn e2 to e4.')
  })

  it('cancels a premove on Escape', async () => {
    const onPremove = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <Board
        fen={blackToMove}
        movable="white"
        premove
        legalMoves={legalFrom({})}
        onPremove={onPremove}
      />,
    )

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e4'))
    await user.keyboard('{Escape}')

    expect(onPremove).toHaveBeenLastCalledWith(null)
    expect(cell(container, 'e4')).not.toHaveClass('pre')
  })

  it('drops the premove once the caller hands over the next position', async () => {
    const onPremove = vi.fn()
    const user = userEvent.setup()
    const { container, rerender } = render(
      <Board
        fen={blackToMove}
        movable="white"
        premove
        legalMoves={legalFrom({})}
        onPremove={onPremove}
      />,
    )

    await user.click(cell(container, 'e2'))
    await user.click(cell(container, 'e4'))
    expect(cell(container, 'e4')).toHaveClass('pre')

    rerender(
      <Board
        fen={toFen('rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 2')}
        movable="white"
        premove
        legalMoves={legalFrom({})}
        onPremove={onPremove}
      />,
    )

    expect(cell(container, 'e4')).not.toHaveClass('pre')
  })
})

describe('<Board> imperative handle', () => {
  it('flashes, shakes, focuses and clears', async () => {
    const ref = createRef<BoardHandle>()
    const user = userEvent.setup()
    const { container } = render(
      <Board ref={ref} fen={START_FEN} movable="white" legalMoves={legalFrom({ e2: ['e4'] })} />,
    )

    act(() => {
      ref.current?.flash('error')
    })
    expect(container.querySelector('.vb')).toHaveAttribute('data-effect', 'flash-error')

    act(() => {
      ref.current?.shake()
    })
    expect(container.querySelector('.vb')).toHaveAttribute('data-effect', 'shake')

    act(() => {
      ref.current?.focus()
    })
    expect(document.activeElement).toBe(cell(container, 'a1'))

    await user.click(cell(container, 'e2'))
    act(() => {
      ref.current?.clearSelection()
    })
    expect(cell(container, 'e2')).not.toHaveClass('sel')
  })
})

describe('<Board> announcements', () => {
  it('speaks a check the caller reported', () => {
    const { container } = render(
      <Board
        fen={START_FEN}
        shapes={{ highlight: [], focus: [], check: sq('e1'), arrows: [], marks: [] }}
      />,
    )

    expect(spoken(container)).toBe('Check on e1.')
  })

  it('speaks whatever the surrounding screen hands it', () => {
    const { container, rerender } = render(<Board fen={START_FEN} announcement="Black plays e5." />)
    expect(spoken(container)).toBe('Black plays e5.')

    rerender(<Board fen={START_FEN} announcement="Your turn." />)
    expect(spoken(container)).toBe('Your turn.')
  })
})

describe('<Board> animation', () => {
  let clientWidth: PropertyDescriptor | undefined

  beforeAll(() => {
    clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: BOARD_PX,
    })
  })

  afterAll(() => {
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth)
  })

  it('slides the piece that moved from where it was', () => {
    const { container, rerender } = render(<Board fen={START_FEN} />)

    rerender(<Board fen={toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')} />)

    const pawn = cell(container, 'e4').querySelector('[data-piece]')
    expect(pawn).toHaveStyle({ transform: 'translate3d(0px, 200px, 0)' })
  })

  it('does not move anything when the animation is switched off', () => {
    const { container, rerender } = render(<Board fen={START_FEN} animationSpeed="off" />)

    rerender(
      <Board
        fen={toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')}
        animationSpeed="off"
      />,
    )

    expect(cell(container, 'e4').querySelector('[data-piece]')).toHaveStyle({ transform: '' })
  })
})
