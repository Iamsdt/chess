import { ExternalLink } from 'lucide-react'

import { cn, Badge } from '@/design'
import { lichessPuzzleUrl, type Puzzle } from '@/domain'

export interface PuzzleAttributionProps {
  readonly puzzle: Puzzle
  /** Hidden until the puzzle is over, so the rating is not a hint. */
  readonly revealed: boolean
  readonly className?: string
}

/**
 * Theme, rating and where the puzzle came from.
 *
 * The Lichess link is not decoration: the puzzles are the Lichess open database, and
 * crediting them in the app — not only in the repository — is the licence obligation S10
 * recorded. It is shown on every solved puzzle, which is what the sprint's "done when"
 * asks for.
 */
export function PuzzleAttribution({ puzzle, revealed, className }: PuzzleAttributionProps) {
  const source = lichessPuzzleUrl(puzzle)

  if (!revealed) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Theme and rating are hidden until you have played your move.
      </p>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-xs', className)}>
      <Badge variant="secondary">{puzzle.theme}</Badge>
      <Badge variant="outline">Rating {puzzle.rating}</Badge>
      {source === null ? (
        <span className="text-muted-foreground">Puzzle from the Lichess open database</span>
      ) : (
        <a
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
          href={source}
          target="_blank"
          rel="noreferrer"
        >
          Puzzle from Lichess
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      )}
    </div>
  )
}
