import { memo } from 'react'

import { cn, QualityGlyph } from '@/design'
import type { PieceSet } from '@/design'
import type { MoveQuality, Square } from '@/domain'

import { describeSquare } from './announce'
import { pieceImageUrl } from './piece-sets'

import type { PieceCode } from './placement'

export interface BoardSquareProps {
  square: Square
  code: PieceCode | null
  pieceSet: PieceSet
  light: boolean
  /** Tinted as part of the last move. */
  highlighted: boolean
  selected: boolean
  /** The king that is in check, as the caller reported it in `shapes.check`. */
  checked: boolean
  /** Circled by a lesson or a hint. */
  focused: boolean
  /** A legal destination: a dot when empty, a ring when it holds a piece. */
  destination: boolean
  /** Part of the premove the user has stored for their next turn. */
  premove: boolean
  /** Under the pointer during a drag. */
  over: boolean
  dragging: boolean
  mark: MoveQuality | null
  rankLabel: string | null
  fileLabel: string | null
  interactive: boolean
  /** Holds the single tab stop of the grid's roving tabindex. */
  cursor: boolean
}

/**
 * One square, and whatever stands or is drawn on it.
 *
 * Deliberately handler-free: every pointer and key event is delegated to the grid
 * and resolved through `data-square`. That keeps this `memo` effective, so a drag
 * across the board re-renders the two squares that changed rather than all 64 —
 * which is the difference between 60 fps and not on a mid-range phone.
 */
export const BoardSquare = memo(function BoardSquare({
  square,
  code,
  pieceSet,
  light,
  highlighted,
  selected,
  checked,
  focused,
  destination,
  premove,
  over,
  dragging,
  mark,
  rankLabel,
  fileLabel,
  interactive,
  cursor,
}: BoardSquareProps) {
  const label =
    mark === null
      ? describeSquare(square, code ?? undefined)
      : `${describeSquare(square, code ?? undefined)}, ${mark}`

  return (
    <div
      data-square={square}
      className={cn(
        'vb-sq',
        light ? 'l' : 'd',
        highlighted && 'hl',
        selected && 'sel',
        checked && 'ck',
        focused && 'fo',
        premove && 'pre',
        over && 'over',
        destination && (code ? 'cap' : 'dot'),
      )}
      role={interactive ? 'gridcell' : undefined}
      tabIndex={interactive ? (cursor ? 0 : -1) : undefined}
      aria-label={interactive ? label : undefined}
      aria-selected={interactive ? selected : undefined}
    >
      {rankLabel === null ? null : <span className="vb-c r">{rankLabel}</span>}
      {fileLabel === null ? null : <span className="vb-c f">{fileLabel}</span>}
      {code === null ? null : (
        <img
          className={cn('vb-p', dragging && 'dragging')}
          data-piece={code}
          src={pieceImageUrl(pieceSet, code)}
          alt=""
          draggable={false}
        />
      )}
      {mark === null ? null : (
        <QualityGlyph
          quality={mark}
          size="sm"
          labelled={false}
          className="vb-m size-[40%] max-h-[28px] max-w-[28px] text-[clamp(7px,2.3cqi,13px)]"
        />
      )}
    </div>
  )
})
