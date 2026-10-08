import { cn } from '@/design'
import { toSquare, type Color, type Square } from '@/domain'
import { FILES, RANKS } from '@/features/drills/vision-squares'

export interface BlankBoardProps {
  readonly orientation: Color
  readonly label: string
  /** Squares the user has tapped. */
  readonly selected?: readonly Square[]
  /** Squares lit as anchors. */
  readonly lit?: readonly Square[]
  /** Present when the squares can be tapped to answer. */
  readonly onPick?: (square: Square) => void
  readonly className?: string
}

/**
 * An empty board, drawn by hand.
 *
 * Why not `<Board>`: it takes a FEN, and a FEN must hold both kings, so a board with no
 * pieces at all cannot be expressed. This is the blindfold view and the tap-to-answer board.
 */
export function BlankBoard({
  orientation,
  label,
  selected = [],
  lit = [],
  onPick,
  className,
}: BlankBoardProps) {
  const files = orientation === 'white' ? [...FILES] : [...FILES].reverse()
  const ranks = orientation === 'white' ? [...RANKS].reverse() : [...RANKS]
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="viz-blank-board"
      className={cn(
        'grid aspect-square w-full grid-cols-8 overflow-hidden rounded-lg border',
        className,
      )}
    >
      {ranks.flatMap((rank, row) =>
        files.map((file, column) => {
          const square = toSquare(`${file}${rank}`)
          const light = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 1
          const picked = selected.includes(square)
          const glowing = lit.includes(square)
          const tone = picked
            ? 'bg-cta-soft'
            : glowing
              ? 'bg-reward-soft'
              : light
                ? 'bg-[var(--vb-light)]'
                : 'bg-[var(--vb-dark)]'
          const classes = cn(
            'relative grid place-items-center text-[10px] text-foreground/60',
            tone,
            (picked || glowing) && 'ring-2 ring-ring ring-inset',
          )
          const mark =
            column === 0 || row === 7 ? (
              <span aria-hidden="true" className="absolute inset-0 p-0.5 leading-none">
                {column === 0 ? <span className="absolute top-0.5 left-0.5">{rank}</span> : null}
                {row === 7 ? <span className="absolute right-0.5 bottom-0.5">{file}</span> : null}
              </span>
            ) : null
          return onPick === undefined ? (
            <div
              key={square}
              data-square={square}
              data-lit={glowing ? 'true' : undefined}
              className={classes}
            >
              {mark}
            </div>
          ) : (
            <button
              key={square}
              type="button"
              data-square={square}
              aria-label={square}
              aria-pressed={picked}
              className={cn(
                classes,
                'cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring',
              )}
              onClick={() => {
                onPick(square)
              }}
            >
              {mark}
            </button>
          )
        }),
      )}
    </div>
  )
}
