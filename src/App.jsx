import { useState, useCallback, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import ControlBar from "@/components/ControlBar";
import BoardPanel, { playSound } from "@/components/BoardPanel";
import ChatPanel from "@/components/ChatPanel";
import SettingsDialog from "@/components/SettingsDialog";
import {
  sendChatMessage,
  explainPosition,
  getHint,
  evaluateMove,
} from "@/lib/ai";
import { getBestMove } from "@/lib/engine";
import { getStockfishEngine, destroyStockfishEngine, StockfishEngine } from "@/lib/stockfish";

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

function buildBestMoveMsg(result, fen) {
  const { bestMove, scoreCp, isMate, mateIn, pv } = result;
  if (!bestMove) return "No legal moves in this position.";
  const isWhite = new Chess(fen).turn() === "w";
  const san      = pvToSan(fen, [bestMove]);
  const pvSan    = pvToSan(fen, (pv || []).slice(0, 5));
  const scoreStr = fmtScore(scoreCp, isMate, mateIn, isWhite);
  let out = `💡 Best Move: ${san[0] || bestMove}\n\nEvaluation: ${scoreStr}`;
  if (pvSan.length > 1) out += `\nLine: ${pvSan.join(" ")}`;
  return out;
}

function buildHintMsg(result, fen) {
  const { bestMove, scoreCp, isMate, mateIn } = result;
  const isWhite  = new Chess(fen).turn() === "w";
  const scoreStr = fmtScore(scoreCp, isMate, mateIn, isWhite);
  let hintText = "";
  if (bestMove) {
    try {
      const g  = new Chess(fen);
      const mv = g.move({ from: bestMove.slice(0,2), to: bestMove.slice(2,4), promotion: bestMove[4] });
      if (mv) {
        const names = { p:"pawn", n:"knight", b:"bishop", r:"rook", q:"queen", k:"king" };
        hintText = `Consider moving your ${names[mv.piece] || "piece"} (currently on ${mv.from}).`;
      }
    } catch { /* ignore */ }
  }
  if (!hintText) hintText = "Look for the best move in this position.";
  return `🎯 Hint\n\nEvaluation: ${scoreStr}\n\n${hintText}`;
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

  // ---- Opponent / difficulty / moves sidebar ----
  const [opponent, setOpponent] = useState("manual"); // manual | ai | engine
  const [difficulty, setDifficulty] = useState("medium"); // easy | medium | hard
  const [showMoves, setShowMoves] = useState(false); // move history sidebar
  const [isAIThinking, setIsAIThinking] = useState(false);
  const aiTimeoutRef = useRef(null);

  // ---- Coach mode ----
  const [coachMode, setCoachMode] = useState("engine"); // "engine" | "ai"
  const coachModeRef = useRef(coachMode);
  useEffect(() => { coachModeRef.current = coachMode; }, [coachMode]);
  const isLiveModeRef = useRef(isLiveMode);
  useEffect(() => { isLiveModeRef.current = isLiveMode; }, [isLiveMode]);

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
            engineLiveAnalyze(game.fen(), move.san);
          } else if (isLiveModeRef.current && coachModeRef.current === "ai" && getApiKey()) {
            evaluateLastMove(move.san, game.fen(), newHistory);
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
      if (opponent === "manual" || opponent === "ai") {
        // For engine opponent, analysis runs *after* the engine replies (in triggerAIMove)
        if (isLiveMode) {
          if (coachMode === "engine") {
            engineLiveAnalyze(game.fen(), move.san);
          } else if (coachMode === "ai" && getApiKey()) {
            evaluateLastMove(move.san, game.fen(), [...moveHistory, move.san]);
          }
        }
      }

      // ---- Trigger AI response if not manual ----
      if (opponent !== "manual" && !game.isGameOver()) {
        const newMoveHistory = [...moveHistory, move.san];
        triggerAIMove(game.fen(), newMoveHistory);
      }

      return move;
    },
    [isLiveMode, coachMode, moveHistory, opponent, triggerAIMove]
  );

  // ---- Engine live analysis (auto, after moves) ----
  function engineLiveAnalyze(fen, lastMoveSan) {
    const sf = getStockfishEngine();
    sf.analyze(fen, 12, 1)
      .then((result) => {
        const content = buildLiveAnalysisMsg(result, fen, lastMoveSan);
        setMessages((prev) => [...prev, { role: "assistant", content, type: "engine" }]);
      })
      .catch(() => { /* silent */ });
  }

  // ---- Engine coach: Analyze position ----
  const handleEngineAnalyze = useCallback(async () => {
    setMessages((prev) => [...prev, { role: "user", content: "🔍 Analyze position", type: "engine-query" }]);
    setIsLoading(true);
    try {
      const sf     = getStockfishEngine();
      const result = await sf.analyze(gameRef.current.fen(), 18, 3);
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
    setMessages((prev) => [...prev, { role: "user", content: "💡 Show best move", type: "engine-query" }]);
    setIsLoading(true);
    try {
      const sf     = getStockfishEngine();
      const result = await sf.analyze(gameRef.current.fen(), 15, 1);
      const content = buildBestMoveMsg(result, gameRef.current.fen());
      setMessages((prev) => [...prev, { role: "assistant", content, type: "engine" }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Engine error: ${e.message}`, type: "engine" }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Engine coach: Hint (vague, no exact move) ----
  const handleEngineHint = useCallback(async () => {
    setMessages((prev) => [...prev, { role: "user", content: "🎯 Give me a hint", type: "engine-query" }]);
    setIsLoading(true);
    try {
      const sf     = getStockfishEngine();
      const result = await sf.analyze(gameRef.current.fen(), 12, 1);
      const content = buildHintMsg(result, gameRef.current.fen());
      setMessages((prev) => [...prev, { role: "assistant", content, type: "engine" }]);
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
  }, []);

  // ---- Pre-warm Stockfish when engine mode is selected ----
  useEffect(() => {
    if (opponent === "engine") {
      getStockfishEngine().init().catch(console.error);
    }
  }, [opponent]);

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
      <div className="grid grid-cols-2 flex-1 overflow-hidden">
        {/* Left — Board */}
        <div className="flex items-center justify-center bg-background overflow-hidden p-4">
          <BoardPanel
            game={gameRef.current}
            onMove={handleMove}
            moveQuality={moveQuality}
            moveHistory={moveHistory}
            lastMoveSquares={lastMoveSquares}
            onUndo={handleUndo}
            isAIThinking={isAIThinking}
          />
        </div>

        {/* Right — Chat / Moves sidebar */}
        <div className="min-w-0 min-h-0">
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            moveHistory={moveHistory}
            showMoves={showMoves}
            onToggleMoves={() => setShowMoves((s) => !s)}
            coachMode={coachMode}
            onCoachModeChange={setCoachMode}
            isLiveMode={isLiveMode}
            onEngineAnalyze={handleEngineAnalyze}
            onEngineBestMove={handleEngineBestMove}
            onEngineHint={handleEngineHint}
          />
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

export default App
