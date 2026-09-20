import type { BoardTheme, PieceSet } from '@/design'
import type { AnimationSpeed, BoardShapes, Color, Fen, PromotionPiece, Square } from '@/domain'

import type { Ref } from 'react'

/** A move the user expressed on the board. The board never invents a promotion. */
export interface BoardMove {
  from: Square
  to: Square
  /** Present only when the caller's `isPromotion` said the move promotes. */
  promotion?: PromotionPiece
}

/**
 * The squares the caller has declared reachable, keyed by origin.
 *
 * This is the board's entire notion of legality. `<Board>` is presentational and
 * deliberately knows no rules: the screen that owns the game (S12, S14, S19…)
 * computes this with `@/chess` and hands it over. `'any'` opts out for the
 * position-setup and board-vision surfaces, where free placement is the point.
 */
export type LegalMoveMap = ReadonlyMap<Square, readonly Square[]>

/** Which pieces the user may pick up. `none` is a display-only board. */
export type BoardMovable = Color | 'both' | 'none'

/** The three feedback colours `flash()` can paint. */
export type BoardFlashTone = 'success' | 'error' | 'hint'

/** The imperative escape hatch, for feedback a prop change cannot express. */
export interface BoardHandle {
  /** A brief tint across the board: solved, wrong, or "look here". */
  flash: (tone?: BoardFlashTone) => void
  /** The rejection nudge, for a move the surrounding screen refuses. */
  shake: () => void
  /** Puts keyboard focus on the board's cursor square. */
  focus: () => void
  /** Drops any selection, drag and stored premove without emitting a move. */
  clearSelection: () => void
}

export interface BoardProps {
  /** The position to draw. Changing it animates the pieces that moved. */
  fen: Fen
  /** Which colour sits at the bottom. */
  orientation?: Color
  /** Which pieces the user may pick up; `none` (the default) is read-only. */
  movable?: BoardMovable
  /**
   * Legal destinations per origin square. Anything not listed here is rejected
   * with a shake and a spoken "not a legal move". Omitted means *nothing* is
   * legal, which is only ever right for a display board.
   */
  legalMoves?: LegalMoveMap | 'any'
  /**
   * Asked only once a legal `from`→`to` has been chosen. `true` opens the
   * promotion picker instead of emitting the move straight away.
   */
  isPromotion?: (from: Square, to: Square) => boolean
  /** Fired for a move the board has checked against `legalMoves`. */
  onMove?: (move: BoardMove) => void
  /** Overlays: last-move highlight, check, focus circles, arrows, quality badges. */
  shapes?: BoardShapes
  /** File letters and rank digits on the board edge. */
  coordinates?: boolean
  /** How fast pieces slide. `prefers-reduced-motion` overrides this to `off`. */
  animationSpeed?: AnimationSpeed
  /** Artwork folder under `public/pieces/`. Pass `useTheme().pieceSet` to follow the user. */
  pieceSet?: PieceSet
  /** Scopes the square palette to this board. Omitted, it inherits `<html data-board>`. */
  boardTheme?: BoardTheme
  /**
   * Lets the user choose a move while it is the other side's turn. The board
   * cannot check a premove, so it only records and shows it; the caller replays
   * it once the position is its turn again.
   */
  premove?: boolean
  /** Fired with the stored premove, or `null` when the user cancels it. */
  onPremove?: (move: BoardMove | null) => void
  /** The board's accessible name; give each board on a screen its own. */
  label?: string
  /**
   * Extra text for the live region, spoken whenever it changes — the opponent's
   * reply, a puzzle verdict, anything the board itself cannot know.
   */
  announcement?: string
  className?: string
  id?: string
  ref?: Ref<BoardHandle>
}
