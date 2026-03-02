import { useState, useCallback, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  RefreshCw,
  Trophy,
  SkipForward,
  Check,
} from "lucide-react";
import { getPuzzleSession } from "@/data/puzzles";

// Difficulty badge color
const diffColor = {
  easy: "text-green-400",
  medium: "text-yellow-400",
  hard: "text-red-400",
};
const themeEmoji = {
  checkmate: "♟",
  fork: "⚔️",
  pin: "📌",
  skewer: "🗡️",
  discovered: "💥",
  deflection: "🎭",
  "back-rank": "🔒",
  hanging: "🪝",
  promotion: "👑",
};

// ── PuzzleMode ────────────────────────────────────────────────────────────────
export default function PuzzleMode({ onClose, initialDifficulty = null }) {
  const [puzzles] = useState(() => getPuzzleSession(initialDifficulty));
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [sessionStats, setSessionStats] = useState({ solved: 0, failed: 0 });

  // Per-puzzle state
  const [chess, setChess] = useState(null); // Chess instance for current puzzle
  const [fen, setFen] = useState("");
  const [solutionStep, setSolutionStep] = useState(0); // which move in solution[] we're waiting for
  const [status, setStatus] = useState("idle"); // "idle"|"correct-step"|"wrong"|"solved"|"revealed"
  const [wrongMoves, setWrongMoves] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [arrows, setArrows] = useState([]);
  const [lastMoveSquares, setLastMoveSquares] = useState({});
  const engineTimeoutRef = useRef(null);

  const puzzle = puzzles[puzzleIdx] ?? null;

  // ── Initialise / reset on puzzle change ──────────────────────────────────
  useEffect(() => {
    if (!puzzle) return;
    clearTimeout(engineTimeoutRef.current);
    const g = new Chess(puzzle.fen);
    setChess(g);
    setFen(puzzle.fen);
    setSolutionStep(0);
    setStatus("idle");
    setWrongMoves(0);
    setHintUsed(false);
    setArrows([]);
    setLastMoveSquares({});
  }, [puzzle]);

  // ── Play the "engine" response (odd solution steps) ───────────────────────
  const playEngineMove = useCallback(
    (game, step) => {
      const sol = puzzle?.solution;
      if (!sol || step >= sol.length) return;
      const uci = sol[step];
      engineTimeoutRef.current = setTimeout(() => {
        try {
          const mv = game.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci[4] || "q",
          });
          if (!mv) return;
          setFen(game.fen());
          setLastMoveSquares({ [mv.from]: true, [mv.to]: true });
          setSolutionStep(step + 1);
          setStatus("idle");
          setArrows([]);
        } catch {
          /* ignore */
        }
      }, 600);
    },
    [puzzle],
  );

  // ── Handle player piece drop ───────────────────────────────────────────────
  const handleDrop = useCallback(
    (from, to) => {
      if (!chess || !puzzle) return false;
      if (status === "solved" || status === "revealed") return false;

      // Attempt the move
      let move;
      try {
        move = chess.move({ from, to, promotion: "q" });
        if (!move) return false;
      } catch {
        return false;
      }

      const expectedUci = puzzle.solution[solutionStep];
      const expectedFrom = expectedUci.slice(0, 2);
      const expectedTo = expectedUci.slice(2, 4);

      // ─ Correct move ──────────────────────────────────────────────────────
      if (from === expectedFrom && to === expectedTo) {
        setFen(chess.fen());
        setLastMoveSquares({ [from]: true, [to]: true });
        setArrows([]);

        const nextStep = solutionStep + 1;
        if (nextStep >= puzzle.solution.length) {
          // Puzzle complete!
          setStatus("solved");
          setSessionStats((s) => ({ ...s, solved: s.solved + 1 }));
        } else {
          setStatus("correct-step");
          // Engine plays next
          playEngineMove(chess, nextStep);
        }
        return true;
      }

      // ─ Wrong move — undo ───────────────────────────────────────────────────
      chess.undo();
      setWrongMoves((n) => n + 1);
      setStatus("wrong");
      // Reset "wrong" indicator after 1s
      setTimeout(() => setStatus((s) => (s === "wrong" ? "idle" : s)), 1200);
      return false;
    },
    [chess, puzzle, solutionStep, status, playEngineMove],
  );

  // ── Hint: highlight the from-square of the expected move ─────────────────
  const handleHint = useCallback(() => {
    if (!puzzle) return;
    const uci = puzzle.solution[solutionStep];
    const fromSq = uci?.slice(0, 2);
    const toSq = uci?.slice(2, 4);
    if (fromSq && toSq) {
      setArrows([{ startSquare: fromSq, endSquare: toSq, color: "#f59e0b80" }]);
    }
    setHintUsed(true);
  }, [puzzle, solutionStep]);

  // ── Reveal solution ───────────────────────────────────────────────────────
  const handleReveal = useCallback(() => {
    if (!puzzle || !chess) return;
    setSessionStats((s) => ({ ...s, failed: s.failed + 1 }));
    // Play out remaining solution moves
    let g = chess;
    const newArrows = [];
    const remaining = puzzle.solution.slice(solutionStep);
    remaining.forEach((uci) => {
      try {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promo = uci[4];
        g.move({ from, to, promotion: promo || "q" });
        newArrows.push({ startSquare: from, endSquare: to, color: "#22c55e" });
      } catch {
        /* */
      }
    });
    setFen(g.fen());
    setLastMoveSquares({});
    setArrows(newArrows);
    setStatus("revealed");
  }, [chess, puzzle, solutionStep]);

  // ── Navigate puzzles ──────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    clearTimeout(engineTimeoutRef.current);
    if (puzzleIdx < puzzles.length - 1) setPuzzleIdx((i) => i + 1);
  }, [puzzleIdx, puzzles.length]);

  const goPrev = useCallback(() => {
    clearTimeout(engineTimeoutRef.current);
    if (puzzleIdx > 0) setPuzzleIdx((i) => i - 1);
  }, [puzzleIdx]);

  if (!puzzle) return null;

  const orientation = new Chess(puzzle.fen).turn() === "w" ? "white" : "black";
  const progressPct = ((solutionStep / puzzle.solution.length) * 100).toFixed(
    0,
  );

  // Total puzzles solved in the session
  const totalDone = sessionStats.solved + sessionStats.failed;

  const statusMsg =
    {
      idle: "Find the best move — drag a piece!",
      "correct-step": "✓ Good move! Keep going…",
      wrong: "✗ That's not the best move. Try again!",
      solved: "🎉 Excellent! Puzzle solved!",
      revealed: "Solution revealed — the green arrows show the line.",
    }[status] ?? "";

  const lastMoveStyle = Object.fromEntries(
    Object.keys(lastMoveSquares).map((sq) => [
      sq,
      { backgroundColor: "rgba(255,255,0,0.35)" },
    ]),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col md:flex-row gap-0 w-full max-w-[900px] overflow-hidden max-h-[95vh]">
        {/* ── Left: Board ──────────────────────────────────────────────────── */}
        <div className="shrink-0 w-full md:w-[420px] flex items-center justify-center p-4 bg-black/20">
          <div className="w-full">
            <Chessboard
              id="puzzle-board"
              position={fen}
              onPieceDrop={handleDrop}
              boardOrientation={orientation}
              arePiecesDraggable={status !== "solved" && status !== "revealed"}
              customBoardStyle={{
                borderRadius: "6px",
                boxShadow: "0 4px 24px #0008",
              }}
              customDarkSquareStyle={{ backgroundColor: "#4a7c59" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              customSquareStyles={lastMoveStyle}
              options={{
                showNotation: true,
                arrows,
                clearArrowsOnPositionChange: false,
              }}
            />
          </div>
        </div>

        {/* ── Right: Info panel ────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 p-5 gap-4 min-w-0 overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-0.5">
                🧩 Puzzle Mode
              </p>
              <p className="text-xs text-muted-foreground">
                Puzzle {puzzleIdx + 1} / {puzzles.length}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Session stats */}
          <div className="flex gap-3">
            <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
              <p className="text-[10px] uppercase tracking-widest text-green-400 font-semibold">
                Solved
              </p>
              <p className="text-xl font-bold text-green-300">
                {sessionStats.solved}
              </p>
            </div>
            <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
              <p className="text-[10px] uppercase tracking-widest text-red-400 font-semibold">
                Missed
              </p>
              <p className="text-xl font-bold text-red-300">
                {sessionStats.failed}
              </p>
            </div>
          </div>

          {/* Puzzle info */}
          <div className="border border-border rounded-lg p-3 bg-secondary/30 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {puzzle.title}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${diffColor[puzzle.difficulty]}`}
              >
                {puzzle.difficulty}
              </span>
              <span className="text-xs text-muted-foreground">
                {themeEmoji[puzzle.theme] ?? "♟"} {puzzle.theme}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {puzzle.description}
            </p>
            {/* Progress bar for multi-move puzzles */}
            {puzzle.solution.length > 1 && (
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground">
                  Move {solutionStep} / {puzzle.solution.length} in sequence
                </p>
                <div className="h-1 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status message */}
          <div
            className={`border rounded-lg p-3 text-sm font-medium transition-all ${
              status === "solved"
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : status === "wrong"
                  ? "border-red-500/40 bg-red-500/10 text-red-400"
                  : status === "correct-step"
                    ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                    : status === "revealed"
                      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                      : "border-border bg-secondary/20 text-muted-foreground"
            }`}
          >
            {statusMsg}
            {status === "wrong" && wrongMoves > 0 && (
              <span className="block text-xs mt-0.5 opacity-70">
                Incorrect attempt #{wrongMoves}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {(status === "idle" ||
              status === "wrong" ||
              status === "correct-step") && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleHint}
                  className="justify-start text-yellow-400 hover:text-yellow-300"
                >
                  <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
                  {hintUsed ? "Hint shown (arrow on board)" : "Show Hint"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReveal}
                  className="justify-start text-muted-foreground text-xs"
                >
                  <SkipForward className="w-3.5 h-3.5 mr-1.5" />
                  Reveal solution
                </Button>
              </>
            )}
            {(status === "solved" || status === "revealed") && (
              <Button
                onClick={goNext}
                disabled={puzzleIdx >= puzzles.length - 1}
                className="w-full"
              >
                <ChevronRight className="w-4 h-4 mr-1" />
                {puzzleIdx >= puzzles.length - 1
                  ? "All puzzles done! 🎉"
                  : "Next Puzzle"}
              </Button>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-border mt-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={goPrev}
              disabled={puzzleIdx === 0}
              className="text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>

            {/* Dot indicators */}
            <div className="flex gap-1 flex-wrap justify-center max-w-[160px]">
              {puzzles
                .slice(Math.max(0, puzzleIdx - 4), puzzleIdx + 5)
                .map((p, i) => {
                  const absIdx = Math.max(0, puzzleIdx - 4) + i;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        clearTimeout(engineTimeoutRef.current);
                        setPuzzleIdx(absIdx);
                      }}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        absIdx === puzzleIdx
                          ? "bg-primary"
                          : p.difficulty === "hard"
                            ? "bg-red-500/50"
                            : p.difficulty === "medium"
                              ? "bg-yellow-500/50"
                              : "bg-green-500/50"
                      }`}
                      title={`Puzzle ${absIdx + 1}: ${p.title}`}
                    />
                  );
                })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={goNext}
              disabled={puzzleIdx >= puzzles.length - 1}
              className="text-muted-foreground"
            >
              Skip
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
