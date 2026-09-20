import { ARROW_KINDS } from '@/domain'
import type { Arrow, ArrowKind, Color, Square } from '@/domain'

import { screenColumn, screenRow } from './placement'

export interface BoardArrowsProps {
  arrows: readonly Arrow[]
  orientation: Color
  /** Unique per board: two boards on one screen must not share marker ids. */
  idPrefix: string
}

/** Centre of a square in the 8×8 user-space the overlay draws in. */
const centre = (square: Square, orientation: Color): [number, number] => [
  screenColumn(square, orientation) + 0.5,
  screenRow(square, orientation) + 0.5,
]

const markerId = (idPrefix: string, kind: ArrowKind): string => `${idPrefix}-arrow-${kind}`

/**
 * The three arrow kinds the prototype draws: the engine's best move, the
 * opponent's threat, and something Sage is pointing at.
 *
 * `aria-hidden` because an arrow is a restatement of something the surrounding
 * screen has already written in prose — a screen reader hearing "line" 64 times
 * would be worse off, not better.
 */
export function BoardArrows({ arrows, orientation, idPrefix }: BoardArrowsProps) {
  if (arrows.length === 0) return null

  const usedKinds = ARROW_KINDS.filter((kind) => arrows.some((arrow) => arrow.kind === kind))

  return (
    <svg className="vb-arrows" viewBox="0 0 8 8" aria-hidden="true">
      <defs>
        {usedKinds.map((kind) => (
          <marker
            key={kind}
            id={markerId(idPrefix, kind)}
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="3"
            markerHeight="3"
            orient="auto"
          >
            <path d="M0,0L10,5L0,10z" className="vb-head" data-kind={kind} />
          </marker>
        ))}
      </defs>
      {arrows.map((arrow) => {
        const [x1, y1] = centre(arrow.from, orientation)
        const [x2, y2] = centre(arrow.to, orientation)
        // Stop short of the centre so the head sits on the target square rather
        // than covering the piece standing on it.
        const length = Math.hypot(x2 - x1, y2 - y1)
        const scale = length === 0 ? 0 : (length - 0.4) / length
        return (
          <line
            key={`${arrow.from}${arrow.to}${arrow.kind}`}
            className="vb-arrow"
            data-kind={arrow.kind}
            x1={x1}
            y1={y1}
            x2={x1 + (x2 - x1) * scale}
            y2={y1 + (y2 - y1) * scale}
            markerEnd={`url(#${markerId(idPrefix, arrow.kind)})`}
          />
        )
      })}
    </svg>
  )
}
