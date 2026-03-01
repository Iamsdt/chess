import { useState, useCallback, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import ControlBar from "@/components/ControlBar";
import BoardPanel, { playSound } from "@/components/BoardPanel";
import ChatPanel from "@/components/ChatPanel";
import MoveHistorySidebar from "@/components/MoveHistorySidebar";
import SettingsDialog from "@/components/SettingsDialog";
import {
  sendChatMessage,
  explainPosition,
  getHint,
  evaluateMove,
} from "@/lib/ai";
import { getBestMove } from "@/lib/engine";
import { getStockfishEngine, destroyStockfishEngine, StockfishEngine } from "@/lib/stockfish";import { buildMyMoveCard, buildThreatCard } from "@/lib/intelligence";
// ── Stockfish analysis formatting helpers ─────────────────────────────────────

function pvToSan(fen, pvUci) {
  try {
    const g = new Chess(fen);
    const sans = [];
    for (const uci of (pvUci || []).slice(0, 6)) {
      const mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (!mv) break;
      sans.push(mv.san);
    }
    return sans;
  } catch { return []; }
}

function fmtScore(scoreCp, isMate, mateIn, isWhiteToMove) {
  if (isMate) {
    const wWins = (mateIn > 0) === isWhiteToMove;
    return `Mate in ${Math.abs(mateIn)} — ${wWins ? "White" : "Black"} wins`;
  }
  if (scoreCp === null) return "—";
  const score = scoreCp / 100;
  const wScore = isWhiteToMove ? score : -score; // normalize to White perspective
  const raw  = wScore > 0 ? `+${wScore.toFixed(2)}` : wScore.toFixed(2);
  const abs  = Math.abs(wScore);
  const who  = wScore >= 0 ? "White" : "Black";
  const desc = abs < 0.25 ? "equal"
             : abs < 0.75 ? `slight ${who} edge`
             : abs < 2.0  ? `${who} is better`
             : `${who} is clearly better`;
  return `${raw}  (${desc})`;
}

function buildAnalysisMsg(result, fen) {
  const { lines, scoreCp, isMate, mateIn } = result;
  const isWhite = new Chess(fen).turn() === "w";
  const scoreStr = fmtScore(scoreCp, isMate, mateIn, isWhite);
  let out = `🔍 Position Analysis\n\nEvaluation: ${scoreStr}\n`;
  if (lines.length > 0) {
    out += `\nTop line${lines.length > 1 ? "s" : ""}:\n`;
    const nums = ["①", "②", "③"];
    lines.slice(0, 3).forEach((l, i) => {
      const san = pvToSan(fen, l.pv);
      const sc  = l.isMate ? `M${Math.abs(l.mateIn)}`
                : l.scoreCp !== null
                  ? (l.scoreCp >= 0 ? `+${(l.scoreCp / 100).toFixed(1)}` : (l.scoreCp / 100).toFixed(1))
                  : "";
      out += `${nums[i]}  ${san.slice(0, 4).join(" ")}  ${sc}\n`;
    });
  }
  return out.trim();
}

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
  p: ["A pawn push could open lines or gain space.", "Pawn moves often open diagonals for your pieces.", "That pawn has a purpose—find where it wants to go."],
  n: ["Your knight may have an outpost waiting for it.", "Knights love central squares — look for a strong jump.", "An active knight can dominate a position."],
  b: ["A bishop diagonal may be more powerful than it looks.", "Long diagonals are a bishop's best friend.", "Your bishop wants to be active on an open diagonal."],
  r: ["Rooks belong on open files or the seventh rank.", "Consider how your rook can become more active.", "A rook on an open file creates lasting pressure."],
  q: ["Your queen has a lot of potential energy here — unleash it.", "Look for where your queen creates multiple threats.", "Queen moves often combine attack with defence."],
  k: ["King safety matters — consider your king's position.", "A king move here could activate a 'rook behind' or escape a pin.", "In the endgame, your king is a powerful fighting piece."],
};

function buildBestMoveCard(result, fen, msgSeed = 0) {
  const { bestMove, scoreCp, isMate, mateIn, pv } = result;
  if (!bestMove) return null;
  const isWhite = new Chess(fen).turn() === "w";
  const san     = pvToSan(fen, [bestMove]);
  const pvSan   = pvToSan(fen, (pv || []).slice(0, 6));

  // White-perspective score normalised
  const wScore  = isMate ? null : (scoreCp !== null ? (isWhite ? scoreCp / 100 : -scoreCp / 100) : null);
  const evalStr = fmtScore(scoreCp, isMate, mateIn, isWhite);

  // Tactical tags
  const TACTICAL_TAGS = [
    "Controls key square", "Activates a piece", "Creates multiple threats",
    "Improves piece harmony", "Gains space", "Prepares a passed pawn",
    "Threatens material", "Removes a defender", "Creates a pin",
    "Forks two pieces", "Opens a file", "Strengthens king safety",
    "Deflects a key defender", "Centralises the knight", "Seizes the initiative",
  ];
  const tacticalTag = TACTICAL_TAGS[msgSeed % TACTICAL_TAGS.length];

  return {
    type: "best-move-card",
    moveSan: san[0] || bestMove,
    evalStr,
    wScore,
    line: pvSan,
    tacticalTag,
  };
}

function buildHintCard(result, fen, msgSeed = 0) {
  const { bestMove, scoreCp, isMate, mateIn } = result;
  const isWhite  = new Chess(fen).turn() === "w";
  const evalStr  = fmtScore(scoreCp, isMate, mateIn, isWhite);

  // White-perspective score
  const wScore = isMate ? null : (scoreCp !== null ? (isWhite ? scoreCp / 100 : -scoreCp / 100) : null);

  let pieceType  = null;
  let fromSquare = null;
  let pieceContext = "";

  if (bestMove) {
    try {
      const g  = new Chess(fen);
      const mv = g.move({ from: bestMove.slice(0,2), to: bestMove.slice(2,4), promotion: bestMove[4] });
      if (mv) {
        pieceType  = mv.piece;
        fromSquare = mv.from;
        const ctxArr = HINT_PIECE_CONTEXTS[mv.piece] || [];
        pieceContext = ctxArr[msgSeed % ctxArr.length] || "";
      }
    } catch { /* ignore */ }
  }

  const PIECE_NAMES = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" };
  const generalMsg  = HINT_MESSAGES[msgSeed % HINT_MESSAGES.length];

  return {
    type: "hint-card",
    pieceType,
    pieceName: pieceType ? PIECE_NAMES[pieceType] : null,
    fromSquare,
    pieceContext,
    generalMsg,
    evalStr,
    wScore,
  };
}

function buildLiveAnalysisMsg(result, fen, lastMoveSan) {
  const { scoreCp, isMate, mateIn, pv } = result;
  const isWhite  = new Chess(fen).turn() === "w";
  const scoreStr = fmtScore(scoreCp, isMate, mateIn, isWhite);
  const pvSan    = pvToSan(fen, (pv || []).slice(0, 4));
  let out = `⚙ After ${lastMoveSan}\n\nEvaluation: ${scoreStr}`;
  if (pvSan.length > 0) out += `\nBest continuation: ${pvSan.join(" ")}`;
  return out;
}

function App() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [messages, setMessages] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);
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
  const [isAIThinking, setIsAIThinking] = useState(false);
  const aiTimeoutRef = useRef(null);

  // ---- Coach mode ----
  const [coachMode, setCoachMode] = useState("engine"); // "engine" | "ai"
  const coachModeRef = useRef(coachMode);
  useEffect(() => { coachModeRef.current = coachMode; }, [coachMode]);
  const isLiveModeRef = useRef(isLiveMode);
  useEffect(() => { isLiveModeRef.current = isLiveMode; }, [isLiveMode]);

  // ---- Intelligence layer ----
  const msgSeedRef = useRef(0);
  const getElo = () => parseInt(localStorage.getItem("chess-coach-elo") || "1000", 10);

  const getApiKey = () => localStorage.getItem("chess-coach-api-key") || "";
  const getModel = () =>
    localStorage.getItem("chess-coach-model") || "gpt-4o-mini";

  // ---- Trigger AI response after a human move ----
  const triggerAIMove = useCallback(
    async (currentFen, currentHistory) => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      setIsAIThinking(true);

      const executeMove = async () => {
        try {
          const game = gameRef.current;
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
            const tempGame = new Chess(currentFen);
            const move = tempGame.move(san);
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

          const newHistory = [...currentHistory, move.san];
          setFen(game.fen());
          setMoveHistory(newHistory);
          setLastMoveSquares({ from: move.from, to: move.to });

          if (game.isCheckmate() || game.isStalemate() || game.isDraw()) {
            playSound("end");
          } else if (game.inCheck()) {
            playSound("check");
          } else if (move.captured) {
            playSound("capture");
          } else {
            playSound("move");
          }

          // Live analysis after engine/AI move
          if (isLiveModeRef.current && coachModeRef.current === "engine") {
            // Update eval bar with quick analysis
            updateEvalBar(game.fen());
            // Detect threats for the player (from opponent's perspective)
            const opponentClr = move.color; // color that just moved (the engine)
            runThreatDetection(game, opponentClr, move.to, move.san);
          } else {
            updateEvalBar(game.fen()); // always keep eval bar live
            if (isLiveModeRef.current && coachModeRef.current === "ai" && getApiKey()) {
              evaluateLastMove(move.san, game.fen(), newHistory);
            }
          }
        } catch (e) {
          console.error("Engine move error:", e);
        } finally {
          setIsAIThinking(false);
        }
      };

      // Small delay for AI/minimax; Stockfish manages own timing
      if (opponent === "engine") {
        executeMove();
      } else {
        aiTimeoutRef.current = setTimeout(executeMove, 400);
      }
    },
    [difficulty, opponent]
  );

  // ---- Make a move on the board ----
  const handleMove = useCallback(
    (sourceSquare, targetSquare, piece) => {
      const game = gameRef.current;
      let move = null;
      const preFen = game.fen(); // capture before move for intelligence analysis

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
      setMoveHistory((prev) => [...prev, move.san]);
      setMoveQuality(null);
      setLastMoveSquares({ from: sourceSquare, to: targetSquare });

      // Play sound
      if (game.isCheckmate() || game.isStalemate() || game.isDraw()) {
        playSound("end");
      } else if (game.inCheck()) {
        playSound("check");
      } else if (move.captured) {
        playSound("capture");
      } else {
        playSound("move");
      }

      // Live analysis / evaluation after human move
      const postFen = game.fen();
      const newMoveHistory = [...moveHistory, move.san];

      if (isLiveMode && coachMode === "engine") {
        // Analyze the player's move quality vs engine best.
        // For engine opponents we chain: analysis → then trigger engine reply
        // to avoid Stockfish conflicts (only one pending op at a time).
        const playerAnalysis = engineLiveAnalyzePlayerMove(preFen, move.san, postFen);
        if (opponent !== "manual" && !game.isGameOver()) {
          playerAnalysis
            .then(() => triggerAIMove(postFen, newMoveHistory))
            .catch(() => triggerAIMove(postFen, newMoveHistory));
        }
      } else {
        updateEvalBar(postFen); // always keep eval bar live
        if (isLiveMode && coachMode === "ai" && getApiKey()) {
          evaluateLastMove(move.san, postFen, newMoveHistory);
        }
        // Trigger AI response if not manual (non-live-engine path)
        if (opponent !== "manual" && !game.isGameOver()) {
          triggerAIMove(postFen, newMoveHistory);
        }
      }

      return move;
    },
    [isLiveMode, coachMode, moveHistory, opponent, triggerAIMove]
  );

  // ---- Helper: extract White-perspective score from engine result ----
  function applyEvalScore(result, fen) {
    if (!result.isMate && result.scoreCp !== null) {
      const isWhite = new Chess(fen).turn() === "w";
      const wScore = isWhite ? result.scoreCp / 100 : -result.scoreCp / 100;
      setEvalScore(wScore);
    }
  }

  // ---- Lightweight eval bar update — fires after every move ----
  function updateEvalBar(fen) {
    const sf = getStockfishEngine();
    sf.analyze(fen, 10, 1)
      .then((result) => applyEvalScore(result, fen))
      .catch(() => { /* silent */ });
  }

  // ---- Engine live analysis (auto, after moves) ----
  function engineLiveAnalyze(fen, lastMoveSan) {
    const sf = getStockfishEngine();
    sf.analyze(fen, 12, 1)
      .then((result) => {
        applyEvalScore(result, fen);
        const content = buildLiveAnalysisMsg(result, fen, lastMoveSan);
        setMessages((prev) => [...prev, { role: "assistant", content, type: "engine" }]);
      })
      .catch(() => { /* silent */ });
  }

  // ---- Intelligence: analyze player's move vs Stockfish best ----
  async function engineLiveAnalyzePlayerMove(preFen, moveSan, postFen) {
    const sf = getStockfishEngine();
    const userElo = getElo();
    const seed = msgSeedRef.current++;
    try {
      // Step 1: analyze pre-move position to get the engine's best
      const preResult = await sf.analyze(preFen, 14, 1);
      // Step 2: analyze post-move position for new evaluation
      const postResult = await sf.analyze(postFen, 10, 1);
      applyEvalScore(postResult, postFen);
      const card = buildMyMoveCard(preFen, moveSan, preResult, postResult, userElo, seed);
      setMessages((prev) => [...prev, { role: "assistant", content: card, type: "my-move-analysis" }]);
    } catch {
      // Fallback: just update the eval bar silently
      updateEvalBar(postFen);
    }
  }

  // ---- Intelligence: detect threats after opponent's move ----
  function runThreatDetection(game, opponentColor, lastMoveTo, moveSan) {
    const seed = msgSeedRef.current++;
    try {
      const card = buildThreatCard(game, opponentColor, lastMoveTo, moveSan, seed);
      if (card) {
        setMessages((prev) => [...prev, { role: "assistant", content: card, type: "threat-card" }]);
      }
    } catch { /* silent */ }
  }

  // ---- Engine coach: Analyze position ----
  const handleEngineAnalyze = useCallback(async () => {
    setMessages((prev) => [...prev, { role: "user", content: "🔍 Analyze position", type: "engine-query" }]);
    setIsLoading(true);
    try {
      const sf     = getStockfishEngine();
      const result = await sf.analyze(gameRef.current.fen(), 18, 3);
      applyEvalScore(result, gameRef.current.fen());
      const content = buildAnalysisMsg(result, gameRef.current.fen());
      setMessages((prev) => [...prev, { role: "assistant", content, type: "engine" }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Engine error: ${e.message}`, type: "engine" }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Engine coach: Best move ----
  const handleEngineBestMove = useCallback(async () => {
    setMessages((prev) => [...prev, { role: "user", content: "💡 Best Move", type: "engine-query" }]);
    setIsLoading(true);
    try {
      const sf     = getStockfishEngine();
      const result = await sf.analyze(gameRef.current.fen(), 15, 1);
      applyEvalScore(result, gameRef.current.fen());
      const seed = msgSeedRef.current++;
      const card = buildBestMoveCard(result, gameRef.current.fen(), seed);
      if (card) {
        setMessages((prev) => [...prev, { role: "assistant", content: card, type: "best-move-card" }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "No legal moves in this position.", type: "engine" }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Engine error: ${e.message}`, type: "engine" }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Engine coach: Hint (vague, no exact move) ----
  const handleEngineHint = useCallback(async () => {
    setMessages((prev) => [...prev, { role: "user", content: "🎯 Hint", type: "engine-query" }]);
    setIsLoading(true);
    try {
      const sf     = getStockfishEngine();
      const result = await sf.analyze(gameRef.current.fen(), 12, 1);
      const seed = msgSeedRef.current++;
      const card = buildHintCard(result, gameRef.current.fen(), seed);
      setMessages((prev) => [...prev, { role: "assistant", content: card, type: "hint-card" }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Engine error: ${e.message}`, type: "engine" }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Undo last move ----
  const handleUndo = useCallback(() => {
    const game = gameRef.current;
    const undone = game.undo();
    if (undone) {
      setFen(game.fen());
      setMoveHistory((prev) => prev.slice(0, -1));
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
  async function evaluateLastMove(lastMove, currentFen, history) {
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
        (q) => q.toLowerCase() === quality.toLowerCase()
      );
      if (matched) {
        setMoveQuality(matched);
      }
    } catch {
      // silently ignore evaluation errors
    }
  }

  // ---- Send chat message ----
  const handleSendMessage = useCallback(
    async (text) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        setMessages((prev) => [
          ...prev,
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
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const allMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const reply = await sendChatMessage({
          messages: allMessages,
          fen: gameRef.current.fen(),
          apiKey,
          model: getModel(),
        });

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err.message}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  // ---- Explain button ----
  const handleExplain = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
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
        fen: gameRef.current.fen(),
        moveHistory,
        apiKey,
        model: getModel(),
      });
      setMessages((prev) => [
        ...prev,
        { role: "user", content: "Explain this position" },
        { role: "assistant", content: explanation },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [moveHistory]);

  // ---- Hint button ----
  const handleHint = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
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
        fen: gameRef.current.fen(),
        moveHistory,
        apiKey,
        model: getModel(),
      });
      setMessages((prev) => [
        ...prev,
        { role: "user", content: "Give me a hint" },
        { role: "assistant", content: hint },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [moveHistory]);

  // ---- New game ----
  const handleNewGame = useCallback(() => {
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    // Reset Stockfish state for a new game
    destroyStockfishEngine();
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setMoveHistory([]);
    setMoveQuality(null);
    setMessages([]);
    setLastMoveSquares(null);
    setIsAIThinking(false);
    setEvalScore(null);
  }, []);

  // ---- Pre-warm Stockfish when engine mode is selected ----
  useEffect(() => {
    if (opponent === "engine") {
      getStockfishEngine().init().catch(console.error);
    }
  }, [opponent]);

  // ---- Ask AI about a threat (placeholder — AI integration coming later) ----
  const handleAskAI = useCallback((threatCard) => {
    const threatName = threatCard?.primaryThreat?.name || "this threat";
    const move = threatCard?.opponentMoveSan || "the last move";
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `🤖 AI analysis for "${threatName}" after ${move} is coming soon! Set up your API key in Settings and use the AI Coach tab to ask about any position.`,
        type: "engine",
      },
    ]);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <ControlBar
        isLiveMode={isLiveMode}
        onToggleLiveMode={setIsLiveMode}
        onNewGame={handleNewGame}
        onOpenSettings={() => setSettingsOpen(true)}
        opponent={opponent}
        onOpponentChange={setOpponent}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        isAIThinking={isAIThinking}
      />

      {/* Main Content */}
      <div className="grid grid-cols-[220px_1fr_380px] flex-1 overflow-hidden">
        {/* Left — Move history + eval bar */}
        <div className="min-w-0 min-h-0">
          <MoveHistorySidebar
            game={gameRef.current}
            moveHistory={moveHistory}
            evalScore={evalScore}
            moveQuality={moveQuality}
            onFlipBoard={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
            onUndo={handleUndo}
          />
        </div>

        {/* Center — Board */}
        <div className="flex items-center justify-center bg-background overflow-hidden p-4">
          <BoardPanel
            game={gameRef.current}
            onMove={handleMove}
            lastMoveSquares={lastMoveSquares}
            isAIThinking={isAIThinking}
            boardOrientation={boardOrientation}
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
          />
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

export default App
