import { useMemo } from 'react'

import { Board } from '@/board'
import type { BoardMove } from '@/board'
import { useTheme } from '@/design'
import { emptyBoardShapes, type Square } from '@/domain'

import {
  isPromotionMove,
  legalMoveMap,
  solveShapes,
  type SolveState,
  type AttemptedMove,
} from '../solution'

export interface SolverBoardProps {
  readonly solve: SolveState | null
  readonly focus: readonly Square[]
  readonly onMove: (move: AttemptedMove) => void
  readonly label: string
  /** Spoken alongside the board's own move announcements: the verdict, a hint, a reply. */
  readonly announcement?: string | undefined
}

/**
 * `<Board>` with the rules attached.
 *
 * S08's board is presentational on purpose: it knows squares and pixels and no chess at
 * all. Everything it needs — which moves are legal, whether one promotes, what to
 * highlight — is computed here from `@/chess` by way of the solve state, which is why a
 * puzzle, a game and a lesson can share one board without sharing any rules.
 */
export function SolverBoard({ solve, focus, onMove, label, announcement }: SolverBoardProps) {
  const { pieceSet, board: boardTheme } = useTheme()

  const legalMoves = useMemo(
    () => (solve === null ? new Map<Square, readonly Square[]>() : legalMoveMap(solve.game)),
    [solve],
  )
  const shapes = useMemo(
    () => (solve === null ? emptyBoardShapes() : solveShapes(solve, { focus })),
    [solve, focus],
  )
  const isPromotion = useMemo(
    () => (from: Square, to: Square) => solve !== null && isPromotionMove(solve.game, from, to),
    [solve],
  )

  if (solve === null) {
    return (
      <div
        className="aspect-square w-full rounded-xl border border-dashed bg-muted/40"
        role="img"
        aria-label="The board is waiting for a puzzle"
      />
    )
  }

  const movable = solve.status === 'solving' ? solve.userColor : 'none'

  return (
    <Board
      fen={solve.game.fen}
      orientation={solve.userColor}
      movable={movable}
      legalMoves={legalMoves}
      isPromotion={isPromotion}
      onMove={(move: BoardMove) => {
        onMove(move)
      }}
      shapes={shapes}
      pieceSet={pieceSet}
      boardTheme={boardTheme}
      label={label}
      {...(announcement === undefined ? {} : { announcement })}
    />
  )
}
