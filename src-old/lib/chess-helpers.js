import { Chess } from "chess.js";

// ── PV: UCI moves → SAN list ──────────────────────────────────────────────────
export const pvToSan = (fen, pvUci) => {
  try {
    const g = new Chess(fen);
    const sans = [];
    for (const uci of (pvUci || []).slice(0, 6)) {
      const mv = g.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      });
      if (!mv) break;
      sans.push(mv.san);
    }
    return sans;
  } catch {
    return [];
  }
};

// ── Format evaluation score ───────────────────────────────────────────────────
export const fmtScore = (scoreCp, isMate, mateIn, isWhiteToMove) => {
  if (isMate) {
    const wWins = mateIn > 0 === isWhiteToMove;
    return `Mate in ${Math.abs(mateIn)} — ${wWins ? "White" : "Black"} wins`;
  }
  if (scoreCp === null) return "—";
  const score = scoreCp / 100;
  const wScore = isWhiteToMove ? score : -score;
  const raw = wScore > 0 ? `+${wScore.toFixed(2)}` : wScore.toFixed(2);
  const abs = Math.abs(wScore);
  const who = wScore >= 0 ? "White" : "Black";
  const desc =
    abs < 0.25
      ? "equal"
      : abs < 0.75
        ? `slight ${who} edge`
        : abs < 2.0
          ? `${who} is better`
          : `${who} is clearly better`;
  return `${raw}  (${desc})`;
};

// ── Build multi-line analysis message ────────────────────────────────────────
export const buildAnalysisMessage = (result, fen) => {
  const { lines, scoreCp, isMate, mateIn } = result;
  const isWhite = new Chess(fen).turn() === "w";
  const scoreString = fmtScore(scoreCp, isMate, mateIn, isWhite);
  let out = `🔍 Position Analysis\n\nEvaluation: ${scoreString}\n`;
  if (lines.length > 0) {
    out += `\nTop line${lines.length > 1 ? "s" : ""}:\n`;
    const nums = ["①", "②", "③"];
    lines.slice(0, 3).forEach((l, index) => {
      const san = pvToSan(fen, l.pv);
      const sc = l.isMate
        ? `M${Math.abs(l.mateIn)}`
        : l.scoreCp !== null
          ? l.scoreCp >= 0
            ? `+${(l.scoreCp / 100).toFixed(1)}`
            : (l.scoreCp / 100).toFixed(1)
          : "";
      out += `${nums[index]}  ${san.slice(0, 4).join(" ")}  ${sc}\n`;
    });
  }
  return out.trim();
};

// ── Hint messages and piece context ──────────────────────────────────────────
export const HINT_MESSAGES = [
  "There's a stronger move hiding in plain sight — look again!",
  "The engine sees something you might have missed. Think about piece activity.",
  "One precisely-placed move changes the dynamic significantly here.",
  "Look for moves that create more than one threat simultaneously.",
  "Ask yourself: which piece is the least active? It might need to move.",
  "There's a resource in this position that strong players would spot quickly.",
  "Think about what your opponent fears most — then do that.",
  "Scan all forcing moves first: checks, captures, threats.",
  "Consider improving your worst-placed piece to its ideal square.",
  "A tempo-gaining move exists here. Can you find it?",
  "Look for a move that restricts your opponent's options.",
  "There's an underutilized piece waiting for its moment.",
  "Strong players always ask: what does the position demand? Find that move.",
  "A quiet move might be the most powerful option here — not everything is forcing.",
  "Before moving, check all your opponent's threats and find the most efficient response.",
];

export const HINT_PIECE_CONTEXTS = {
  p: [
    "A pawn push could open lines or gain space.",
    "Pawn moves often open diagonals for your pieces.",
    "That pawn has a purpose—find where it wants to go.",
  ],
  n: [
    "Your knight may have an outpost waiting for it.",
    "Knights love central squares — look for a strong jump.",
    "An active knight can dominate a position.",
  ],
  b: [
    "A bishop diagonal may be more powerful than it looks.",
    "Long diagonals are a bishop's best friend.",
    "Your bishop wants to be active on an open diagonal.",
  ],
  r: [
    "Rooks belong on open files or the seventh rank.",
    "Consider how your rook can become more active.",
    "A rook on an open file creates lasting pressure.",
  ],
  q: [
    "Your queen has a lot of potential energy here — unleash it.",
    "Look for where your queen creates multiple threats.",
    "Queen moves often combine attack with defence.",
  ],
  k: [
    "King safety matters — consider your king's position.",
    "A king move here could activate a 'rook behind' or escape a pin.",
    "In the endgame, your king is a powerful fighting piece.",
  ],
};

const PIECE_NAMES = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const TACTICAL_TAGS = [
  "Controls key square",
  "Activates a piece",
  "Creates multiple threats",
  "Improves piece harmony",
  "Gains space",
  "Prepares a passed pawn",
  "Threatens material",
  "Removes a defender",
  "Creates a pin",
  "Forks two pieces",
  "Opens a file",
  "Strengthens king safety",
  "Deflects a key defender",
  "Centralises the knight",
  "Seizes the initiative",
];

// ── Build best-move card ──────────────────────────────────────────────────────
export const buildBestMoveCard = (result, fen, messageSeed = 0) => {
  const { bestMove, scoreCp, isMate, mateIn, pv } = result;
  if (!bestMove) return null;
  const isWhite = new Chess(fen).turn() === "w";
  const san = pvToSan(fen, [bestMove]);
  const pvSan = pvToSan(fen, (pv || []).slice(0, 6));

  const wScore = isMate
    ? null
    : scoreCp !== null
      ? isWhite
        ? scoreCp / 100
        : -scoreCp / 100
      : null;
  const evalString = fmtScore(scoreCp, isMate, mateIn, isWhite);
  const tacticalTag = TACTICAL_TAGS[messageSeed % TACTICAL_TAGS.length];

  return {
    type: "best-move-card",
    moveSan: san[0] || bestMove,
    evalStr: evalString,
    wScore,
    line: pvSan,
    tacticalTag,
  };
};

// ── Build hint card (vague, no exact move revealed) ───────────────────────────
export const buildHintCard = (result, fen, messageSeed = 0) => {
  const { bestMove, scoreCp, isMate, mateIn } = result;
  const isWhite = new Chess(fen).turn() === "w";
  const evalString = fmtScore(scoreCp, isMate, mateIn, isWhite);

  const wScore = isMate
    ? null
    : scoreCp !== null
      ? isWhite
        ? scoreCp / 100
        : -scoreCp / 100
      : null;

  let pieceType = null;
  let fromSquare = null;
  let pieceContext = "";

  if (bestMove) {
    try {
      const g = new Chess(fen);
      const mv = g.move({
        from: bestMove.slice(0, 2),
        to: bestMove.slice(2, 4),
        promotion: bestMove[4],
      });
      if (mv) {
        pieceType = mv.piece;
        fromSquare = mv.from;
        const contextArray = HINT_PIECE_CONTEXTS[mv.piece] || [];
        pieceContext = contextArray[messageSeed % contextArray.length] || "";
      }
    } catch {
      /* ignore */
    }
  }

  const generalMessage = HINT_MESSAGES[messageSeed % HINT_MESSAGES.length];

  return {
    type: "hint-card",
    pieceType,
    pieceName: pieceType ? PIECE_NAMES[pieceType] : null,
    fromSquare,
    pieceContext,
    generalMsg: generalMessage,
    evalStr: evalString,
    wScore,
  };
};

// ── Build live analysis message (after each move) ─────────────────────────────
export const buildLiveAnalysisMessage = (result, fen, lastMoveSan) => {
  const { scoreCp, isMate, mateIn, pv } = result;
  const isWhite = new Chess(fen).turn() === "w";
  const scoreString = fmtScore(scoreCp, isMate, mateIn, isWhite);
  const pvSan = pvToSan(fen, (pv || []).slice(0, 4));
  let out = `⚙ After ${lastMoveSan}\n\nEvaluation: ${scoreString}`;
  if (pvSan.length > 0) out += `\nBest continuation: ${pvSan.join(" ")}`;
  return out;
};

// ── Migrate old move history format (string[]) to new ({ san, fen, from, to }[]) ──
export const migrateMoveHistory = (moves) => {
  if (!moves || moves.length === 0) return [];
  if (typeof moves[0] !== "string") return moves;
  const g = new Chess();
  return moves.map((san) => {
    try {
      const move = g.move(san);
      if (!move) return { san, fen: g.fen(), from: null, to: null };
      return { san: move.san, fen: g.fen(), from: move.from, to: move.to };
    } catch {
      return { san, fen: g.fen(), from: null, to: null };
    }
  });
};
