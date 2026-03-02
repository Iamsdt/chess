import { Chess } from "chess.js";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";

import BlunderReviewMode from "@/components/blunder-review-mode";
import BoardPanel, { playSound } from "@/components/board-panel";
import ChatPanel from "@/components/chat-panel";
import ControlBar from "@/components/control-bar";
import EndgameMode from "@/components/endgame-mode";
import GameReportDialog from "@/components/game-report-dialog";
import MoveHistorySidebar from "@/components/move-history-sidebar";
import OpeningDrillMode from "@/components/opening-drill-mode";
import OpeningStatsPanel from "@/components/opening-stats-panel";
import PositionSetupDialog from "@/components/position-setup-dialog";
import PuzzleMode from "@/components/puzzle-mode";
import SavedGamesDialog from "@/components/saved-games-dialog";
import SettingsDialog from "@/components/settings-dialog";
import { useChessClock, TIME_CONTROLS } from "@/hooks/use-chess-clock";
import {
  sendChatMessage,
  explainPosition,
  getHint,
  evaluateMove,
} from "@/lib/ai";
import { analyzeFullGame } from "@/lib/analyzer";
import { autoSave, loadAutoSave } from "@/lib/db";
import { getBestMove } from "@/lib/engine";
import { buildMyMoveCard, buildThreatCard } from "@/lib/intelligence";
import { OPENINGS } from "@/lib/openings";
import { recordOpeningResult, detectOpening } from "@/lib/openingStats";
import {
  getStockfishEngine,
  destroyStockfishEngine,
  StockfishEngine,
} from "@/lib/stockfish";
import useGameStore from "@/store/use-game-store";
// ── Stockfish analysis formatting helpers ─────────────────────────────────────

/**
 *
 */
const pvToSan = (fen, pvUci) => {
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

/**
 *
 */
const fmtScore = (scoreCp, isMate, mateIn, isWhiteToMove) => {
  if (isMate) {
    const wWins = mateIn > 0 === isWhiteToMove;
    return `Mate in ${Math.abs(mateIn)} — ${wWins ? "White" : "Black"} wins`;
  }
  if (scoreCp === null) return "—";
  const score = scoreCp / 100;
  const wScore = isWhiteToMove ? score : -score; // normalize to White perspective
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

/**
 *
 */
const buildAnalysisMessage = (result, fen) => {
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

// Varied hint messages (piece-agnostic, so they work for any piece)
const HINT_MESSAGES = [
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

const HINT_PIECE_CONTEXTS = {
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

/**
 *
 */
const buildBestMoveCard = (result, fen, messageSeed = 0) => {
  const { bestMove, scoreCp, isMate, mateIn, pv } = result;
  if (!bestMove) return null;
  const isWhite = new Chess(fen).turn() === "w";
  const san = pvToSan(fen, [bestMove]);
  const pvSan = pvToSan(fen, (pv || []).slice(0, 6));

  // White-perspective score normalised
  const wScore = isMate
    ? null
    : scoreCp !== null
      ? isWhite
        ? scoreCp / 100
        : -scoreCp / 100
      : null;
  const evalString = fmtScore(scoreCp, isMate, mateIn, isWhite);

  // Tactical tags
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

/**
 *
 */
const buildHintCard = (result, fen, messageSeed = 0) => {
  const { bestMove, scoreCp, isMate, mateIn } = result;
  const isWhite = new Chess(fen).turn() === "w";
  const evalString = fmtScore(scoreCp, isMate, mateIn, isWhite);

  // White-perspective score
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

  const PIECE_NAMES = {
    p: "Pawn",
    n: "Knight",
    b: "Bishop",
    r: "Rook",
    q: "Queen",
    k: "King",
  };
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

/**
 *
 */
const buildLiveAnalysisMessage = (result, fen, lastMoveSan) => {
  const { scoreCp, isMate, mateIn, pv } = result;
  const isWhite = new Chess(fen).turn() === "w";
  const scoreString = fmtScore(scoreCp, isMate, mateIn, isWhite);
  const pvSan = pvToSan(fen, (pv || []).slice(0, 4));
  let out = `⚙ After ${lastMoveSan}\n\nEvaluation: ${scoreString}`;
  if (pvSan.length > 0) out += `\nBest continuation: ${pvSan.join(" ")}`;
  return out;
};

// Migrate old moveHistory (string[]) to new shape ({ san, fen, from, to }[])
/**
 *
 */
const migrateMoveHistory = (moves) => {
  if (!moves || moves.length === 0) return [];
  if (typeof moves[0] !== "string") return moves; // already new format
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

/**
 *
 */
const App = () => {
  const gameReference = useRef(new Chess());
  const [fen, setFen] = useState(gameReference.current.fen());
  const [messages, setMessages] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]); // { san, fen, from, to }[]
  const [viewIndex, setViewIndex] = useState(null); // null = live, -1 = start, 0..n-1 = historical
  const viewIndexReference = useRef(null);
  useEffect(() => {
    viewIndexReference.current = viewIndex;
  }, [viewIndex]);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [moveQuality, setMoveQuality] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastMoveSquares, setLastMoveSquares] = useState(null);
  const [evalScore, setEvalScore] = useState(null); // White-perspective score (cp/100)
  const [boardOrientation, setBoardOrientation] = useState("white");

  // ---- Opponent / difficulty ----
  const [opponent, setOpponent] = useState("engine"); // manual | ai | engine
  const [difficulty, setDifficulty] = useState("medium"); // easy | medium | hard

  // ---- Player color (which side the human plays) ----
  const [playerColor, setPlayerColor] = useState("white"); // "white" | "black"
  const playerColorReference = useRef(playerColor);
  useEffect(() => {
    playerColorReference.current = playerColor;
  }, [playerColor]);
  const [isAIThinking, setIsAIThinking] = useState(false);

  // ── Review mode: derive displayGame and displayLastMoveSquares ──────────
  const displayGame = useMemo(() => {
    if (viewIndex === null) return gameReference.current;
    const g = new Chess();
    if (viewIndex < 0) return g; // starting position
    const entry = moveHistory[viewIndex];
    if (entry?.fen) g.load(entry.fen);
    return g;
  }, [viewIndex, moveHistory]);

  const displayLastMoveSquares = useMemo(() => {
    if (viewIndex === null) return lastMoveSquares;
    if (viewIndex < 0) return null;
    const entry = moveHistory[viewIndex];
    return entry ? { from: entry.from, to: entry.to } : null;
  }, [viewIndex, moveHistory, lastMoveSquares]);
  const aiTimeoutReference = useRef(null);

  // ---- Saved games dialog ----
  const [savedGamesOpen, setSavedGamesOpen] = useState(false);
  const autoSaveTimerReference = useRef(null);

  // ---- Position setup dialog (FEN/PGN import) ----
  const [positionSetupOpen, setPositionSetupOpen] = useState(false);

  // ---- Best move arrows (shown on board) ----
  const [bestMoveArrows, setBestMoveArrows] = useState([]);

  // ---- Post-game full analysis ----
  const [gameReport, setGameReport] = useState(null);
  const [gameReportOpen, setGameReportOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [blunderReviewOpen, setBlunderReviewOpen] = useState(false);
  const isAnalyzingReference = useRef(false);

  // ---- Training modes ----
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [openingDrillOpen, setOpeningDrillOpen] = useState(false);
  const [endgameOpen, setEndgameOpen] = useState(false);
  const [openingStatsOpen, setOpeningStatsOpen] = useState(false);

  // ---- Chess clock ----
  const [clockEnabled, setClockEnabled] = useState(false);
  const [clockTimeControl, setClockTimeControl] = useState(TIME_CONTROLS[2]); // Blitz 3+2

  // ---- Annotations: { [moveIndex]: string } ----
  const [annotations, setAnnotations] = useState({});

  // ---- Premove: { from, to, promotion, piece } | null ----
  const [premove, setPremove] = useState(null);
  const premoveReference = useRef(null);
  // Keep premoveRef in sync
  useEffect(() => {
    premoveReference.current = premove;
  }, [premove]);

  // ---- Coach mode ----
  const [coachMode, setCoachMode] = useState("engine"); // "engine" | "ai"
  const coachModeReference = useRef(coachMode);
  useEffect(() => {
    coachModeReference.current = coachMode;
  }, [coachMode]);
  const isLiveModeReference = useRef(isLiveMode);
  useEffect(() => {
    isLiveModeReference.current = isLiveMode;
  }, [isLiveMode]);

  // ---- Chess clock hook ----
  const clock = useChessClock({
    enabled: clockEnabled,
    timeControlMs: clockTimeControl?.time ?? 180000,
    incrementMs: clockTimeControl?.inc ?? 2000,
    currentTurn: gameReference.current.turn(),
    isGameOver: gameReference.current.isGameOver(),
    isReviewMode: viewIndex !== null,
  });
  const clockReference = useRef(clock);
  useEffect(() => {
    clockReference.current = clock;
  });

  // ── Auto-load last auto-save on first mount ─────────────────────────────
  useEffect(() => {
    loadAutoSave()
      .then((saved) => {
        if (!saved?.pgn || !saved?.moveHistory?.length) return;
        try {
          const game = new Chess();
          game.loadPgn(saved.pgn);
          gameReference.current = game;
          setFen(game.fen());
          setMoveHistory(migrateMoveHistory(saved.moveHistory));
          if (saved.boardOrientation) {
            setBoardOrientation(saved.boardOrientation);
          }
          if (saved.opponent) setOpponent(saved.opponent);
          if (saved.difficulty) setDifficulty(saved.difficulty);
          if (saved.playerColor) setPlayerColor(saved.playerColor);
          const hist = game.history({ verbose: true });
          if (hist.length > 0) {
            const last = hist[hist.length - 1];
            setLastMoveSquares({ from: last.from, to: last.to });
          }
          // Trigger eval bar once engine is ready
          setTimeout(() => {
            const sf = getStockfishEngine();
            sf.analyze(game.fen(), 10, 1)
              .then((result) => applyEvalScore(result, game.fen()))
              .catch(() => {});
          }, 800);
        } catch (e) {
          console.error("Failed to restore auto-save:", e);
        }
      })
      .catch(console.error);
  }, []);

  // ── Auto-save after every move (debounced 500 ms) ──────────────────────
  useEffect(() => {
    if (moveHistory.length === 0) return;
    if (autoSaveTimerReference.current) {
      clearTimeout(autoSaveTimerReference.current);
    }
    autoSaveTimerReference.current = setTimeout(() => {
      autoSave({
        fen: gameReference.current.fen(),
        pgn: gameReference.current.pgn(),
        moveHistory,
        opponent,
        difficulty,
        boardOrientation,
        playerColor,
        name: `Auto-save · ${moveHistory.length} moves`,
      }).catch(console.error);
    }, 500);
  }, [fen, moveHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load a saved game snapshot ──────────────────────────────────────────
  const handleLoadGame = useCallback((saved) => {
    if (aiTimeoutReference.current) clearTimeout(aiTimeoutReference.current);
    destroyStockfishEngine();
    try {
      const game = new Chess();
      if (saved.pgn) {
        game.loadPgn(saved.pgn);
      } else if (saved.fen) {
        game.load(saved.fen);
      }
      gameReference.current = game;
      setFen(game.fen());
      setMoveHistory(migrateMoveHistory(saved.moveHistory || []));
      setMoveQuality(null);
      setMessages([]);
      setIsAIThinking(false);
      setEvalScore(null);
      setGameReport(null);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setBlunderReviewOpen(false);
      isAnalyzingReference.current = false;
      setPremove(null);
      premoveReference.current = null;
      setAnnotations({});
      if (saved.boardOrientation) setBoardOrientation(saved.boardOrientation);
      if (saved.opponent) setOpponent(saved.opponent);
      if (saved.difficulty) setDifficulty(saved.difficulty);
      if (saved.playerColor) setPlayerColor(saved.playerColor);
      const hist = game.history({ verbose: true });
      if (hist.length > 0) {
        const last = hist[hist.length - 1];
        setLastMoveSquares({ from: last.from, to: last.to });
      } else {
        setLastMoveSquares(null);
      }
      const loadedFen = game.fen();
      setTimeout(() => {
        const sf = getStockfishEngine();
        sf.analyze(loadedFen, 10, 1)
          .then((result) => applyEvalScore(result, loadedFen))
          .catch(() => {});
      }, 500);
    } catch (e) {
      console.error("Failed to load saved game:", e);
    }
  }, []);

  // ── Build a snapshot of current game for saving ─────────────────────────
  const getCurrentSnapshot = useCallback(
    () => ({
      fen: gameReference.current.fen(),
      pgn: gameReference.current.pgn(),
      moveHistory,
      opponent,
      difficulty,
      boardOrientation,
      playerColor,
    }),
    [moveHistory, opponent, difficulty, boardOrientation, playerColor],
  );

  // ---- Intelligence layer ----
  const messageSeedReference = useRef(0);
  const getElo = () =>
    parseInt(localStorage.getItem("chess-coach-elo") || "1000", 10);

  const getApiKey = () => localStorage.getItem("chess-coach-api-key") || "";
  const getModel = () =>
    localStorage.getItem("chess-coach-model") || "gpt-4o-mini";

  // ---- Trigger AI response after a human move ----
  const triggerAIMove = useCallback(
    async (currentFen, currentHistory) => {
      if (aiTimeoutReference.current) clearTimeout(aiTimeoutReference.current);
      setIsAIThinking(true);

      const executeMove = async () => {
        try {
          const game = gameReference.current;
          if (game.fen() !== currentFen) return; // stale

          let uciFrom, uciTo, uciPromotion;

          if (opponent === "engine") {
            // ── Real Stockfish (UCI) ──────────────────────────────────────
            const sf = getStockfishEngine();
            const uciMove = await sf.getMove(currentFen, difficulty);
            if (!uciMove) return;
            const parsed = StockfishEngine.uciToMove(uciMove);
            if (!parsed) return;
            uciFrom = parsed.from;
            uciTo = parsed.to;
            uciPromotion = parsed.promotion;
          } else {
            // ── Minimax AI ───────────────────────────────────────────────
            const san = getBestMove(currentFen, difficulty);
            if (!san) return;
            // Convert SAN to from/to via chess.js
            const temporaryGame = new Chess(currentFen);
            const move = temporaryGame.move(san);
            if (!move) return;
            uciFrom = move.from;
            uciTo = move.to;
            uciPromotion = move.promotion;
          }

          // Re-check the game hasn't changed while we were thinking
          if (game.fen() !== currentFen) return;

          const move = game.move({
            from: uciFrom,
            to: uciTo,
            promotion: uciPromotion,
          });
          if (!move) return;

          const newHistory = [
            ...currentHistory,
            { san: move.san, fen: game.fen(), from: move.from, to: move.to },
          ];
          setFen(game.fen());
          setMoveHistory(newHistory);
          setLastMoveSquares({ from: move.from, to: move.to });
          clockReference.current.addIncrement(move.color);

          if (game.isCheckmate() || game.isStalemate() || game.isDraw()) {
            playSound("end");
            // Record opening stats
            const gameResult = game.isCheckmate()
              ? move.color // color that just moved (checkmated the king) is the winner
              : "d";
            const openingMatch = detectOpening(
              newHistory.map((m) => m.san),
              OPENINGS,
            );
            if (openingMatch) {
              recordOpeningResult({
                eco: openingMatch.eco,
                name: openingMatch.name,
                gameResult,
                playerColor: playerColorReference.current[0],
              });
            }
            // Snapshot history for analysis (wait for Stockfish to be freed)
            const snapshot = newHistory;
            setTimeout(() => triggerPostGameAnalysis(snapshot), 1200);
          } else if (game.inCheck()) {
            playSound("check");
          } else if (move.captured) {
            playSound("capture");
          } else {
            playSound("move");
          }

          // Live analysis after engine/AI move
          if (
            isLiveModeReference.current &&
            coachModeReference.current === "engine"
          ) {
            // Update eval bar with quick analysis
            updateEvalBar(game.fen());
            // Detect threats for the player (from opponent's perspective)
            const opponentClr = move.color; // color that just moved (the engine)
            runThreatDetection(
              game,
              opponentClr,
              move.to,
              move.san,
              newHistory.map((m) => m.san),
            );
          } else {
            updateEvalBar(game.fen()); // always keep eval bar live
            if (
              isLiveModeReference.current &&
              coachModeReference.current === "ai" &&
              getApiKey()
            ) {
              evaluateLastMove(
                move.san,
                game.fen(),
                newHistory.map((m) => m.san),
              );
            }
          }
        } catch (e) {
          console.error("Engine move error:", e);
        } finally {
          setIsAIThinking(false);
          // Execute queued premove (if any and game is not over)
          const pm = premoveReference.current;
          if (pm && !gameReference.current.isGameOver()) {
            setPremove(null);
            premoveReference.current = null;
            setTimeout(
              () => handleMoveReference.current?.(pm.from, pm.to, pm.piece),
              60,
            );
          }
        }
      };

      // Small delay for AI/minimax; Stockfish manages own timing
      if (opponent === "engine") {
        executeMove();
      } else {
        aiTimeoutReference.current = setTimeout(executeMove, 400);
      }
    },
    [difficulty, opponent],
  );

  // ---- Handle player-color change (only before game starts) ----
  const handlePlayerColorChange = useCallback(
    (color) => {
      if (moveHistory.length > 0) return; // locked once game is in progress
      setPlayerColor(color);
      setBoardOrientation(color);
      // If player chose Black and has an opponent, let engine play first (as White)
      if (color === "black" && opponent !== "manual") {
        setTimeout(() => triggerAIMove(gameReference.current.fen(), []), 150);
      }
    },
    [moveHistory.length, opponent, triggerAIMove],
  );

  // ---- Review mode navigation ----
  const handleJumpToMove = useCallback((index) => {
    setViewIndex(index);
  }, []);

  const handleExitReview = useCallback(() => {
    setViewIndex(null);
  }, []);

  const handleNavigateBack = useCallback(() => {
    setViewIndex((previous) => {
      if (previous === null) {
        return moveHistory.length > 0 ? moveHistory.length - 1 : null;
      }
      return previous > 0 ? previous - 1 : -1;
    });
  }, [moveHistory.length]);

  const handleNavigateForward = useCallback(() => {
    setViewIndex((previous) => {
      if (previous === null) return null;
      const next = previous + 1;
      return next >= moveHistory.length ? null : next; // null = back to live at end
    });
  }, [moveHistory.length]);

  // ---- Keyboard navigation (arrow keys) ----
  useEffect(() => {
    /**
     *
     */
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleNavigateBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNavigateForward();
      } else if (e.key === "Escape" && viewIndexReference.current !== null) {
        handleExitReview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNavigateBack, handleNavigateForward, handleExitReview]);

  // ---- Make a move on the board ----
  const handleMove = useCallback(
    (sourceSquare, targetSquare, piece) => {
      const game = gameReference.current;
      let move = null;
      const preFen = game.fen(); // capture before move for intelligence analysis

      // Block moves while reviewing history
      if (viewIndexReference.current !== null) return null;

      // If it's not the player's turn in non-manual mode → queue as premove
      if (
        opponent !== "manual" &&
        game.turn() !== playerColorReference.current[0]
      ) {
        const sourcePiece = game.get(sourceSquare);
        if (
          sourcePiece &&
          sourcePiece.color === playerColorReference.current[0]
        ) {
          let promotion = undefined;
          if (piece) {
            const isPawn = piece[1] === "P" || piece[1] === "p";
            const isLastRank =
              (piece[0] === "w" && targetSquare[1] === "8") ||
              (piece[0] === "b" && targetSquare[1] === "1");
            if (isPawn && isLastRank) promotion = "q";
          }
          const pm = { from: sourceSquare, to: targetSquare, promotion, piece };
          setPremove(pm);
          premoveReference.current = pm;
        }
        return null;
      }

      // Detect promotion: pawn reaching last rank
      let promotion = undefined;
      if (piece) {
        const isPawn = piece[1] === "P" || piece[1] === "p";
        const isLastRank =
          (piece[0] === "w" && targetSquare[1] === "8") ||
          (piece[0] === "b" && targetSquare[1] === "1");
        if (isPawn && isLastRank) {
          promotion = "q"; // default queen, could show picker later
        }
      } else {
        // click-to-move: check if pawn promotion
        const p = game.get(sourceSquare);
        if (p && p.type === "p") {
          const isLastRank =
            (p.color === "w" && targetSquare[1] === "8") ||
            (p.color === "b" && targetSquare[1] === "1");
          if (isLastRank) promotion = "q";
        }
      }

      try {
        move = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion,
        });
      } catch {
        return null;
      }

      if (move === null) return null;

      setFen(game.fen());
      setMoveHistory((previous) => [
        ...previous,
        { san: move.san, fen: game.fen(), from: move.from, to: move.to },
      ]);
      setMoveQuality(null);
      setLastMoveSquares({ from: sourceSquare, to: targetSquare });
      setBestMoveArrows([]);
      clockReference.current.addIncrement(move.color);
      // Clear any queued premove since we just moved
      setPremove(null);
      premoveReference.current = null;

      // Build move history snapshot now (used for game-over analysis + live analysis below)
      const newMoveHistory = [
        ...moveHistory,
        { san: move.san, fen: game.fen(), from: move.from, to: move.to },
      ];

      // Play sound
      if (game.isCheckmate() || game.isStalemate() || game.isDraw()) {
        playSound("end");
        const snapshot = newMoveHistory;
        // Record opening stats
        const playerGameResult = game.isCheckmate() ? move.color : "d";
        const openingMatchPlayer = detectOpening(
          snapshot.map((m) => m.san),
          OPENINGS,
        );
        if (openingMatchPlayer) {
          recordOpeningResult({
            eco: openingMatchPlayer.eco,
            name: openingMatchPlayer.name,
            gameResult: playerGameResult,
            playerColor: playerColorReference.current[0],
          });
        }
        setTimeout(() => triggerPostGameAnalysis(snapshot), 1200);
      } else if (game.inCheck()) {
        playSound("check");
      } else if (move.captured) {
        playSound("capture");
      } else {
        playSound("move");
      }

      // Live analysis / evaluation after human move
      const postFen = game.fen();

      if (isLiveMode && coachMode === "engine") {
        // Analyze the player's move quality vs engine best.
        // For engine opponents we chain: analysis → then trigger engine reply
        // to avoid Stockfish conflicts (only one pending op at a time).
        const playerAnalysis = engineLiveAnalyzePlayerMove(
          preFen,
          move.san,
          postFen,
        );
        if (opponent !== "manual" && !game.isGameOver()) {
          playerAnalysis
            .then(() => triggerAIMove(postFen, newMoveHistory))
            .catch(() => triggerAIMove(postFen, newMoveHistory));
        }
      } else {
        updateEvalBar(postFen); // always keep eval bar live
        if (isLiveMode && coachMode === "ai" && getApiKey()) {
          evaluateLastMove(
            move.san,
            postFen,
            newMoveHistory.map((m) => m.san),
          );
        }
        // Trigger AI response if not manual (non-live-engine path)
        if (opponent !== "manual" && !game.isGameOver()) {
          triggerAIMove(postFen, newMoveHistory);
        }
      }

      return move;
    },
    [isLiveMode, coachMode, moveHistory, opponent, triggerAIMove],
  );

  // Stable ref so triggerAIMove can call handleMove without capturing stale closure
  const handleMoveReference = useRef(null);
  useEffect(() => {
    handleMoveReference.current = handleMove;
  }, [handleMove]);

  // ---- Helper: extract White-perspective score from engine result ----
  /**
   *
   */
  const applyEvalScore = (result, fen) => {
    if (!result.isMate && result.scoreCp !== null) {
      const isWhite = new Chess(fen).turn() === "w";
      const wScore = isWhite ? result.scoreCp / 100 : -result.scoreCp / 100;
      setEvalScore(wScore);
    }
  };

  // ---- Lightweight eval bar update — fires after every move ----
  /**
   *
   */
  const updateEvalBar = (fen) => {
    const sf = getStockfishEngine();
    sf.analyze(fen, 10, 1)
      .then((result) => applyEvalScore(result, fen))
      .catch(() => {
        /* silent */
      });
  };

  // ---- Engine live analysis (auto, after moves) ----
  /**
   *
   */
  const engineLiveAnalyze = (fen, lastMoveSan) => {
    const sf = getStockfishEngine();
    sf.analyze(fen, 12, 1)
      .then((result) => {
        applyEvalScore(result, fen);
        const content = buildLiveAnalysisMessage(result, fen, lastMoveSan);
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content, type: "engine" },
        ]);
      })
      .catch(() => {
        /* silent */
      });
  };

  // ---- Intelligence: analyze player's move vs Stockfish best ----
  /**
   *
   */
  const engineLiveAnalyzePlayerMove = async (preFen, moveSan, postFen) => {
    const sf = getStockfishEngine();
    const userElo = getElo();
    const seed = messageSeedReference.current++;
    try {
      // Step 1: analyze pre-move position to get the engine's best
      const preResult = await sf.analyze(preFen, 14, 1);
      // Step 2: analyze post-move position for new evaluation
      const postResult = await sf.analyze(postFen, 10, 1);
      applyEvalScore(postResult, postFen);
      const card = buildMyMoveCard(
        preFen,
        moveSan,
        preResult,
        postResult,
        userElo,
        seed,
      );
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: card, type: "my-move-analysis" },
      ]);
    } catch {
      // Fallback: just update the eval bar silently
      updateEvalBar(postFen);
    }
  };

  // ---- Intelligence: detect threats after opponent's move ----
  /**
   *
   */
  const runThreatDetection = (
    game,
    opponentColor,
    lastMoveTo,
    moveSan,
    moveHistory,
  ) => {
    const seed = messageSeedReference.current++;
    try {
      const card = buildThreatCard(
        game,
        opponentColor,
        lastMoveTo,
        moveSan,
        seed,
        moveHistory,
      );
      if (card) {
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: card, type: "threat-card" },
        ]);
      }
    } catch {
      /* silent */
    }
  };

  // ---- Engine coach: Analyze position ----
  const handleEngineAnalyze = useCallback(async () => {
    setMessages((previous) => [
      ...previous,
      { role: "user", content: "🔍 Analyze position", type: "engine-query" },
    ]);
    setIsLoading(true);
    try {
      const sf = getStockfishEngine();
      const result = await sf.analyze(gameReference.current.fen(), 18, 3);
      applyEvalScore(result, gameReference.current.fen());
      const content = buildAnalysisMessage(result, gameReference.current.fen());
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content, type: "engine" },
      ]);
    } catch (e) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Engine error: ${e.message}`,
          type: "engine",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Post-game full analysis ----
  const triggerPostGameAnalysis = useCallback(async (history) => {
    if (isAnalyzingReference.current || (history?.length ?? 0) < 4) return;
    isAnalyzingReference.current = true;
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setGameReport(null);
    try {
      const report = await analyzeFullGame(history, 10, (done, total) =>
        setAnalysisProgress(Math.round((done / total) * 100)),
      );
      if (report) {
        setGameReport(report);
        setGameReportOpen(true);
      }
    } catch (e) {
      console.error("Post-game analysis failed:", e);
    } finally {
      setIsAnalyzing(false);
      isAnalyzingReference.current = false;
    }
  }, []);

  // ---- Engine coach: Best move ----
  const handleEngineBestMove = useCallback(async () => {
    setMessages((previous) => [
      ...previous,
      { role: "user", content: "💡 Best Move", type: "engine-query" },
    ]);
    setIsLoading(true);
    try {
      const sf = getStockfishEngine();
      const result = await sf.analyze(gameReference.current.fen(), 15, 1);
      applyEvalScore(result, gameReference.current.fen());
      const seed = messageSeedReference.current++;
      const card = buildBestMoveCard(result, gameReference.current.fen(), seed);
      if (card) {
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: card, type: "best-move-card" },
        ]);
        // ── Draw arrows for best move (primary = green, response = blue) ──
        const arrows = [];
        if (result.pv && result.pv.length > 0) {
          const mv1 = result.pv[0];
          if (mv1?.length >= 4) {
            arrows.push({
              startSquare: mv1.slice(0, 2),
              endSquare: mv1.slice(2, 4),
              color: "#22c55e",
            });
          }
        }
        if (result.pv && result.pv.length > 1) {
          const mv2 = result.pv[1];
          if (mv2?.length >= 4) {
            arrows.push({
              startSquare: mv2.slice(0, 2),
              endSquare: mv2.slice(2, 4),
              color: "#3b82f6",
            });
          }
        }
        setBestMoveArrows(arrows);
      } else {
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content: "No legal moves in this position.",
            type: "engine",
          },
        ]);
      }
    } catch (e) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Engine error: ${e.message}`,
          type: "engine",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Engine coach: Hint (vague, no exact move) ----
  const handleEngineHint = useCallback(async () => {
    setMessages((previous) => [
      ...previous,
      { role: "user", content: "🎯 Hint", type: "engine-query" },
    ]);
    setIsLoading(true);
    try {
      const sf = getStockfishEngine();
      const result = await sf.analyze(gameReference.current.fen(), 12, 1);
      const seed = messageSeedReference.current++;
      const card = buildHintCard(result, gameReference.current.fen(), seed);
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: card, type: "hint-card" },
      ]);
    } catch (e) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Engine error: ${e.message}`,
          type: "engine",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Undo last move ----
  const handleUndo = useCallback(() => {
    setViewIndex(null); // exit review mode
    const game = gameReference.current;
    const undone = game.undo();
    if (undone) {
      setFen(game.fen());
      setMoveHistory((previous) => previous.slice(0, -1));
      setMoveQuality(null);
      // Update last move highlight to the new last move
      const history = game.history({ verbose: true });
      if (history.length > 0) {
        const last = history[history.length - 1];
        setLastMoveSquares({ from: last.from, to: last.to });
      } else {
        setLastMoveSquares(null);
      }
      playSound("move");
    }
  }, []);

  // ---- Evaluate last move (live mode) ----
  /**
   *
   */
  const evaluateLastMove = async (lastMove, currentFen, history) => {
    try {
      const result = await evaluateMove({
        fen: currentFen,
        lastMove,
        moveHistory: history,
        apiKey: getApiKey(),
        model: getModel(),
      });
      const firstLine = result.split("\n")[0].trim();
      const quality = firstLine.replace(/[^a-zA-Z]/g, "");
      const validQualities = [
        "Excellent",
        "Good",
        "Inaccuracy",
        "Mistake",
        "Blunder",
      ];
      const matched = validQualities.find(
        (q) => q.toLowerCase() === quality.toLowerCase(),
      );
      if (matched) {
        setMoveQuality(matched);
      }
    } catch {
      // silently ignore evaluation errors
    }
  };

  // ---- Send chat message ----
  const handleSendMessage = useCallback(
    async (text) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        setMessages((previous) => [
          ...previous,
          { role: "user", content: text },
          {
            role: "assistant",
            content:
              "Please set your API key in Settings (gear icon) to start chatting.",
          },
        ]);
        return;
      }

      const userMessage = { role: "user", content: text };
      setMessages((previous) => [...previous, userMessage]);
      setIsLoading(true);

      try {
        const allMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const reply = await sendChatMessage({
          messages: allMessages,
          fen: gameReference.current.fen(),
          apiKey,
          model: getModel(),
        });

        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: reply },
        ]);
      } catch (error) {
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: `Error: ${error.message}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages],
  );

  // ---- Explain button ----
  const handleExplain = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: "Please set your API key in Settings first.",
        },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      const explanation = await explainPosition({
        fen: gameReference.current.fen(),
        moveHistory: moveHistory.map((m) => m.san),
        apiKey,
        model: getModel(),
      });
      setMessages((previous) => [
        ...previous,
        { role: "user", content: "Explain this position" },
        { role: "assistant", content: explanation },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: `Error: ${error.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [moveHistory]);

  // ---- Hint button ----
  const handleHint = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: "Please set your API key in Settings first.",
        },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      const hint = await getHint({
        fen: gameReference.current.fen(),
        moveHistory: moveHistory.map((m) => m.san),
        apiKey,
        model: getModel(),
      });
      setMessages((previous) => [
        ...previous,
        { role: "user", content: "Give me a hint" },
        { role: "assistant", content: hint },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: `Error: ${error.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [moveHistory]);

  // ---- New game ----
  const handleNewGame = useCallback(() => {
    if (aiTimeoutReference.current) clearTimeout(aiTimeoutReference.current);
    // Reset Stockfish state for a new game
    destroyStockfishEngine();
    gameReference.current = new Chess();
    setFen(gameReference.current.fen());
    setMoveHistory([]);
    setViewIndex(null);
    setMoveQuality(null);
    setMessages([]);
    setLastMoveSquares(null);
    setIsAIThinking(false);
    setEvalScore(null);
    setBestMoveArrows([]);
    setGameReport(null);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setBlunderReviewOpen(false);
    isAnalyzingReference.current = false;
    clockReference.current.reset();
    setPremove(null);
    premoveReference.current = null;
    setAnnotations({});
    // If player chose Black, engine plays first as White
    if (playerColorReference.current === "black" && opponent !== "manual") {
      setTimeout(() => triggerAIMove(gameReference.current.fen(), []), 150);
    }
  }, [opponent, triggerAIMove]);

  // ---- Load a position from FEN or PGN ----
  const handleLoadPosition = useCallback(
    ({ type, fen, pgn, game: loadedGame }) => {
      if (aiTimeoutReference.current) clearTimeout(aiTimeoutReference.current);
      destroyStockfishEngine();
      try {
        const g = loadedGame || new Chess();
        if (!loadedGame) {
          if (type === "fen") g.load(fen);
          else if (type === "pgn") g.loadPgn(pgn);
        }
        gameReference.current = g;
        setFen(g.fen());
        const hist = g.history({ verbose: true });
        const temporaryG = new Chess();
        const newHistory = hist.map((m) => {
          temporaryG.move(m);
          return { san: m.san, fen: temporaryG.fen(), from: m.from, to: m.to };
        });
        setMoveHistory(newHistory);
        setViewIndex(null);
        setBestMoveArrows([]);
        setMoveQuality(null);
        setMessages([]);
        setIsAIThinking(false);
        setEvalScore(null);
        setGameReport(null);
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        setBlunderReviewOpen(false);
        isAnalyzingReference.current = false;
        setPremove(null);
        premoveReference.current = null;
        setAnnotations({});
        if (hist.length > 0) {
          const last = hist[hist.length - 1];
          setLastMoveSquares({ from: last.from, to: last.to });
        } else {
          setLastMoveSquares(null);
        }
        setPositionSetupOpen(false);
        // If loaded game is already over (e.g. importing a complete PGN), trigger analysis automatically
        if (g.isGameOver() && newHistory.length > 0) {
          setTimeout(() => triggerPostGameAnalysis(newHistory), 1200);
        }
      } catch (e) {
        console.error("Failed to load position:", e);
      }
    },
    [triggerPostGameAnalysis],
  );

  // ---- Copy current game as PGN ----
  const handleCopyPgn = useCallback(() => {
    navigator.clipboard
      .writeText(gameReference.current.pgn())
      .catch(console.error);
  }, []);

  const handleAnnotationChange = useCallback((index, text) => {
    setAnnotations((previous) => {
      if (!text) {
        const n = { ...previous };
        delete n[index];
        return n;
      }
      return { ...previous, [index]: text };
    });
  }, []);

  // ---- Load an endgame scenario onto the main board ----
  const handleLoadEndgameScenario = useCallback(
    ({ fen: scenarioFen, playerColor: pc }) => {
      setOpponent("engine");
      setPlayerColor(pc);
      setBoardOrientation(pc);
      handleLoadPosition({ type: "fen", fen: scenarioFen });
    },
    [handleLoadPosition],
  );

  // ---- Pre-warm Stockfish when engine mode is selected ----
  useEffect(() => {
    if (opponent === "engine") {
      getStockfishEngine().init().catch(console.error);
    }
  }, [opponent]);

  // ---- Ask AI to explain a tactical threat ----
  const handleAskAI = useCallback(async (threatCard) => {
    const apiKey = getApiKey();
    const threatName = threatCard?.primaryThreat?.name || "this threat";
    const moveSan = threatCard?.opponentMoveSan || "the last move";

    if (!apiKey) {
      setCoachMode("ai");
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Please set your API key in Settings (gear icon) to use AI coaching.",
        },
      ]);
      return;
    }

    setCoachMode("ai");
    const prompt = `My opponent just played ${moveSan}, creating a ${threatName}. The current position (FEN): ${gameReference.current.fen()}. Please briefly explain what this threat is and what my best defensive options are.`;
    const userMessage = {
      role: "user",
      content: `Explain: ${threatName} after ${moveSan}`,
    };
    setMessages((previous) => [...previous, userMessage]);
    setIsLoading(true);
    try {
      const reply = await sendChatMessage({
        messages: [{ role: "user", content: prompt }],
        fen: gameReference.current.fen(),
        apiKey,
        model: getModel(),
      });
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: reply },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: `Error: ${error.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Learn with AI — deep teaching moment for openings & patterns ----
  const handleLearnWithAI = useCallback(async (card) => {
    const apiKey = getApiKey();
    const userElo = getElo();
    const pattern = card.knownPattern;
    const moveSan = card.opponentMoveSan;
    const currentFen = gameReference.current.fen();

    if (!apiKey) {
      setCoachMode("ai");
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Please set your API key in Settings (gear icon) to use AI coaching.",
        },
      ]);
      return;
    }

    // Switch to AI Coach tab so the response is visible
    setCoachMode("ai");

    let prompt = "";
    let userLabel = "";

    if (pattern?.type === "opening") {
      userLabel = `📚 Learn: ${pattern.name}`;
      prompt =
        `I'm learning chess (rated ~${userElo}). My opponent just played ${moveSan}, a theoretical move ` +
        `in the ${pattern.name} (ECO ${pattern.eco}). ` +
        `Current position FEN: ${currentFen}. ` +
        `Please teach me (concisely, 3-4 paragraphs):\n` +
        `1. What is the ${pattern.name} and why is it so popular?\n` +
        `2. What are the key ideas and plans for both sides?\n` +
        `3. How should I respond as the defending player?\n` +
        `4. One important pattern or trap to remember from this opening.`;
    } else if (pattern?.type === "tactical") {
      userLabel = `📚 Learn: ${pattern.name}`;
      prompt =
        `I'm learning chess (rated ~${userElo}). My opponent just played ${moveSan} creating a ${pattern.name}. ` +
        `Current position FEN: ${currentFen}. ` +
        `Please teach me (concisely, 3-4 paragraphs):\n` +
        `1. What exactly is a ${pattern.name} and why is it powerful?\n` +
        `2. In this specific position, what is being attacked and why is it hard to defend?\n` +
        `3. What are my best defensive options right now?\n` +
        `4. How can I learn to spot and avoid this pattern in future games?`;
    } else {
      userLabel = `📚 Learn: ${moveSan}`;
      prompt =
        `I'm learning chess (rated ~${userElo}). My opponent just played ${moveSan}. ` +
        `Position FEN: ${currentFen}. ` +
        `Please explain what's happening, what this move accomplishes, and what I should focus on next.`;
    }

    const userMessage = { role: "user", content: userLabel };
    setMessages((previous) => [...previous, userMessage]);
    setIsLoading(true);
    try {
      const reply = await sendChatMessage({
        messages: [{ role: "user", content: prompt }],
        fen: currentFen,
        apiKey,
        model: getModel(),
      });
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: reply },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: `Error: ${error.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <ControlBar
        isLiveMode={isLiveMode}
        onToggleLiveMode={setIsLiveMode}
        onNewGame={handleNewGame}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSavedGames={() => setSavedGamesOpen(true)}
        opponent={opponent}
        onOpponentChange={setOpponent}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        isAIThinking={isAIThinking}
        playerColor={playerColor}
        onPlayerColorChange={handlePlayerColorChange}
        isGameInProgress={moveHistory.length > 0}
        onSetPosition={() => setPositionSetupOpen(true)}
        onOpenPuzzles={() => setPuzzleOpen(true)}
        onOpenOpeningDrill={() => setOpeningDrillOpen(true)}
        onOpenEndgame={() => setEndgameOpen(true)}
        onOpenOpeningStats={() => setOpeningStatsOpen(true)}
        clockEnabled={clockEnabled}
        clockTimeControl={clockTimeControl}
        onToggleClock={() => setClockEnabled((e) => !e)}
        onSetTimeControl={setClockTimeControl}
      />

      {/* Main Content */}
      <div className="grid grid-cols-[220px_1fr_380px] flex-1 overflow-hidden">
        {/* Left — Move history + eval bar */}
        <div className="min-w-0 min-h-0">
          <MoveHistorySidebar
            game={gameReference.current}
            moveHistory={moveHistory}
            evalScore={evalScore}
            moveQuality={moveQuality}
            viewIndex={viewIndex}
            onJumpToMove={handleJumpToMove}
            onExitReview={handleExitReview}
            onNavigateBack={handleNavigateBack}
            onNavigateForward={handleNavigateForward}
            onFlipBoard={() =>
              setBoardOrientation((o) => (o === "white" ? "black" : "white"))
            }
            onUndo={handleUndo}
            onCopyPgn={handleCopyPgn}
            isAnalyzing={isAnalyzing}
            analysisProgress={analysisProgress}
            gameReport={gameReport}
            onViewReport={() => setGameReportOpen(true)}
            clockEnabled={clockEnabled}
            timeWhite={clock.timeWhite}
            timeBlack={clock.timeBlack}
            currentTurn={gameReference.current.turn()}
            clockFlagged={clock.flagged}
            annotations={annotations}
            onAnnotationChange={handleAnnotationChange}
          />
        </div>

        {/* Center — Board */}
        <div className="flex items-center justify-center bg-background overflow-hidden p-4">
          <BoardPanel
            game={displayGame}
            onMove={handleMove}
            lastMoveSquares={displayLastMoveSquares}
            isAIThinking={isAIThinking}
            boardOrientation={boardOrientation}
            isReviewMode={viewIndex !== null}
            arrows={bestMoveArrows}
            premove={premove}
            playerColor={playerColor}
            onPlayerColorChange={handlePlayerColorChange}
            isGameInProgress={moveHistory.length > 0}
            onCancelPremove={() => {
              setPremove(null);
              premoveReference.current = null;
            }}
          />
        </div>

        {/* Right — Chat */}
        <div className="min-w-0 min-h-0">
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            coachMode={coachMode}
            onCoachModeChange={setCoachMode}
            isLiveMode={isLiveMode}
            onEngineAnalyze={handleEngineAnalyze}
            onEngineBestMove={handleEngineBestMove}
            onEngineHint={handleEngineHint}
            onAskAI={handleAskAI}
            onLearnWithAI={handleLearnWithAI}
          />
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Game Report Dialog */}
      <GameReportDialog
        open={gameReportOpen}
        onOpenChange={setGameReportOpen}
        report={gameReport}
        moveHistory={moveHistory}
        onJumpToMove={handleJumpToMove}
        onReviewBlunders={() => setBlunderReviewOpen(true)}
      />

      {/* Blunder Review Mode */}
      {blunderReviewOpen && gameReport?.blunders?.length > 0 && (
        <BlunderReviewMode
          blunders={gameReport.blunders}
          onClose={() => setBlunderReviewOpen(false)}
        />
      )}

      {/* Position Setup Dialog (FEN/PGN import) */}
      <PositionSetupDialog
        open={positionSetupOpen}
        onOpenChange={setPositionSetupOpen}
        onLoadPosition={handleLoadPosition}
      />

      {/* Saved Games Dialog */}
      <SavedGamesDialog
        open={savedGamesOpen}
        onClose={() => setSavedGamesOpen(false)}
        onLoadGame={handleLoadGame}
        currentGameSnapshot={getCurrentSnapshot()}
      />

      {/* Training Modes */}
      {puzzleOpen && <PuzzleMode onClose={() => setPuzzleOpen(false)} />}
      {openingDrillOpen && (
        <OpeningDrillMode onClose={() => setOpeningDrillOpen(false)} />
      )}
      {endgameOpen && (
        <EndgameMode
          onClose={() => setEndgameOpen(false)}
          onLoadScenario={handleLoadEndgameScenario}
        />
      )}
      <OpeningStatsPanel
        open={openingStatsOpen}
        onClose={() => setOpeningStatsOpen(false)}
      />
    </div>
  );
};

export default App;
