import { useState, useCallback, useRef } from "react";
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

  const getApiKey = () => localStorage.getItem("chess-coach-api-key") || "";
  const getModel = () =>
    localStorage.getItem("chess-coach-model") || "gpt-4o-mini";

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

      // If live mode, auto-evaluate
      if (isLiveMode && getApiKey()) {
        evaluateLastMove(move.san, game.fen(), [...moveHistory, move.san]);
      }

      return move;
    },
    [isLiveMode, moveHistory]
  );

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
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setMoveHistory([]);
    setMoveQuality(null);
    setMessages([]);
    setLastMoveSquares(null);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <ControlBar
        onExplain={handleExplain}
        onHint={handleHint}
        isLiveMode={isLiveMode}
        onToggleLiveMode={setIsLiveMode}
        onNewGame={handleNewGame}
        onOpenSettings={() => setSettingsOpen(true)}
        isLoading={isLoading}
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
          />
        </div>

        {/* Right — Chat */}
        <div className="min-w-0 min-h-0">
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

export default App
