/**
 * S06 · Chess core — every rule, format and judgement in this app, as pure functions.
 *
 * No React, no workers, no storage: give these functions positions and evaluations and
 * they give you moves, names and verdicts. That is what makes the review, the puzzle
 * solver, the opening trainer and the analysis board able to share one implementation of
 * "what does this position mean" instead of three.
 *
 * Four things are worth knowing before using this module:
 *
 * - **Games are values.** `applyMove` returns a new game and never touches the one passed
 *   in, so a component may hold any past position for as long as it likes (`game.ts`).
 * - **Errors are values too.** Anything that can meet bad input — a FEN, a PGN, a move —
 *   returns `Result`, never throws (`@/domain`'s `ok`/`err`).
 * - **chess.js stays inside.** Its `'w' | 'b'` vocabulary is translated in exactly one
 *   file, `chessjs.ts`, and none of its types cross this barrel.
 * - **Accuracy and classification are Lichess-compatible on purpose**, so a player can
 *   check this app's numbers against the rest of the chess world (`accuracy.ts`).
 */
export {
  EVAL_CEILING_CP,
  gameAccuracy,
  gameAccuracyFromEvals,
  INITIAL_CENTIPAWNS,
  moveAccuracy,
  plyAccuracies,
  WIN_PERCENT_MULTIPLIER,
  winningChances,
  winPercent,
  winPercentFromScore,
  type AccuracyByColor,
  type AccuracyOptions,
  type PlyAccuracy,
} from './accuracy'
export {
  ALREADY_WON_WIN_PERCENT,
  BLUNDER_LOSS,
  classifyMove,
  classifyMoveDetailed,
  countMoveQualities,
  FORGIVEN_LOSS,
  INACCURACY_LOSS,
  LOST_THE_WIN_WIN_PERCENT,
  MISTAKE_LOSS,
  ONLY_MOVE_MARGIN,
  SACRIFICE_CENTIPAWNS,
  SOUND_SACRIFICE_WIN_PERCENT,
  WON_GAME_WIN_PERCENT,
  type MoveClassification,
  type MoveClassificationInput,
} from './classify'
export {
  detectOpening,
  detectOpeningFromMoves,
  detectOpeningFromPositions,
  ECO_TABLE_SIZE,
  ecoTableSize,
  isBookPosition,
  lookupOpening,
  type EcoEntry,
} from './eco'
export { ECO_TABLE_SOURCE } from './eco-table'
export {
  formatFen,
  fullmoveNumberOf,
  halfmoveClockOf,
  normalizeFen,
  parseFen,
  sideToMoveOf,
  validateFen,
  withCounters,
  type FenFields,
} from './fen'
export {
  applyMove,
  createGame,
  isCheck,
  isGameOver,
  isLegalMove,
  legalMoves,
  legalMovesFrom,
  playMoves,
  positionsOf,
  repetitionCount,
  resultOf,
  terminationOf,
  undoMove,
  type ChessGame,
  type ClaimableDraw,
  type GameStatus,
  type LegalMove,
  type MoveInput,
  type PlayedMove,
} from './game'
export {
  capturedPieces,
  countMaterial,
  materialBalance,
  pieceAt,
  PIECE_VALUES,
  staticExchangeEvaluation,
  type MaterialBalance,
  type MaterialCount,
  type PieceCounts,
} from './material'
export {
  formatUci,
  parseUci,
  sanLineToUci,
  sanToUci,
  uciLineToSan,
  uciToSan,
  type UciParts,
} from './moves'
export {
  mainLine,
  parsePgn,
  parsePgnGame,
  serializePgn,
  serializePgnGames,
  splitPgnGames,
  toMoveRecords,
  type PgnGame,
  type PgnMoveNode,
  type SerializeOptions,
} from './pgn'
