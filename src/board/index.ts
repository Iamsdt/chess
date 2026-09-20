/**
 * S08 · The interactive board.
 *
 * `<Board>` is presentational: it renders a position, captures a move gesture and
 * speaks what happened. Every rule — which moves are legal, whether a move
 * promotes, whether the king is in check — is supplied by the screen that owns
 * the game. See `BoardProps` for exactly what a caller has to provide.
 */
export { Board } from './board'
export { PIECE_SET_LABELS, pieceImageUrl, PIECE_BASE_PATH } from './piece-sets'
export { ANIMATION_DURATIONS } from './use-piece-animation'
export type {
  BoardFlashTone,
  BoardHandle,
  BoardMovable,
  BoardMove,
  BoardProps,
  LegalMoveMap,
} from './types'
