/**
 * Intelligence layer for Live Mode.
 *
 * Provides:
 *  • classifyPlayerMove  – rate a player's move vs Stockfish best, with ELO-aware suggestion
 *  • detectOpponentThreats – detect check / fork / hanging-piece after opponent's move
 *  • buildMyMoveCard  – structured data for the "my move" analysis card
 *  • buildThreatCard  – structured data for the "opponent threat" card
 */

import { Chess } from "chess.js";
import { detectOpening } from "./openings";

// ─── Move-quality thresholds (centipawns lost vs best) ──────────────────────
const QUALITY_LEVELS = [
  {
    max: 15,
    label: "Brilliant",
    emoji: "💎",
    color: "cyan",
    blurb: "top-engine  level",
  },
  {
    max: 30,
    label: "Excellent",
    emoji: "✨",
    color: "emerald",
    blurb: "very strong move",
  },
  {
    max: 70,
    label: "Good",
    emoji: "👍",
    color: "green",
    blurb: "solid choice",
  },
  {
    max: 150,
    label: "Inaccuracy",
    emoji: "⚠️",
    color: "yellow",
    blurb: "minor imprecision",
  },
  {
    max: 300,
    label: "Mistake",
    emoji: "❌",
    color: "orange",
    blurb: "significant error",
  },
  {
    max: Infinity,
    label: "Blunder",
    emoji: "💥",
    color: "red",
    blurb: "serious error",
  },
];

function classifyMove(cpLost) {
  // cpLost = best_score_before - score_after_player_move  (from player's perspective, cp)
  // Positive = player lost cp compared to best move
  for (const q of QUALITY_LEVELS) {
    if (cpLost <= q.max) return q;
  }
  return QUALITY_LEVELS[QUALITY_LEVELS.length - 1];
}

// ─── ELO label helpers ───────────────────────────────────────────────────────
function eloLabel(elo) {
  if (elo <= 600) return "a beginner";
  if (elo <= 900) return "a developing player";
  if (elo <= 1100) return "a club-level beginner";
  if (elo <= 1300) return "an intermediate player";
  if (elo <= 1500) return "a solid club player";
  if (elo <= 1800) return "an experienced club player";
  if (elo <= 2000) return "an expert";
  if (elo <= 2200) return "a candidate master";
  return "a master";
}

function targetEloLabel(elo) {
  // Suggest the next tier up (~200-300 above)
  const target = elo + 250;
  if (target <= 900) return "a developing player (≈900)";
  if (target <= 1100) return "a club-level player (≈1100)";
  if (target <= 1300) return "an intermediate (≈1300)";
  if (target <= 1500) return "a 1500-rated player";
  if (target <= 1800) return "an advanced club player (≈1800)";
  if (target <= 2000) return "an expert (≈2000)";
  return "a master-level player";
}

// ─── Varied messages — 20+ per category ─────────────────────────────────────

const BRILLIANT_MSGS = [
  "That's the engine's top choice — textbook precision!",
  "Engine-level move. You found exactly what Stockfish recommends 🔥",
  "Computer-perfect! This is the absolute best move in the position.",
  "You're thinking like a grandmaster. That's the #1 engine move!",
  "Spot on! Stockfish agrees with you completely.",
  "Elite-level accuracy. The engine is nodding its virtual head.",
  "You cracked the position open perfectly. That's the best possible move!",
];

const EXCELLENT_MSGS = [
  "Sharp play! That's extremely close to the engine's top pick.",
  "Very precise! Only a fraction off the computer's best.",
  "Excellent intuition — that's nearly the perfect move.",
  "Your chess radar is calibrated well. Excellent decision!",
  "Strong move! The engine approves of that choice.",
  "Very nice — you stayed in engine-optimal territory.",
  "That's the kind of move that wins games. Excellent!",
  "Near-perfect! You're reading the position beautifully.",
];

const GOOD_MSGS = [
  "Solid move — keeps the position healthy.",
  "Good choice! Nothing wrong with that play.",
  "Sensible and sound. You've got the right idea.",
  "Nice! That's a principled, good move.",
  "Good move — the position is still going your way.",
  "You played it safe and smart. Good!",
  "That works well. Solid chess fundamentals on display.",
  "Reasonable move. Your position is still very playable.",
  "Clean play — no complaints there!",
  "That's what a steady player does — good move.",
];

const INACCURACY_MSGS = [
  "Small slip — there was a slightly sharper option available.",
  "Playable, but the position tightened a bit. Check the suggestion!",
  "Minor inaccuracy — you left a bit of advantage on the table.",
  "Not wrong, just not quite optimal. There was a crisper continuation.",
  "The engine found a better path — worth studying!",
  "A small imprecision. Easy to miss, but worth learning from.",
  "That's playable, but a more precise move existed here.",
  "Imperceptibly off — a small inaccuracy. The position is still fine.",
  "You were close! Small imprecision, but recoverable.",
];

const MISTAKE_MSGS = [
  "That move gives away some of your advantage — take a look at the alternative.",
  "The engine flags this as a mistake. The position has shifted.",
  "Oops — this move lets the opponent equalize or push ahead.",
  "A real mistake here sadly. Worth replaying this moment.",
  "This move hurts your position. There was a much better option!",
  "The position wasn't as tough as it looked — the right move was available.",
  "Mistakes happen! Study the suggestion to see what you missed.",
  "That move hands over the initiative. There was a stronger defense.",
];

const BLUNDER_MSGS = [
  "Big blunder! The engine is shocked 😬 — check the better move below.",
  "Oh no — that move turns a winning position into trouble!",
  "Critical error. The best move was very different here.",
  "That blunder changes the game significantly. Study the engine line!",
  "Yikes! A tough blunder. These are the moments to learn the most from.",
  "The engine winces — that's a game-altering mistake. The right move was hiding in plain sight.",
  "Blunder alert! Take a moment to understand what the engine suggests.",
  "That's a blunder that changes the evaluation dramatically.",
];

function pickMsg(label, idx) {
  const map = {
    Brilliant: BRILLIANT_MSGS,
    Excellent: EXCELLENT_MSGS,
    Good: GOOD_MSGS,
    Inaccuracy: INACCURACY_MSGS,
    Mistake: MISTAKE_MSGS,
    Blunder: BLUNDER_MSGS,
  };
  const arr = map[label] || GOOD_MSGS;
  return arr[idx % arr.length];
}

// ─── Threat message templates ─────────────────────────────────────────────────

const THREAT_MSGS = {
  check: [
    "Your king is in check! Deal with it immediately.",
    "You're in check — every response must address the king's safety.",
    "Check! Your most urgent task is getting the king safe.",
    "The opponent put you in check. Respond carefully.",
    "Check! Limited options — find the safest escape or block.",
  ],
  fork: [
    "Watch out — your opponent just set up a fork! Multiple pieces are under threat.",
    "A fork lurks in the position. Multiple pieces need your attention.",
    "Danger! Your opponent's piece attacks two targets simultaneously.",
    "The opponent just forked you — decide which piece to save wisely.",
    "Fork alert! Two of your pieces are under simultaneous attack.",
    "Your opponent just pulled off a fork. Triage your pieces carefully.",
  ],
  hanging: [
    "You have a hanging piece — it can be captured for free!",
    "One of your pieces is undefended and under attack. Protect it!",
    "Careful — your opponent can win material. A piece is hanging.",
    "Material is at risk! Make sure you protect your hanging piece.",
    "Watch out — an undefended piece is being attacked. Don't ignore it!",
    "Free material for your opponent unless you act — a piece is hanging.",
    "Heads up: a loose piece is being targeted. Defend or move it!",
  ],
  discovered: [
    "Discovered attack! An unmasked piece is now threatening one of yours.",
    "Watch out for the discovered attack — a hidden attacker is now active.",
    "The opponent revealed a concealed threat by moving a blocking piece.",
    "Discovered attack in play — reassess which pieces are safe.",
  ],
  pin: [
    "A pin is on the board — one of your pieces can't move safely.",
    "Watch out: a piece is pinned and may be exploited.",
    "Your opponent has created a pin. Think carefully before moving that piece.",
    "Pin alert! A piece is immobilized — factor this into your plan.",
  ],
  skewer: [
    "Your opponent is setting up a skewer — a more valuable piece is lining up.",
    "Skewer threat! A high-value piece is exposed along a line.",
    "Watch out for the skewer — a valuable piece might be forced to move.",
  ],
  general: [
    "The opponent made a strong move. Assess the new threats carefully.",
    "Look closely at the position — something may be under attack.",
    "Take a moment to scan for threats after the opponent's move.",
    "Don't rush! Pause and scan the board for any newly created threats.",
    "The position has changed. Re-evaluate your pieces' safety.",
    "After every opponent move, check: what has changed? What's threatened?",
    "Good habit: always ask 'what does that move threaten?' before responding.",
  ],
};

function pickThreatMsg(type, idx) {
  const arr = THREAT_MSGS[type] || THREAT_MSGS.general;
  return arr[idx % arr.length];
}

// ─── Convert UCI best move to SAN ────────────────────────────────────────────

function uciBestMoveToSan(fen, uciMove) {
  if (!uciMove) return null;
  try {
    const g = new Chess(fen);
    const mv = g.move({
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove[4] || undefined,
    });
    return mv ? mv.san : null;
  } catch {
    return null;
  }
}

function pvToSan(fen, pvUci) {
  try {
    const g = new Chess(fen);
    const sans = [];
    for (const uci of (pvUci || []).slice(0, 5)) {
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
}

// ─── Normalize score to player's perspective (centipawns) ────────────────────
// scoreCp from Stockfish is always from side-to-move perspective.
// We flip it so it reflects the player color's perspective.

function scoreFromPerspective(scoreCp, isMate, mateIn, fenTurn, playerColor) {
  if (isMate) return null; // skip mate for cp delta
  if (scoreCp === null) return null;
  // fenTurn is the side to move in this FEN.
  // Stockfish gives cp from the side-to-move's perspective.
  // Normalize to "positive = good for WHITE".
  const fromWhite = fenTurn === "w" ? scoreCp : -scoreCp;
  // Then flip to player's perspective
  return playerColor === "w" ? fromWhite : -fromWhite;
}

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a structured "my move" analysis card after a player's move.
 *
 * @param {string}  preFen        FEN before the player moved
 * @param {string}  moveSan       SAN of the move played (e.g. "e4")
 * @param {object}  preResult     Stockfish analyze() result for preFen
 * @param {object}  postResult    Stockfish analyze() result for postFen
 * @param {number}  userElo       Player's self-reported ELO
 * @param {number}  msgSeed       Seed for picking varied messages
 * @returns {{ type: 'my-move-analysis', ... }}
 */
export function buildMyMoveCard(
  preFen,
  moveSan,
  preResult,
  postResult,
  userElo = 1000,
  msgSeed = 0,
) {
  const preTurn = new Chess(preFen).turn(); // color that just moved
  const playerColor = preTurn; // the player color who made the move

  // Best move from pre-position
  const bestUci = preResult?.bestMove;
  const bestSan = uciBestMoveToSan(preFen, bestUci);
  const bestPvSan = pvToSan(preFen, preResult?.pv?.slice(0, 5) || []);

  // Played move is the same as best? (within SAN comparison)
  const playedIsBest = bestSan && bestSan === moveSan;

  // Score before (from player perspective, cp)
  const scoreBefore = scoreFromPerspective(
    preResult?.scoreCp,
    preResult?.isMate,
    preResult?.mateIn,
    preTurn,
    playerColor,
  );

  // Score after from player's perspective (post FEN, side-to-move is opponent now)
  const postFenTurn = preTurn === "w" ? "b" : "w";
  const scoreAfterRaw = scoreFromPerspective(
    postResult?.scoreCp,
    postResult?.isMate,
    postResult?.mateIn,
    postFenTurn,
    playerColor,
  );

  // cpLost = how much worse the player's move was compared to best
  // scoreBefore is "if I play best move, I get X"
  // scoreAfterRaw is "after I played my move, position is Y (from my perspective)"
  // cpLost = scoreBefore - scoreAfterRaw  (positive means player played worse)
  let cpLost = null;
  if (scoreBefore !== null && scoreAfterRaw !== null) {
    cpLost = scoreBefore - scoreAfterRaw;
  }

  const quality =
    cpLost !== null ? classifyMove(Math.max(0, cpLost)) : QUALITY_LEVELS[2]; // default Good

  const msg = pickMsg(quality.label, msgSeed);

  // Format eval
  const evalAfterRaw = postResult?.isMate
    ? null
    : postResult?.scoreCp !== null
      ? (() => {
          const fromWhite =
            postFenTurn === "w" ? postResult.scoreCp : -postResult.scoreCp;
          return fromWhite / 100;
        })()
      : null;

  const evalAfter = postResult?.isMate
    ? `Mate in ${Math.abs(postResult.mateIn)}`
    : evalAfterRaw !== null
      ? evalAfterRaw > 0
        ? `+${evalAfterRaw.toFixed(2)}`
        : `${evalAfterRaw.toFixed(2)}`
      : null;

  // Alternative suggestion (only when move wasn't best)
  let suggestion = null;
  if (
    !playedIsBest &&
    bestSan &&
    (quality.label === "Inaccuracy" ||
      quality.label === "Mistake" ||
      quality.label === "Blunder")
  ) {
    suggestion = {
      bestMove: bestSan,
      line: bestPvSan.slice(1), // continuation after best move
      eloContext: `This is the move ${targetEloLabel(userElo)} would find.`,
    };
  } else if (!playedIsBest && bestSan && quality.label === "Good") {
    // For "Good" moves, show best as bonus info
    suggestion = {
      bestMove: bestSan,
      line: bestPvSan.slice(1),
      eloContext: `Alternative: what ${targetEloLabel(userElo)} would consider.`,
    };
  }

  return {
    type: "my-move-analysis",
    moveSan,
    quality: quality.label,
    qualityEmoji: quality.emoji,
    qualityColor: quality.color,
    message: msg,
    evalAfter,
    evalAfterRaw,
    cpLost: cpLost !== null ? Math.round(Math.max(0, cpLost)) : null,
    suggestion,
    userEloLabel: eloLabel(userElo),
  };
}

// ─── Threat detection helpers ─────────────────────────────────────────────────

/**
 * Get squares attacked by a given piece at a given square.
 * Uses chess.js moves() in a temporary game.
 */
function getAttackedSquares(game, square) {
  const piece = game.get(square);
  if (!piece) return [];
  // Get all moves for this piece (including captures of own pieces hack)
  const tempGame = new Chess(game.fen());
  const moves = tempGame.moves({ square, verbose: true });
  return moves.map((m) => m.to);
}

/**
 * Check if a square is attacked by the given color.
 */
function isSquareAttackedBy(game, square, attackerColor) {
  // chess.js doesn't directly expose isAttacked; we check all pieces of attackerColor
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq || sq.color !== attackerColor) continue;
      const file = String.fromCharCode(97 + c);
      const rank = 8 - r;
      const fromSq = `${file}${rank}`;
      const attacked = getAttackedSquares(game, fromSq);
      if (attacked.includes(square)) return true;
    }
  }
  return false;
}

/**
 * Find hanging pieces for the given color (pieces attacked and not adequately defended).
 */
function findHangingPieces(game, victimColor) {
  const attacker = victimColor === "w" ? "b" : "w";
  const board = game.board();
  const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const hanging = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq || sq.color !== victimColor || sq.type === "k") continue;
      const file = String.fromCharCode(97 + c);
      const rank = 8 - r;
      const square = `${file}${rank}`;

      if (isSquareAttackedBy(game, square, attacker)) {
        // Check if defended
        if (!isSquareAttackedBy(game, square, victimColor)) {
          hanging.push({
            square,
            piece: sq.type,
            value: PIECE_VALUES[sq.type] || 0,
          });
        }
      }
    }
  }

  // Sort by value (highest first)
  return hanging.sort((a, b) => b.value - a.value);
}

/**
 * Detect if opponent's last move created a fork (one piece attacks 2+ enemy pieces).
 * Returns the forking piece info if found.
 */
function detectFork(game, opponentColor, lastMoveTo) {
  if (!lastMoveTo) return null;
  const victimColor = opponentColor === "w" ? "b" : "w";
  const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

  const sq = game.get(lastMoveTo);
  if (!sq || sq.color !== opponentColor) return null;

  // Get all squares attacked by the piece that just moved
  const attacked = getAttackedSquares(game, lastMoveTo);

  // Filter to valuable victim pieces
  const targets = attacked.filter((s) => {
    const p = game.get(s);
    return p && p.color === victimColor && PIECE_VALUES[p.type] >= 3;
  });

  if (targets.length >= 2) {
    return {
      forkingPiece: sq.type,
      forkingSquare: lastMoveTo,
      targets: targets.map((s) => {
        const p = game.get(s);
        return { square: s, piece: p.type };
      }),
    };
  }
  return null;
}

/**
 * Piece names for display
 */
const PIECE_NAMES = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

// ──────────────────────────────────────────────────────────────────────────────

// ─── Pin / Skewer detection ───────────────────────────────────────────────────

const ROOK_DIRS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const SLIDER_DIRS = { r: ROOK_DIRS, b: BISHOP_DIRS, q: QUEEN_DIRS };
const SLIDER_TYPES = new Set(["r", "b", "q"]);
const PIN_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/**
 * Scan all opponent sliding pieces along rays looking for:
 *   • Absolute / relative pins: slider → player's piece (lower value) → player's piece (higher value incl. king)
 *   • Skewers:                  slider → player's high-value piece → player's piece (any)
 *
 * Returns { pins: PinInfo[], skewers: SkewInfo[] }
 */
function detectPinsAndSkewers(game, opponentColor) {
  const playerColor = opponentColor === "w" ? "b" : "w";
  const board = game.board();
  const pins = [];
  const skewers = [];

  const sqName = (r, c) => `${String.fromCharCode(97 + c)}${8 - r}`;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq || sq.color !== opponentColor || !SLIDER_TYPES.has(sq.type))
        continue;

      const dirs = SLIDER_DIRS[sq.type];
      for (const [dr, dc] of dirs) {
        let pr = r + dr,
          pc = c + dc;
        let firstPiece = null,
          firstSq = null;

        while (pr >= 0 && pr < 8 && pc >= 0 && pc < 8) {
          const target = board[pr][pc];
          if (target) {
            if (target.color === playerColor) {
              if (!firstPiece) {
                firstPiece = target;
                firstSq = sqName(pr, pc);
              } else {
                // second player piece found
                const fv = PIN_VALUES[firstPiece.type] ?? 0;
                const sv = PIN_VALUES[target.type] ?? 0;
                if (fv < sv) {
                  // pin: first is less valuable — can't move without exposing second
                  pins.push({
                    attackerSquare: sqName(r, c),
                    attackerPiece: sq.type,
                    pinnedSquare: firstSq,
                    pinnedPiece: firstPiece.type,
                    pinnedAgainst: target.type,
                    pinnedAgainstSquare: sqName(pr, pc),
                  });
                } else if (fv >= sv && fv >= 5) {
                  // skewer: first is higher-value (major piece), forced to move
                  skewers.push({
                    attackerSquare: sqName(r, c),
                    attackerPiece: sq.type,
                    skeweredSquare: firstSq,
                    skeweredPiece: firstPiece.type,
                    collateralSquare: sqName(pr, pc),
                    collateralPiece: target.type,
                  });
                }
                break;
              }
            } else {
              break; // own piece blocks the ray
            }
          }
          pr += dr;
          pc += dc;
        }
      }
    }
  }
  return { pins, skewers };
}

/**
 * Analyze threats after the opponent's move and build a threat card.
 *
 * @param {Chess}    game            chess.js game instance (position after opponent's move)
 * @param {string}   opponentColor   'w' | 'b'
 * @param {string}   lastMoveTo      UCI "to" square of the opponent's last move
 * @param {string}   opponentMoveSan SAN of the opponent's last move
 * @param {number}   msgSeed         Seed for varied messages
 * @param {string[]} moveHistory     Full SAN move history including the opponent's last move
 * @returns {{ type: 'threat-card', ... } | null}
 */
export function buildThreatCard(
  game,
  opponentColor,
  lastMoveTo,
  opponentMoveSan,
  msgSeed = 0,
  moveHistory = [],
) {
  const playerColor = opponentColor === "w" ? "b" : "w";
  const threats = [];

  // ── Opening detection ────────────────────────────────────────────────────
  // Identify if we're still in known opening theory so we can offer learning.
  const opening = detectOpening(moveHistory);
  const knownPattern = opening
    ? {
        type: "opening",
        name: opening.name,
        eco: opening.eco,
        category: opening.category,
        idea: opening.idea,
      }
    : null;

  // 1. Check
  if (game.inCheck()) {
    const threat = {
      id: "check",
      name: "Check",
      icon: "⚡",
      description: pickThreatMsg("check", msgSeed),
      severity: "critical",
    };
    return {
      type: "threat-card",
      opponentMoveSan,
      primaryThreat: threat,
      allThreats: [threat],
      knownPattern,
      hasLearnButton: !!knownPattern,
      hasAiButton: true,
    };
  }

  // 2. Fork
  const fork = detectFork(game, opponentColor, lastMoveTo);
  if (fork) {
    const targetNames = fork.targets
      .map((t) => `${PIECE_NAMES[t.piece]} on ${t.square}`)
      .join(" and ");
    threats.push({
      id: "fork",
      name: `${PIECE_NAMES[fork.forkingPiece]} Fork`,
      icon: "⚔️",
      description: `${pickThreatMsg("fork", msgSeed)} The ${PIECE_NAMES[fork.forkingPiece].toLowerCase()} on ${fork.forkingSquare} attacks your ${targetNames}.`,
      severity: "high",
    });
  }

  // 3. Hanging pieces
  const hanging = findHangingPieces(game, playerColor);
  if (hanging.length > 0) {
    const main = hanging[0];
    threats.push({
      id: "hanging",
      name: `Hanging ${PIECE_NAMES[main.piece]}`,
      icon: "🎯",
      description: `${pickThreatMsg("hanging", (msgSeed + 1) % 6)} Your ${PIECE_NAMES[main.piece].toLowerCase()} on ${main.square} is undefended and under attack.`,
      severity: hanging[0].value >= 5 ? "high" : "medium",
    });
  }

  // 4. Pins
  const { pins, skewers } = detectPinsAndSkewers(game, opponentColor);
  if (pins.length > 0) {
    const p = pins[0];
    const isAbsolute = p.pinnedAgainst === "k";
    threats.push({
      id: "pin",
      name: `${PIECE_NAMES[p.attackerPiece]} Pin`,
      icon: "📌",
      description: `${pickThreatMsg("pin", msgSeed)} Your ${PIECE_NAMES[p.pinnedPiece].toLowerCase()} on ${p.pinnedSquare} is pinned${isAbsolute ? " to your king" : ` against your ${PIECE_NAMES[p.pinnedAgainst].toLowerCase()}`} by the ${PIECE_NAMES[p.attackerPiece].toLowerCase()} on ${p.attackerSquare}.`,
      severity: isAbsolute ? "high" : "medium",
      highlightSquares: [p.pinnedSquare, p.attackerSquare],
    });
  }

  // 5. Skewers
  if (skewers.length > 0) {
    const s = skewers[0];
    threats.push({
      id: "skewer",
      name: `${PIECE_NAMES[s.attackerPiece]} Skewer`,
      icon: "⚡",
      description: `${pickThreatMsg("skewer", msgSeed)} Your ${PIECE_NAMES[s.skeweredPiece].toLowerCase()} on ${s.skeweredSquare} is being skewered — if it moves, your ${PIECE_NAMES[s.collateralPiece].toLowerCase()} on ${s.collateralSquare} could be taken.`,
      severity: "high",
      highlightSquares: [s.skeweredSquare, s.attackerSquare],
    });
  }

  // No threats — nothing to show, regardless of opening context.
  if (threats.length === 0) return null;

  // ── Tag as a known pattern only when a threat actually exists ────────────
  // Opening context: the game is in a known opening line.
  // Tactical context: fork / pin / skewer (always worth learning about).
  const effectivePattern =
    knownPattern ??
    (threats.some((t) => t.id === "fork")
      ? {
          type: "tactical",
          name: "Fork Tactic",
          eco: null,
          category: "tactical",
          idea: "A fork attacks two or more of your pieces at once, forcing a difficult choice about which piece to save. Learning to spot forks before they land is essential for every chess player.",
        }
      : threats.some((t) => t.id === "pin")
        ? {
            type: "tactical",
            name: "Pin Tactic",
            eco: null,
            category: "tactical",
            idea: "A pin immobilizes a piece because moving it would expose a more valuable piece behind it (often the king). Recognizing and breaking pins is a critical defensive skill.",
          }
        : threats.some((t) => t.id === "skewer")
          ? {
              type: "tactical",
              name: "Skewer Tactic",
              eco: null,
              category: "tactical",
              idea: "A skewer is like a reversed pin: a valuable piece is attacked and forced to move, exposing a less valuable piece behind it. Similar to a pin but targeting the more valuable piece first.",
            }
          : null);

  return {
    type: "threat-card",
    opponentMoveSan,
    primaryThreat: threats[0],
    allThreats: threats,
    knownPattern: effectivePattern,
    hasLearnButton: !!effectivePattern,
    hasAiButton: true,
  };
}
