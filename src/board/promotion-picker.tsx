import { useEffect, useRef } from 'react'

import type { PieceSet } from '@/design'
import { PROMOTION_PIECES } from '@/domain'
import type { Color, PromotionPiece, Square } from '@/domain'

import { describePieceType } from './announce'
import { pieceImageUrl } from './piece-sets'
import { pieceCodeFor, screenColumn, screenRow } from './placement'

/** Strongest first: the queen sits on the promotion square itself. */
const CHOICES: readonly PromotionPiece[] = [...PROMOTION_PIECES].reverse()

export interface PromotionPickerProps {
  /** The colour promoting, so the picker shows that side's artwork. */
  color: Color
  /** The square the pawn is arriving on; the column hangs off it. */
  square: Square
  orientation: Color
  pieceSet: PieceSet
  onSelect: (piece: PromotionPiece) => void
  onCancel: () => void
}

/**
 * The column of promotion choices, lichess-style, over the promoting file.
 *
 * Why a scrim button rather than a modal dialog: the choice belongs to the board
 * both visually and in the reading order, and a real dialog would move focus out
 * of the grid and back, losing the keyboard cursor the user was navigating with.
 * The scrim gives the same "nothing else is clickable" behaviour and an explicit
 * way out; `Escape` on the board cancels too.
 */
export function PromotionPicker({
  color,
  square,
  orientation,
  pieceSet,
  onSelect,
  onCancel,
}: PromotionPickerProps) {
  const firstChoiceRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstChoiceRef.current?.focus()
  }, [])

  const column = screenColumn(square, orientation)
  const row = screenRow(square, orientation)
  // Four squares' worth of choices, hanging down from the top edge or up from the
  // bottom one, whichever side of the board the pawn arrived on.
  const hangsDown = row <= 3
  const top = (hangsDown ? row : row - 3) * 12.5
  const order = hangsDown ? CHOICES : [...CHOICES].reverse()

  return (
    <>
      <button type="button" className="vb-promo-scrim" onClick={onCancel}>
        <span className="sr-only">Cancel promotion</span>
      </button>
      <div
        className="vb-promo"
        role="group"
        aria-label="Choose a promotion piece"
        style={{ left: `${String(column * 12.5)}%`, top: `${String(top)}%` }}
      >
        {order.map((piece, index) => (
          <button
            key={piece}
            ref={index === 0 ? firstChoiceRef : undefined}
            type="button"
            className="vb-promo-choice"
            onClick={() => {
              onSelect(piece)
            }}
          >
            <img src={pieceImageUrl(pieceSet, pieceCodeFor(color, piece))} alt="" />
            <span className="sr-only">{describePieceType(piece)}</span>
          </button>
        ))}
      </div>
    </>
  )
}
