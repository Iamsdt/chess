import { useId } from 'react'

import { cn } from '@/design'
import type { CoachAttachment } from '@/domain'

/**
 * A small, static picture of a position for a chat bubble.
 *
 * Why not `<Board>`: S09's only dependencies are the design system and the
 * domain, and a chat card needs none of a real board — no drag, no legality, no
 * piece artwork to download. This draws squares, overlays and arrows from the
 * attachment data and nothing else. When the interactive board is wanted here
 * instead, `CoachPanel`'s `renderAttachment` slot replaces this component
 * wholesale; nothing else has to change.
 */

const FILES = 'abcdefgh'

/**
 * Display-only decode of a FEN's placement field.
 *
 * Why this is not "reimplementing the rules": it reads the first field of a
 * string the domain already validated and says which glyph sits where. It makes
 * no move, judges no legality, and must never grow to.
 */
function decodePlacement(fen: string): ReadonlyMap<string, string> {
  const placement = new Map<string, string>()
  const ranks = fen.split(' ')[0]?.split('/') ?? []
  ranks.forEach((row, rowIndex) => {
    let fileIndex = 0
    for (const character of row) {
      const skip = Number.parseInt(character, 10)
      if (!Number.isNaN(skip)) {
        fileIndex += skip
        continue
      }
      const file = FILES[fileIndex]
      if (file !== undefined) placement.set(`${file}${String(8 - rowIndex)}`, character)
      fileIndex += 1
    }
  })
  return placement
}

/** The solid glyph set for both colours; ink and outline tell them apart. */
const GLYPHS: Readonly<Record<string, string>> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
}

const PIECE_NAMES: Readonly<Record<string, string>> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
}

const ARROW_COLOURS = {
  best: 'var(--vb-arrow)',
  threat: 'var(--vb-arrow-alt)',
  sage: 'var(--vb-arrow-ai)',
} as const

function squareCentre(square: string, flipped: boolean): readonly [number, number] {
  const file = FILES.indexOf(square.charAt(0))
  const rank = Number.parseInt(square.charAt(1), 10)
  return flipped ? [7 - file + 0.5, rank - 0.5] : [file + 0.5, 8 - rank + 0.5]
}

function describe(placement: ReadonlyMap<string, string>): string {
  const pieces = [...placement.entries()].map(([square, character]) => {
    const colour = character === character.toUpperCase() ? 'White' : 'Black'
    return `${colour} ${PIECE_NAMES[character.toLowerCase()] ?? 'piece'} on ${square}`
  })
  return pieces.length === 0 ? 'Empty board' : pieces.join(', ')
}

export interface PositionPreviewProps {
  readonly attachment: CoachAttachment
  readonly className?: string
}

export function PositionPreview({ attachment, className }: PositionPreviewProps) {
  // `useId` includes characters that are awkward inside an SVG `url(#…)` reference.
  const markerId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const placement = decodePlacement(attachment.fen)
  const flipped = attachment.orientation === 'black'
  const highlight = new Set<string>(attachment.highlight)
  const focus = new Set<string>(attachment.focus)

  const squares = Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8)
    const column = index % 8
    const file = FILES.charAt(flipped ? 7 - column : column)
    const rank = flipped ? row + 1 : 8 - row
    const square = `${file}${String(rank)}`
    const light = (FILES.indexOf(file) + rank) % 2 === 1
    return { square, light, piece: placement.get(square) }
  })

  return (
    <div
      role="img"
      aria-label={describe(placement)}
      className={cn('relative grid aspect-square w-full grid-cols-8', className)}
    >
      {squares.map(({ square, light, piece }) => (
        <div
          key={square}
          data-square={square}
          className="relative grid place-items-center"
          style={{ backgroundColor: light ? 'var(--vb-light)' : 'var(--vb-dark)' }}
        >
          {highlight.has(square) ? (
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{ backgroundColor: 'var(--vb-hl)' }}
            />
          ) : null}
          {focus.has(square) ? (
            <span
              aria-hidden="true"
              className="absolute inset-[12%] rounded-full border-2"
              style={{ borderColor: 'var(--vb-focus)' }}
            />
          ) : null}
          {piece === undefined ? null : (
            <span
              aria-hidden="true"
              className={cn(
                'relative [font-size:min(5vw,1.5rem)] leading-none',
                piece === piece.toUpperCase()
                  ? 'text-white [-webkit-text-stroke:0.5px_rgba(20,18,14,0.85)]'
                  : 'text-black [-webkit-text-stroke:0.5px_rgba(255,255,255,0.4)]',
              )}
            >
              {GLYPHS[piece.toLowerCase()] ?? ''}
            </span>
          )}
        </div>
      ))}

      {attachment.arrows.length > 0 ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 8 8"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <defs>
            {Object.entries(ARROW_COLOURS).map(([kind, colour]) => (
              <marker
                key={kind}
                id={`${markerId}-${kind}`}
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="3"
                markerHeight="3"
                orient="auto"
              >
                <path d="M0,0L10,5L0,10z" fill={colour} />
              </marker>
            ))}
          </defs>
          {attachment.arrows.map((arrow) => {
            const [x1, y1] = squareCentre(arrow.from, flipped)
            const [x2, y2] = squareCentre(arrow.to, flipped)
            const length = Math.hypot(x2 - x1, y2 - y1) || 1
            const shorten = (length - 0.4) / length
            return (
              <line
                key={`${arrow.from}-${arrow.to}-${arrow.kind}`}
                x1={x1}
                y1={y1}
                x2={x1 + (x2 - x1) * shorten}
                y2={y1 + (y2 - y1) * shorten}
                stroke={ARROW_COLOURS[arrow.kind]}
                strokeWidth={0.14}
                strokeLinecap="round"
                markerEnd={`url(#${markerId}-${arrow.kind})`}
              />
            )
          })}
        </svg>
      ) : null}
    </div>
  )
}
