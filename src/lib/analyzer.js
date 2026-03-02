/**
 * Post-game full analysis engine.
 *
 * analyzeFullGame(moveHistory, depth, onProgress)
 * → { moveSummary, evalHistory, white, black, criticalMoveIdx, blunders }
 */

import { Chess } from "chess.js";

import { getStockfishEngine } from "./stockfish.js";

// ─── Quality levels (mirror intelligence.js thresholds) ──────────────────────
export const QUALITY_LEVELS = [
  { max: 15, label: "Brilliant", emoji: "💎", color: "cyan", score: 100 },
  { max: 30, label: "Excellent", emoji: "✨", color: "emerald", score: 95 },
  { max: 70, label: "Good", emoji: "👍", color: "green", score: 85 },
  { max: 150, label: "Inaccuracy", emoji: "⚠️", color: "yellow", score: 65 },
  { max: 300, label: "Mistake", emoji: "❌", color: "orange", score: 35 },
  { max: Infinity, label: "Blunder", emoji: "💥", color: "red", score: 10 },
];

/**
 *
 */
export const classifyMove = (cpLost) => {
  for (const q of QUALITY_LEVELS) {
    if (cpLost <= q.max) return q;
  }
  return QUALITY_LEVELS[QUALITY_LEVELS.length - 1];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Score from White's perspective in raw centipawns (or ±30000 for mate). */
const normalizeToWhite = (scoreCp, isMate, mateIn, fenTurn) => {
  if (isMate) {
    // mateIn > 0 means the side-to-move is giving mate
    const givingMate = mateIn > 0;
    if (fenTurn === "w") return givingMate ? 30000 : -30000;
    else return givingMate ? -30000 : 30000;
  }
  if (scoreCp === null) return null;
  return fenTurn === "w" ? scoreCp : -scoreCp;
};

/**
 *
 */
const uciBestToSan = (fen, uci) => {
  if (!uci || uci.length < 4) return null;
  try {
    const g = new Chess(fen);
    const mv = g.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    });
    return mv?.san ?? null;
  } catch {
    return null;
  }
};

/**
 *
 */
const clampEval = (v) => {
  if (v === null || v === undefined || isNaN(v)) return 0;
  return Math.max(-10, Math.min(10, v));
};

/**
 *
 */
const countQualities = (moves) => {
  const counts = {
    Brilliant: 0,
    Excellent: 0,
    Good: 0,
    Inaccuracy: 0,
    Mistake: 0,
    Blunder: 0,
  };
  for (const m of moves) {
    if (counts[m.quality] !== undefined) counts[m.quality]++;
  }
  return counts;
};

/**
 * Chess.com–inspired accuracy formula:
 * accuracy(cpLost) = 103.1668 × e^(−0.04354 × cpLost) − 3.1669
 * Clamped to [0, 100].
 */
const moveAccuracy = (cpLost) =>
  Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * cpLost) - 3.1669));

/**
 *
 */
const calcAccuracy = (moves) => {
  const valid = moves.filter((m) => m.cpLost !== null);
  if (!valid.length) return 100;
  const avg =
    valid.reduce((s, m) => s + moveAccuracy(m.cpLost), 0) / valid.length;
  return Math.round(Math.max(0, Math.min(100, avg)));
};

// ─── Main export ─────────────────────────────────────────────────────────────

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Analyze every position in a completed game.
 * @param {Array<{san,fen,from,to}>} moveHistory list of moves with SAN, resulting FEN, and from/to squares
 * @param {number} [depth] Stockfish depth per position
 */
export const analyzeFullGame = async (
  moveHistory,
  depth = 10,
  onProgress = null,
) => {
  if (!moveHistory || moveHistory.length < 2) return null;

  const sf = getStockfishEngine();

  // Positions to analyze: starting FEN + FEN after each move
  const fens = [STARTING_FEN, ...moveHistory.map((m) => m.fen)];
  const total = fens.length;

  // Analyze each FEN sequentially (engine is single-threaded)
  const engineResults = [];
  for (let index = 0; index < fens.length; index++) {
    try {
      const r = await sf.analyze(fens[index], depth, 1);
      engineResults.push(r);
    } catch {
      engineResults.push(null);
    }
    if (onProgress) onProgress(index + 1, total);
  }

  // Build per-move summaries
  const moveSummary = [];
  const evalHistory = [];

  // Starting eval (from White's perspective)
  const startRes = engineResults[0];
  const startScore = startRes
    ? clampEval(
        normalizeToWhite(
          startRes.scoreCp,
          startRes.isMate,
          startRes.mateIn,
          "w",
        ) / 100,
      )
    : 0;
  evalHistory.push({ moveIndex: 0, label: "Start", score: startScore });

  for (let index = 0; index < moveHistory.length; index++) {
    const { san, fen, from, to } = moveHistory[index];
    const side = index % 2 === 0 ? "w" : "b";
    const preFen = fens[index];
    const preTurn = side; // the player who just moved was side-to-move at preFen
    const postTurn = side === "w" ? "b" : "w";

    const preRes = engineResults[index];
    const postRes = engineResults[index + 1];

    // Score from White's perspective (in centipawns)
    const scoreBeforeWhiteCp = preRes
      ? normalizeToWhite(preRes.scoreCp, preRes.isMate, preRes.mateIn, preTurn)
      : null;
    const scoreAfterWhiteCp = postRes
      ? normalizeToWhite(
          postRes.scoreCp,
          postRes.isMate,
          postRes.mateIn,
          postTurn,
        )
      : null;

    // cpLost from the player's perspective
    let cpLost = null;
    if (scoreBeforeWhiteCp !== null && scoreAfterWhiteCp !== null) {
      const delta =
        side === "w"
          ? scoreBeforeWhiteCp - scoreAfterWhiteCp // white wants positive
          : scoreAfterWhiteCp - scoreBeforeWhiteCp; // black wants negative (i.e. after > before is bad for black)
      cpLost = Math.min(1000, Math.max(0, delta));
    }

    const quality = classifyMove(cpLost ?? 70); // default "Good" when unknown
    const bestSan = uciBestToSan(preFen, preRes?.bestMove);

    // Eval for graph: score after the move, from White's perspective
    const evalScore =
      scoreAfterWhiteCp !== null
        ? clampEval(scoreAfterWhiteCp / 100)
        : evalHistory[evalHistory.length - 1].score; // carry forward

    evalHistory.push({
      moveIndex: index + 1,
      label: `${Math.floor(index / 2) + 1}${side === "w" ? "." : "..."} ${san}`,
      score: evalScore,
      side,
    });

    moveSummary.push({
      san,
      fen, // FEN after the move
      preFen, // FEN before the move
      from,
      to,
      side,
      moveNum: Math.floor(index / 2) + 1, // 1-based full move number
      quality: quality.label,
      qualityEmoji: quality.emoji,
      qualityColor: quality.color,
      cpLost,
      bestSan,
      isError: quality.label === "Mistake" || quality.label === "Blunder",
    });
  }

  // Per-side stats
  const whiteMoves = moveSummary.filter((m) => m.side === "w");
  const blackMoves = moveSummary.filter((m) => m.side === "b");

  const whiteAccuracy = calcAccuracy(whiteMoves);
  const blackAccuracy = calcAccuracy(blackMoves);
  const whiteCounts = countQualities(whiteMoves);
  const blackCounts = countQualities(blackMoves);

  // Critical moment: move with largest cpLost above 100cp threshold
  let criticalMoveIndex = -1;
  let maxCp = 100;
  for (let index = 0; index < moveSummary.length; index++) {
    if ((moveSummary[index].cpLost ?? 0) > maxCp) {
      maxCp = moveSummary[index].cpLost;
      criticalMoveIndex = index;
    }
  }

  // Blunder/mistake queue for review (only if has a known best move)
  const blunders = moveSummary.filter((m) => m.isError && m.bestSan);

  return {
    moveSummary,
    evalHistory,
    white: { accuracy: whiteAccuracy, counts: whiteCounts },
    black: { accuracy: blackAccuracy, counts: blackCounts },
    criticalMoveIdx: criticalMoveIndex,
    blunders,
  };
};
