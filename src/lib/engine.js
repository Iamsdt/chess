/**
 * Chess AI engine using minimax with alpha-beta pruning.
 * Easy   → random move
 * Medium → minimax depth 2
 * Hard   → minimax depth 3
 */

import { Chess } from "chess.js";

// Piece material values (centipawns)
const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Piece-square tables — indexed from White's perspective (rank 8 → rank 1)
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30,
    20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5,
    -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0,
    0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30,
    0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20,
    20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20,
    -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0,
    5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10,
    0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20,
    -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0,
    -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
    0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5,
    5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5,
    5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10,
    -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
    -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
    -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20,
    -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

/**
 *
 */
const getPSTValue = (piece, row, col) => {
  const table = PST[piece.type];
  if (!table) return 0;
  const index = piece.color === "w" ? row * 8 + col : (7 - row) * 8 + col;
  return (table[index] || 0) / 10;
};

/**
 *
 */
const evaluateBoard = (game) => {
  if (game.isCheckmate()) return game.turn() === "w" ? -50000 : 50000;
  if (game.isDraw() || game.isStalemate()) return 0;

  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (sq) {
        const value = (PIECE_VALUES[sq.type] || 0) + getPSTValue(sq, r, c);
        score += sq.color === "w" ? value : -value;
      }
    }
  }
  return score;
};

/**
 *
 */
const minimax = (game, depth, alpha, beta, isMaximizing) => {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }

  const moves = game.moves();

  if (isMaximizing) {
    let best = -Infinity;
    for (const move of moves) {
      game.move(move);
      const sc = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      best = Math.max(best, sc);
      alpha = Math.max(alpha, sc);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      game.move(move);
      const sc = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      best = Math.min(best, sc);
      beta = Math.min(beta, sc);
      if (beta <= alpha) break;
    }
    return best;
  }
};

/**
 * Returns the best SAN move string for the current position.
 * @param {string} fen - Current board FEN
 * @param {'easy'|'medium'|'hard'} difficulty
 * @returns {string|null} SAN move string or null if no moves
 */
export const getBestMove = (fen, difficulty = "medium") => {
  const game = new Chess(fen);
  const moves = game.moves();
  if (!moves.length) return null;

  // Easy: pure random
  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = difficulty === "medium" ? 2 : 3;
  const isWhite = game.turn() === "w";

  let bestMove = moves[0];
  let bestScore = isWhite ? -Infinity : Infinity;

  // Shuffle for variation so equal-score moves aren't deterministic
  const shuffled = [...moves].sort(() => Math.random() - 0.5);

  for (const move of shuffled) {
    game.move(move);
    const score = minimax(game, depth - 1, -Infinity, Infinity, !isWhite);
    game.undo();

    if (isWhite ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
};
