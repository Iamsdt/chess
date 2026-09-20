import type { PlayedMove } from '@/chess'
import { cn } from '@/design'

export interface MoveListProps {
  readonly moves: readonly PlayedMove[]
  readonly label: string
}

/** The move list, in full-move rows like the prototype's. Read-only: scrubbing back
 *  through a live game is the analysis board's job, not the sparring screen's. */
export function MoveList({ moves, label }: MoveListProps) {
  const rows: { number: number; white?: PlayedMove; black?: PlayedMove }[] = []
  for (const move of moves) {
    const last = rows[rows.length - 1]
    if (move.color === 'white' || last === undefined || last.black !== undefined) {
      rows.push(
        move.color === 'white'
          ? { number: move.moveNumber, white: move }
          : { number: move.moveNumber, black: move },
      )
    } else {
      last.black = move
    }
  }
  const currentPly = moves.length - 1

  if (moves.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        No moves yet. The game starts when you play one.
      </p>
    )
  }

  return (
    <ol aria-label={label} className="text-sm">
      {rows.map((row) => (
        <li
          key={row.number}
          className="grid grid-cols-[32px_1fr_1fr] items-center rounded-md px-2 py-1 odd:bg-muted/50"
        >
          <span className="font-mono text-xs text-muted-foreground">{row.number}.</span>
          <span className={cn('px-1.5', row.white?.ply === currentPly && 'font-bold text-primary')}>
            {row.white?.san ?? ''}
          </span>
          <span className={cn('px-1.5', row.black?.ply === currentPly && 'font-bold text-primary')}>
            {row.black?.san ?? ''}
          </span>
        </li>
      ))}
    </ol>
  )
}
