import { useState, useCallback, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/Button";
import { X, ChevronLeft, ChevronRight, RefreshCw, BookOpen, Check } from "lucide-react";
import { OPENINGS } from "@/lib/openings";

// ── Category colors and emoji ────────────────────────────────────────────────
const CATEGORY_STYLE = {
  open:      { color: "text-blue-400",   emoji: "⚔️"  },
  "semi-open": { color: "text-yellow-400", emoji: "🔀"  },
  closed:    { color: "text-purple-400", emoji: "🛡️"  },
  flank:     { color: "text-green-400",  emoji: "🌀"  },
};

// ── Parse SAN move list from opening string ───────────────────────────────────
function parseMoves(movesStr) {
  return movesStr.trim().split(/\s+/);
}

// ── OpeningDrillMode ─────────────────────────────────────────────────────────
export default function OpeningDrillMode({ onClose }) {
  const [phase, setPhase]         = useState("select"); // "select" | "drill"
  const [selectedOpening, setSelectedOpening] = useState(null);
  const [playerSide, setPlayerSide]   = useState("w"); // "w" | "b"
  const [searchQuery, setSearchQuery] = useState("");

  // Drill state
  const [chess, setChess]   = useState(null);
  const [fen, setFen]       = useState("");
  const [moveList, setMoveList]   = useState([]); // parsed SAN moves for the opening
  const [drillIdx, setDrillIdx]   = useState(0);  // current step in the move list
  const [status, setStatus] = useState("idle");   // "idle"|"wrong"|"opponent"|"complete"
  const [wrongAttempt, setWrongAttempt] = useState(false);
  const [lastMoveSquares, setLastMoveSquares] = useState({});
  const [correctArrow, setCorrectArrow]       = useState([]);
  const [masteredCount, setMasteredCount]     = useState(0);
  const [totalMoves, setTotalMoves]           = useState(0);

  const opponentTimeoutRef = useRef(null);

  // ── Filter openings ───────────────────────────────────────────────────────
  const filtered = OPENINGS.filter((o) =>
    !searchQuery ||
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.eco.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Start drill for a given opening + side ────────────────────────────────
  const startDrill = useCallback((opening, side) => {
    clearTimeout(opponentTimeoutRef.current);
    const moves = parseMoves(opening.moves);
    const g = new Chess();
    setChess(g);
    setFen(g.fen());
    setMoveList(moves);
    setDrillIdx(0);
    setStatus("idle");
    setWrongAttempt(false);
    setLastMoveSquares({});
    setCorrectArrow([]);
    setSelectedOpening(opening);
    setPlayerSide(side);
    setMasteredCount(0);
    setTotalMoves(moves.length);
    setPhase("drill");

    // If the first move is the opponent's, auto-play it
    if (side === "b" && moves.length > 0) {
      // White plays moves[0], then player (Black) plays moves[1], etc.
      // Side "b" means player plays Black — so White (opponent) moves first
      setTimeout(() => playOpponentMove(g, moves, 0, side), 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-play opponent's next move ────────────────────────────────────────
  function playOpponentMove(game, moves, idx, side) {
    if (idx >= moves.length) return;
    const isPlayerTurn = (side === "w" && idx % 2 === 0) || (side === "b" && idx % 2 === 1);
    if (isPlayerTurn) return; // it's the human's turn, stop

    opponentTimeoutRef.current = setTimeout(() => {
      try {
        const mv = game.move(moves[idx]);
        if (!mv) return;
        setFen(game.fen());
        setLastMoveSquares({ [mv.from]: true, [mv.to]: true });
        setCorrectArrow([]);
        const nextIdx = idx + 1;
        setDrillIdx(nextIdx);

        if (nextIdx >= moves.length) {
          setStatus("complete");
          setMasteredCount((n) => n + 1);
          return;
        }
        setStatus("idle");
        // If next move is also opponent's (e.g., both sides of a line), recurse
        playOpponentMove(game, moves, nextIdx, side);
      } catch { /* */ }
    }, 700);
  }

  // ── Handle player piece drop ──────────────────────────────────────────────
  const handleDrop = useCallback(
    (from, to) => {
      if (!chess || !moveList || status === "complete") return false;

      const expectedSan = moveList[drillIdx];
      if (!expectedSan) return false;

      // Check if it's the player's turn
      const isPlayerTurn =
        (playerSide === "w" && drillIdx % 2 === 0) ||
        (playerSide === "b" && drillIdx % 2 === 1);
      if (!isPlayerTurn) return false;

      // Try the move
      let move;
      try {
        move = chess.move({ from, to, promotion: "q" });
        if (!move) return false;
      } catch {
        return false;
      }

      // Compare SAN
      if (move.san === expectedSan) {
        // Correct!
        setFen(chess.fen());
        setLastMoveSquares({ [from]: true, [to]: true });
        setCorrectArrow([]);
        setWrongAttempt(false);
        const nextIdx = drillIdx + 1;
        setDrillIdx(nextIdx);
        setMasteredCount((n) => n + 1);

        if (nextIdx >= moveList.length) {
          setStatus("complete");
          return true;
        }
        setStatus("opponent");
        playOpponentMove(chess, moveList, nextIdx, playerSide);
        return true;
      }

      // Wrong — undo and highlight correct move
      chess.undo();
      setWrongAttempt(true);
      setStatus("wrong");

      // Show correct move as arrow
      try {
        const tempG = new Chess(chess.fen());
        const correctMove = tempG.move(expectedSan);
        if (correctMove) {
          setCorrectArrow([{ startSquare: correctMove.from, endSquare: correctMove.to, color: "#22c55e" }]);
        }
      } catch { /* */ }

      // Auto-clear wrong state after 2s
      setTimeout(() => {
        setStatus((s) => (s === "wrong" ? "idle" : s));
        setCorrectArrow([]);
        setWrongAttempt(false);
      }, 2000);

      return false;
    },
    [chess, moveList, drillIdx, playerSide, status]
  );

  // ── Reset drill ──────────────────────────────────────────────────────────
  const resetDrill = useCallback(() => {
    if (selectedOpening) startDrill(selectedOpening, playerSide);
  }, [selectedOpening, playerSide, startDrill]);

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(opponentTimeoutRef.current), []);

  const orientation = playerSide === "w" ? "white" : "black";
  const progressPct = totalMoves > 0 ? ((drillIdx / totalMoves) * 100).toFixed(0) : 0;

  const lastMoveStyle = Object.fromEntries(
    Object.keys(lastMoveSquares).map((sq) => [sq, { backgroundColor: "rgba(255,255,0,0.35)" }])
  );

  // ── Phase: Opening Selection ──────────────────────────────────────────────
  if (phase === "select") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">🎯 Opening Drill</p>
              <h2 className="text-base font-semibold text-foreground mt-0.5">Choose your opening</h2>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Side picker */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted-foreground mb-2">Play as:</p>
            <div className="flex gap-2">
              {[{ val: "w", label: "⬜ White" }, { val: "b", label: "⬛ Black" }].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setPlayerSide(val)}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    playerSide === val
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-border">
            <input
              type="text"
              placeholder="Search opening… (e.g. Sicilian, Ruy Lopez)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/70 transition-colors"
            />
          </div>

          {/* Opening list */}
          <div className="overflow-y-auto flex-1 py-1">
            {filtered.map((opening) => {
              const cat = CATEGORY_STYLE[opening.category] ?? CATEGORY_STYLE.open;
              const moves = parseMoves(opening.moves);
              return (
                <button
                  key={`${opening.eco}-${opening.name}`}
                  onClick={() => startDrill(opening, playerSide)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left border-b border-border/30"
                >
                  <span className="text-lg mt-0.5">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{opening.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-1 rounded">{opening.eco}</span>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${cat.color}`}>{opening.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{opening.idea}</p>
                    <p className="text-[10px] text-primary/70 mt-0.5 font-mono">{opening.moves}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{moves.length} moves</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">No openings found</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Drill ──────────────────────────────────────────────────────────
  const currentExpected = moveList[drillIdx];
  const isPlayerTurn =
    status !== "complete" && status !== "opponent" &&
    ((playerSide === "w" && drillIdx % 2 === 0) ||
     (playerSide === "b" && drillIdx % 2 === 1));

  const statusMsg = {
    idle:      isPlayerTurn
                ? `Your turn — play ${playerSide === "w" ? "White's" : "Black's"} next move: ${currentExpected ?? "?"}`
                : "Waiting for opponent…",
    wrong:     `✗ Not quite! The correct move is ${currentExpected ?? "?"}. (green arrow on board)`,
    opponent:  "Opponent is thinking…",
    complete:  "🎉 You know this line! Excellent work.",
  }[status] ?? "";

  const cat = CATEGORY_STYLE[selectedOpening?.category] ?? CATEGORY_STYLE.open;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col md:flex-row gap-0 w-full max-w-[900px] overflow-hidden max-h-[95vh]">

        {/* ── Left: Board ──────────────────────────────────────────────────── */}
        <div className="shrink-0 w-full md:w-[420px] flex items-center justify-center p-4 bg-black/20">
          <div className="w-full">
            <Chessboard
              id="drill-board"
              position={fen}
              onPieceDrop={handleDrop}
              boardOrientation={orientation}
              arePiecesDraggable={isPlayerTurn && status !== "complete"}
              customBoardStyle={{ borderRadius: "6px", boxShadow: "0 4px 24px #0008" }}
              customDarkSquareStyle={{ backgroundColor: "#4a7c59" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              customSquareStyles={lastMoveStyle}
              options={{ showNotation: true, arrows: correctArrow, clearArrowsOnPositionChange: false }}
            />
          </div>
        </div>

        {/* ── Right: Info Panel ────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 p-5 gap-4 min-w-0 overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">🎯 Opening Drill</p>
              <p className="text-xs text-muted-foreground mt-0.5">Playing as {playerSide === "w" ? "White ⬜" : "Black ⬛"}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setPhase("select")} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary" title="Change opening">
                <BookOpen className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Opening info */}
          <div className="border border-border rounded-lg p-3 bg-secondary/30">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold text-foreground">{selectedOpening?.name}</span>
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-1 rounded">{selectedOpening?.eco}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${cat.color}`}>{cat.emoji} {selectedOpening?.category}</span>
            </div>
            <p className="text-xs text-muted-foreground">{selectedOpening?.idea}</p>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Move {Math.min(drillIdx + 1, totalMoves)} / {totalMoves}</span>
              <span>{progressPct}% mastered</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Move sequence visualization */}
          <div className="border border-border rounded-lg p-3 bg-secondary/20">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Opening Line</p>
            <div className="flex flex-wrap gap-1">
              {moveList.map((move, i) => {
                const isWhiteMove  = i % 2 === 0;
                const isPlayed     = i < drillIdx;
                const isCurrent    = i === drillIdx;
                const isPlayerMove =
                  (playerSide === "w" && isWhiteMove) ||
                  (playerSide === "b" && !isWhiteMove);
                return (
                  <span
                    key={i}
                    className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      isPlayed ? "text-muted-foreground bg-secondary/40"
                      : isCurrent && isPlayerMove ? "text-primary bg-primary/20 font-bold ring-1 ring-primary/50 animate-pulse"
                      : isCurrent ? "text-yellow-400 bg-yellow-500/10"
                      : "text-muted-foreground/40"
                    }`}
                    title={isPlayerMove ? "Your move" : "Opponent's move"}
                  >
                    {isWhiteMove && `${Math.floor(i / 2) + 1}.`}{move}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Status message */}
          <div className={`border rounded-lg p-3 text-sm font-medium ${
            status === "complete" ? "border-green-500/40 bg-green-500/10 text-green-400"
            : status === "wrong"  ? "border-red-500/40 bg-red-500/10 text-red-400"
            : status === "opponent" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
            : "border-border bg-secondary/20 text-muted-foreground"
          }`}>
            {statusMsg}
          </div>

          {/* Actions */}
          {status === "complete" ? (
            <div className="flex gap-2">
              <Button onClick={resetDrill} variant="ghost" size="sm" className="flex-1">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Drill Again
              </Button>
              <Button onClick={() => setPhase("select")} size="sm" className="flex-1">
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                New Opening
              </Button>
            </div>
          ) : (
            <Button onClick={resetDrill} variant="ghost" size="sm" className="text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Restart from beginning
            </Button>
          )}

          {/* Side switcher */}
          <div className="flex gap-2 pt-1 border-t border-border mt-auto">
            <p className="text-xs text-muted-foreground self-center mr-1">Switch side:</p>
            {[{ val: "w", label: "⬜ White" }, { val: "b", label: "⬛ Black" }].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => startDrill(selectedOpening, val)}
                className={`flex-1 py-1 rounded-md text-xs font-medium border transition-colors ${
                  playerSide === val
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
