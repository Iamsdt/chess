import { Chess } from "chess.js";
import {
  Puzzle,
  BookOpen,
  Crown,
  ChevronLeft,
  Lightbulb,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Dumbbell,
  Target,
  Brain,
  Info,
  ArrowRight,
  Star,
  Trophy,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ENDGAMES } from "@/data/endgames";
import { getPuzzleSession, PUZZLES } from "@/data/puzzles";
import { OPENINGS } from "@/lib/openings";

// ── Theme guidance messages ───────────────────────────────────────────────
const THEME_GUIDE = {
  checkmate: {
    intro: "Your goal is checkmate — the opponent's king must have no escape.",
    hint: "Look for moves that control all escape squares around the king.",
  },
  fork: {
    intro: "A fork attacks two pieces at once with a single move!",
    hint: "Find a piece that can attack two valuable enemy pieces simultaneously.",
  },
  pin: {
    intro: "A pin restricts a piece — moving it would expose something more valuable.",
    hint: "Look for a piece aligned with a more valuable piece behind it.",
  },
  skewer: {
    intro: "A skewer forces a valuable piece to move, exposing the one behind it.",
    hint: "Attack the more valuable piece — when it moves, capture what's behind.",
  },
  discovered: {
    intro: "A discovered attack reveals a hidden attack from another piece!",
    hint: "Move a piece to uncover an attack from the piece behind it.",
  },
  deflection: {
    intro: "Deflection removes a defender from a key square or piece.",
    hint: "Force an enemy piece away from its defensive duty.",
  },
  "back-rank": {
    intro: "The back rank is vulnerable — the king has no escape squares!",
    hint: "Use a rook or queen on the back rank to deliver checkmate.",
  },
  hanging: {
    intro: "A hanging piece has no defenders — capture it for free material!",
    hint: "Check every enemy piece — is any undefended?",
  },
  promotion: {
    intro: "Push the pawn to the last rank to promote it to a queen!",
    hint: "Clear the path and advance your pawn to promotion.",
  },
};

// ── Opening category colors ───────────────────────────────────────────────
const CAT_STYLE = {
  open: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "semi-open": "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  closed: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  flank: "text-green-400 bg-green-500/10 border-green-500/20",
};

// ── Difficulty badge ──────────────────────────────────────────────────────
const DIFF_STYLE = {
  easy: "text-green-400 bg-green-500/10 border-green-500/20",
  beginner: "text-green-400 bg-green-500/10 border-green-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  intermediate: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  hard: "text-red-400 bg-red-500/10 border-red-500/20",
  advanced: "text-red-400 bg-red-500/10 border-red-500/20",
};

// ── Small badge ───────────────────────────────────────────────────────────
const Badge = ({ label, className }) => (
  <span
    className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${className}`}
  >
    {label}
  </span>
);

// ── Step progress dots ─────────────────────────────────────────────────────
const StepDots = ({ total, current }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 rounded-full transition-all ${
          i < current
            ? "w-3 bg-primary"
            : i === current
              ? "w-3 bg-primary/60"
              : "w-1.5 bg-muted-foreground/30"
        }`}
      />
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// ── PUZZLE TRAINER ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function PuzzleTrainer({ onBoardUpdate, onRegisterMoveHandler, onBack }) {
  const [phase, setPhase] = useState("list"); // "list" | "training"
  const [diffFilter, setDiffFilter] = useState("all");
  const [puzzles] = useState(() => getPuzzleSession(null));
  const [puzzleIndex, setPuzzleIndex] = useState(0);

  const chessRef = useRef(null);
  const [fen, setFen] = useState("");
  const [solutionStep, setSolutionStep] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | correct-step | wrong | solved | revealed
  const [feedback, setFeedback] = useState(null); // { type, text }
  const [arrows, setArrows] = useState([]);
  const [wrongCount, setWrongCount] = useState(0);
  const engineTimerRef = useRef(null);

  const puzzle = phase === "training" ? puzzles[puzzleIndex] : null;
  const guide = puzzle ? (THEME_GUIDE[puzzle.theme] || {}) : {};

  // ── Init puzzle ──────────────────────────────────────────────────────────
  const initPuzzle = useCallback(
    (index) => {
      clearTimeout(engineTimerRef.current);
      const p = puzzles[index];
      if (!p) return;
      const g = new Chess(p.fen);
      chessRef.current = g;
      setSolutionStep(0);
      setStatus("idle");
      setFeedback({ type: "info", text: p.description || guide.intro });
      setArrows([]);
      setWrongCount(0);
      onBoardUpdate({
        fen: g.fen(),
        orientation: g.turn() === "w" ? "white" : "black",
        arrows: [],
        isTrainingActive: true,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puzzles, onBoardUpdate],
  );

  // ── Play engine response (even steps after player moves) ─────────────────
  const playEngineStep = useCallback(
    (game, step) => {
      const sol = puzzle?.solution;
      if (!sol || step >= sol.length) return;
      const uci = sol[step];
      engineTimerRef.current = setTimeout(() => {
        try {
          const mv = game.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci[4] || "q",
          });
          if (!mv) return;
          const newFen = game.fen();
          setFen(newFen);
          setArrows([]);
          const nextStep = step + 1;
          setSolutionStep(nextStep);
          if (nextStep >= sol.length) {
            setStatus("solved");
            setFeedback({
              type: "success",
              text: "🎉 Puzzle solved! Well done! You found the winning combination.",
            });
            onBoardUpdate({ fen: newFen, orientation: game.turn() === "w" ? "white" : "black", arrows: [], isTrainingActive: true });
          } else {
            setStatus("idle");
            setFeedback({
              type: "info",
              text: `Good! Now find the next best move. ${guide.hint || "Think carefully!"}`,
            });
            onBoardUpdate({ fen: newFen, orientation: game.turn() === "w" ? "white" : "black", arrows: [], isTrainingActive: true });
          }
        } catch {
          /* ignore */
        }
      }, 700);
    },
    [puzzle, guide, onBoardUpdate],
  );

  // ── Training move handler ─────────────────────────────────────────────────
  const handleTrainingMove = useCallback(
    (from, to) => {
      const game = chessRef.current;
      if (!game || !puzzle || status === "solved" || status === "revealed") return false;
      const sol = puzzle.solution;
      const expectedUci = sol[solutionStep];
      if (!expectedUci) return false;

      const expectedFrom = expectedUci.slice(0, 2);
      const expectedTo = expectedUci.slice(2, 4);
      const expectedPromo = expectedUci[4] || null;

      try {
        // Try the move
        const mv = game.move({ from, to, promotion: expectedPromo || "q" });
        if (!mv) return false;

        if (from === expectedFrom && to === expectedTo) {
          // Correct!
          const newFen = game.fen();
          setFen(newFen);
          setArrows([]);
          const nextStep = solutionStep + 1;
          setSolutionStep(nextStep);

          if (nextStep >= sol.length) {
            setStatus("solved");
            setFeedback({
              type: "success",
              text: "🎉 Puzzle solved! Excellent work! You found the winning combination.",
            });
            onBoardUpdate({ fen: newFen, orientation: game.turn() === "w" ? "white" : "black", arrows: [], isTrainingActive: true });
          } else {
            setStatus("correct-step");
            // Engine plays next move
            playEngineStep(game, nextStep);
          }
          return true;
        } else {
          // Wrong — undo
          game.undo();
          const newWrong = wrongCount + 1;
          setWrongCount(newWrong);
          setStatus("wrong");
          setFeedback({
            type: "error",
            text:
              newWrong >= 2
                ? `Not quite! Hint: Look at the ${puzzle.theme} opportunity. The key idea: ${guide.hint || "think about tactics!"}`
                : "That's not the right move. Try again! Look for the best continuation.",
          });
          return false;
        }
      } catch {
        return false;
      }
    },
    [chessRef, puzzle, status, solutionStep, wrongCount, guide, playEngineStep, onBoardUpdate],
  );

  // Register/unregister handler
  useEffect(() => {
    if (phase === "training") {
      onRegisterMoveHandler(handleTrainingMove);
    } else {
      onRegisterMoveHandler(null);
    }
    return () => onRegisterMoveHandler(null);
  }, [phase, handleTrainingMove, onRegisterMoveHandler]);

  // When puzzle index changes
  useEffect(() => {
    if (phase === "training") initPuzzle(puzzleIndex);
  }, [puzzleIndex, phase, initPuzzle]);

  // ── Hint ─────────────────────────────────────────────────────────────────
  const handleHint = () => {
    const sol = puzzle?.solution;
    if (!sol) return;
    const uci = sol[solutionStep];
    if (!uci) return;
    const hintArrow = [{ startSquare: uci.slice(0, 2), endSquare: uci.slice(2, 4), color: "#22c55e" }];
    setArrows(hintArrow);
    setFeedback({
      type: "hint",
      text: `💡 Hint: Move from ${uci.slice(0, 2).toUpperCase()} to ${uci.slice(2, 4).toUpperCase()}. ${guide.hint || ""}`,
    });
    onBoardUpdate({ fen: chessRef.current.fen(), orientation: chessRef.current.turn() === "w" ? "white" : "black", arrows: hintArrow, isTrainingActive: true });
  };

  // ── Reveal solution ───────────────────────────────────────────────────────
  const handleReveal = () => {
    const sol = puzzle?.solution;
    const game = chessRef.current;
    if (!sol || !game) return;
    clearTimeout(engineTimerRef.current);
    const arrows = [];
    for (let i = solutionStep; i < sol.length; i++) {
      arrows.push({ startSquare: sol[i].slice(0, 2), endSquare: sol[i].slice(2, 4), color: i % 2 === 0 ? "#3b82f6" : "#ef4444" });
    }
    setArrows(arrows);
    setStatus("revealed");
    setFeedback({
      type: "info",
      text: `Solution revealed. Study the moves and try the next puzzle to keep improving!`,
    });
    onBoardUpdate({ fen: game.fen(), orientation: game.turn() === "w" ? "white" : "black", arrows, isTrainingActive: true });
  };

  // ── Next puzzle ───────────────────────────────────────────────────────────
  const handleNextPuzzle = () => {
    clearTimeout(engineTimerRef.current);
    const nextIndex = (puzzleIndex + 1) % puzzles.length;
    setPuzzleIndex(nextIndex);
  };

  // ── Start training for a puzzle ───────────────────────────────────────────
  const handleSelect = (idx) => {
    setPuzzleIndex(idx);
    setPhase("training");
  };

  // ── Back to list ──────────────────────────────────────────────────────────
  const handleBackToList = () => {
    clearTimeout(engineTimerRef.current);
    onRegisterMoveHandler(null);
    onBoardUpdate({ fen: null, orientation: "white", arrows: [], isTrainingActive: false });
    setPhase("list");
  };

  const filtered = puzzles.filter(
    (p) => diffFilter === "all" || p.difficulty === diffFilter,
  );

  // ── LIST PHASE ────────────────────────────────────────────────────────────
  if (phase === "list") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Puzzle className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Tactical Puzzles</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {puzzles.length} puzzles
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-border shrink-0">
          {["all", "easy", "medium", "hard"].map((d) => (
            <button
              key={d}
              onClick={() => setDiffFilter(d)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-colors border ${
                diffFilter === d
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-2 py-2 space-y-1.5">
          {filtered.map((p, idx) => {
            const realIdx = puzzles.indexOf(p);
            return (
              <button
                key={p.id}
                onClick={() => handleSelect(realIdx)}
                className="w-full text-left p-2.5 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {p.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {p.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      label={p.difficulty}
                      className={DIFF_STYLE[p.difficulty]}
                    />
                    <Badge
                      label={p.theme}
                      className="text-primary/70 bg-primary/5 border-primary/20"
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── TRAINING PHASE ────────────────────────────────────────────────────────
  const totalSteps = puzzle?.solution?.length ?? 1;
  const playerSteps = Math.ceil(totalSteps / 2);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <button
          onClick={handleBackToList}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Puzzle className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{puzzle?.title}</p>
        </div>
        <Badge label={puzzle?.difficulty} className={DIFF_STYLE[puzzle?.difficulty]} />
      </div>

      {/* Progress & theme */}
      <div className="px-3 py-2 border-b border-border shrink-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary capitalize">
              {puzzle?.theme} tactics
            </span>
          </div>
          <StepDots total={playerSteps} current={Math.floor(solutionStep / 2)} />
        </div>
        <p className="text-[11px] text-muted-foreground">{guide.intro}</p>
      </div>

      {/* Feedback area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {feedback && (
          <div
            className={`rounded-xl p-3 text-xs leading-relaxed border ${
              feedback.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                : feedback.type === "error"
                  ? "bg-red-950/40 border-red-500/40 text-red-300"
                  : feedback.type === "hint"
                    ? "bg-violet-950/40 border-violet-500/40 text-violet-300"
                    : "bg-muted/40 border-border text-foreground/80"
            }`}
          >
            {feedback.type === "success" && (
              <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5 shrink-0" />
            )}
            {feedback.type === "error" && (
              <XCircle className="h-3.5 w-3.5 inline mr-1.5 shrink-0" />
            )}
            {feedback.type === "hint" && (
              <Lightbulb className="h-3.5 w-3.5 inline mr-1.5 shrink-0" />
            )}
            {feedback.type === "info" && (
              <Info className="h-3.5 w-3.5 inline mr-1.5 shrink-0" />
            )}
            {feedback.text}
          </div>
        )}

        {/* Concept explanation */}
        {status !== "solved" && status !== "revealed" && (
          <div className="rounded-xl p-3 bg-muted/30 border border-border space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[11px] font-semibold text-cyan-400">
                What to look for
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {guide.hint || "Find the best move in this position!"}
            </p>
          </div>
        )}

        {status === "solved" && (
          <div className="rounded-xl p-3 bg-emerald-950/30 border border-emerald-500/30 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-[11px] font-semibold text-yellow-400">
                Puzzle Solved!
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              You successfully identified the{" "}
              <span className="text-primary font-medium capitalize">
                {puzzle?.theme}
              </span>{" "}
              pattern. Keep practicing to improve your pattern recognition!
            </p>
          </div>
        )}

        {/* Solution steps review (when revealed or solved) */}
        {(status === "revealed" || status === "solved") && puzzle?.solution && (
          <div className="rounded-xl p-3 bg-muted/30 border border-border space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Solution
            </p>
            <div className="flex flex-wrap gap-1">
              {puzzle.solution.map((uci, i) => (
                <span
                  key={i}
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                    i % 2 === 0
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}
                >
                  {i % 2 === 0 ? "You: " : "Engine: "}
                  {uci.slice(0, 2).toUpperCase()}→{uci.slice(2, 4).toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-3 py-2.5 border-t border-border shrink-0 space-y-2">
        {status !== "solved" && status !== "revealed" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={handleHint}
            >
              <Lightbulb className="h-3 w-3 mr-1" />
              Hint
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={handleReveal}
            >
              <SkipForward className="h-3 w-3 mr-1" />
              Reveal
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={() => initPuzzle(puzzleIndex)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={handleNextPuzzle}
          >
            Next
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground">
          Puzzle {puzzleIndex + 1} of {puzzles.length}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── OPENING TRAINER ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function OpeningTrainer({ onBoardUpdate, onRegisterMoveHandler, onBack }) {
  const [phase, setPhase] = useState("list"); // "list" | "side" | "training"
  const [catFilter, setCatFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOpening, setSelectedOpening] = useState(null);
  const [playerSide, setPlayerSide] = useState("w");

  const chessRef = useRef(null);
  const [fen, setFen] = useState("");
  const [moveList, setMoveList] = useState([]);
  const [drillIndex, setDrillIndex] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | wrong | complete
  const [feedback, setFeedback] = useState(null);
  const opponentTimerRef = useRef(null);

  // ── Parse moves from space-separated SAN string ───────────────────────────
  const parseMoves = (s) => s.trim().split(/\s+/);

  // ── Play opponent move ─────────────────────────────────────────────────────
  const playOpponentMove = useCallback(
    (game, moves, index, side) => {
      if (index >= moves.length) return;
      const isPlayerTurn =
        (side === "w" && index % 2 === 0) || (side === "b" && index % 2 === 1);
      if (isPlayerTurn) return;

      opponentTimerRef.current = setTimeout(() => {
        try {
          const mv = game.move(moves[index]);
          if (!mv) return;
          const newFen = game.fen();
          setFen(newFen);
          const nextIndex = index + 1;
          setDrillIndex(nextIndex);

          if (nextIndex >= moves.length) {
            setStatus("complete");
            setFeedback({
              type: "success",
              text: `🎉 Opening complete! You mastered ${selectedOpening?.name}. Great job!`,
            });
            onBoardUpdate({ fen: newFen, orientation: side === "w" ? "white" : "black", arrows: [], isTrainingActive: true });
            return;
          }

          const nextExpected = moves[nextIndex];
          setFeedback({
            type: "info",
            text: `Good! Opponent plays ${mv.san}. Now it's your turn — play the correct response.`,
          });
          onBoardUpdate({ fen: newFen, orientation: side === "w" ? "white" : "black", arrows: [], isTrainingActive: true });

          playOpponentMove(game, moves, nextIndex, side);
        } catch {
          /* */
        }
      }, 700);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedOpening, onBoardUpdate],
  );

  // ── Start drill ────────────────────────────────────────────────────────────
  const startDrill = useCallback(
    (opening, side) => {
      clearTimeout(opponentTimerRef.current);
      const moves = parseMoves(opening.moves);
      const g = new Chess();
      chessRef.current = g;
      setMoveList(moves);
      setDrillIndex(0);
      setStatus("idle");
      setFeedback({
        type: "info",
        text: `📖 ${opening.name} — ${opening.idea}. Make the first move for ${side === "w" ? "White" : "Black"}!`,
      });
      setSelectedOpening(opening);
      setPlayerSide(side);
      setPhase("training");

      onBoardUpdate({
        fen: g.fen(),
        orientation: side === "w" ? "white" : "black",
        arrows: [],
        isTrainingActive: true,
      });

      if (side === "b") {
        playOpponentMove(g, moves, 0, side);
      }
    },
    [onBoardUpdate, playOpponentMove],
  );

  // ── Training move handler ──────────────────────────────────────────────────
  const handleTrainingMove = useCallback(
    (from, to) => {
      const game = chessRef.current;
      if (!game || status === "complete") return false;

      const expectedSan = moveList[drillIndex];
      if (!expectedSan) return false;

      const isPlayerTurn =
        (playerSide === "w" && drillIndex % 2 === 0) ||
        (playerSide === "b" && drillIndex % 2 === 1);
      if (!isPlayerTurn) return false;

      try {
        const mv = game.move({ from, to, promotion: "q" });
        if (!mv) return false;

        if (mv.san === expectedSan) {
          const newFen = game.fen();
          setFen(newFen);
          const nextIndex = drillIndex + 1;
          setDrillIndex(nextIndex);

          if (nextIndex >= moveList.length) {
            setStatus("complete");
            setFeedback({
              type: "success",
              text: `🎉 Opening mastered! Excellent recall of ${selectedOpening?.name}.`,
            });
            onBoardUpdate({ fen: newFen, orientation: playerSide === "w" ? "white" : "black", arrows: [], isTrainingActive: true });
            return true;
          }

          onBoardUpdate({ fen: newFen, orientation: playerSide === "w" ? "white" : "black", arrows: [], isTrainingActive: true });
          playOpponentMove(game, moveList, nextIndex, playerSide);
          return true;
        } else {
          game.undo();
          setStatus("wrong");
          setFeedback({
            type: "error",
            text: `Not the right move for this opening. Expected: ${expectedSan}. In this line, ${selectedOpening?.idea}`,
          });
          // Show the correct move arrow
          const g2 = new Chess(game.fen());
          try {
            const correctMv = g2.move(expectedSan);
            if (correctMv) {
              onBoardUpdate({
                fen: game.fen(),
                orientation: playerSide === "w" ? "white" : "black",
                arrows: [{ startSquare: correctMv.from, endSquare: correctMv.to, color: "#22c55e" }],
                isTrainingActive: true,
              });
            }
          } catch { /* */ }
          return false;
        }
      } catch {
        return false;
      }
    },
    [chessRef, status, moveList, drillIndex, playerSide, selectedOpening, onBoardUpdate, playOpponentMove],
  );

  // Register/unregister handler
  useEffect(() => {
    if (phase === "training") {
      onRegisterMoveHandler(handleTrainingMove);
    } else {
      onRegisterMoveHandler(null);
    }
    return () => onRegisterMoveHandler(null);
  }, [phase, handleTrainingMove, onRegisterMoveHandler]);

  const handleBackToList = () => {
    clearTimeout(opponentTimerRef.current);
    onRegisterMoveHandler(null);
    onBoardUpdate({ fen: null, orientation: "white", arrows: [], isTrainingActive: false });
    setPhase("list");
    setSelectedOpening(null);
  };

  const displayed = OPENINGS.filter(
    (o) =>
      (catFilter === "all" || o.category === catFilter) &&
      (!searchQuery ||
        o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.eco.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  // ── SIDE SELECTION ────────────────────────────────────────────────────────
  if (phase === "side") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
          <button
            onClick={() => setPhase("list")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold truncate">
            {selectedOpening?.name}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <p className="text-sm text-center text-muted-foreground">
            {selectedOpening?.idea}
          </p>
          <p className="text-xs text-center text-muted-foreground">
            Choose which side you want to practice:
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => startDrill(selectedOpening, "w")}
              className="flex-1 py-3 rounded-xl border border-border hover:border-primary/60 hover:bg-primary/5 transition-all text-center"
            >
              <div className="text-2xl mb-1">♔</div>
              <p className="text-xs font-semibold">Play as White</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Move first
              </p>
            </button>
            <button
              onClick={() => startDrill(selectedOpening, "b")}
              className="flex-1 py-3 rounded-xl border border-border hover:border-primary/60 hover:bg-primary/5 transition-all text-center"
            >
              <div className="text-2xl mb-1">♚</div>
              <p className="text-xs font-semibold">Play as Black</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Respond to White
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (phase === "list") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Opening Drill</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {OPENINGS.length} openings
          </span>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border shrink-0">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search openings..."
            className="w-full bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-border shrink-0 overflow-x-auto">
          {["all", "open", "semi-open", "closed", "flank"].map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-colors border whitespace-nowrap shrink-0 ${
                catFilter === c
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-2 py-2 space-y-1.5">
          {displayed.map((o) => (
            <button
              key={`${o.eco}-${o.name}`}
              onClick={() => {
                setSelectedOpening(o);
                setPhase("side");
              }}
              className="w-full text-left p-2.5 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-mono text-primary/60">
                      {o.eco}
                    </span>
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {o.name}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {o.idea}
                  </p>
                </div>
                <Badge
                  label={o.category}
                  className={CAT_STYLE[o.category] || "text-muted-foreground bg-muted/30 border-border"}
                />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── TRAINING PHASE ────────────────────────────────────────────────────────
  const totalMoves = moveList.length;
  const playerMovesTotal = Math.ceil(
    playerSide === "w" ? totalMoves / 2 : totalMoves / 2,
  );
  const progressMoves = moveList.slice(0, drillIndex);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <button
          onClick={handleBackToList}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">
            {selectedOpening?.name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {selectedOpening?.eco} · Playing as{" "}
            {playerSide === "w" ? "White" : "Black"}
          </p>
        </div>
        <Badge
          label={selectedOpening?.category}
          className={CAT_STYLE[selectedOpening?.category]}
        />
      </div>

      {/* Progress */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
          <span>
            Move {drillIndex} of {totalMoves}
          </span>
          <span className="text-primary font-medium">
            {Math.round((drillIndex / totalMoves) * 100)}%
          </span>
        </div>
        <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(drillIndex / totalMoves) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {feedback && (
          <div
            className={`rounded-xl p-3 text-xs leading-relaxed border ${
              feedback.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                : feedback.type === "error"
                  ? "bg-red-950/40 border-red-500/40 text-red-300"
                  : "bg-muted/40 border-border text-foreground/80"
            }`}
          >
            {feedback.type === "success" && (
              <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />
            )}
            {feedback.type === "error" && (
              <XCircle className="h-3.5 w-3.5 inline mr-1.5" />
            )}
            {feedback.type === "info" && (
              <Info className="h-3.5 w-3.5 inline mr-1.5" />
            )}
            {feedback.text}
          </div>
        )}

        {/* Opening idea */}
        <div className="rounded-xl p-3 bg-muted/30 border border-border space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-400">
              Opening Idea
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {selectedOpening?.idea}
          </p>
        </div>

        {/* Moves played so far */}
        {progressMoves.length > 0 && (
          <div className="rounded-xl p-3 bg-muted/20 border border-border space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Moves played
            </p>
            <div className="flex flex-wrap gap-1">
              {progressMoves.map((move, i) => (
                <span
                  key={i}
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                    (playerSide === "w" && i % 2 === 0) ||
                    (playerSide === "b" && i % 2 === 1)
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  {Math.floor(i / 2) + 1}
                  {i % 2 === 0 ? ". " : "... "}
                  {move}
                </span>
              ))}
            </div>
          </div>
        )}

        {status === "complete" && (
          <div className="rounded-xl p-3 bg-emerald-950/30 border border-emerald-500/30 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-[11px] font-semibold text-yellow-400">
                Opening Mastered!
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              You've completed the{" "}
              <span className="text-primary font-medium">
                {selectedOpening?.name}
              </span>{" "}
              line. Practice it a few more times to solidify your memory!
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-2.5 border-t border-border shrink-0 space-y-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={() => startDrill(selectedOpening, playerSide)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Restart
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={handleBackToList}
          >
            <BookOpen className="h-3 w-3 mr-1" />
            New Opening
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── ENDGAME TRAINER ───────────────────────────────════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
function EndgameTrainer({ onBoardUpdate, onRegisterMoveHandler, onBack }) {
  const [phase, setPhase] = useState("list"); // "list" | "training"
  const [catFilter, setCatFilter] = useState("all");
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [moveCount, setMoveCount] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [status, setStatus] = useState("playing"); // "playing" | "won" | "drawn"

  const chessRef = useRef(null);
  const engineTimerRef = useRef(null);
  const [fen, setFen] = useState("");

  // ── Start a scenario ───────────────────────────────────────────────────────
  const startScenario = useCallback(
    (scenario) => {
      clearTimeout(engineTimerRef.current);
      const g = new Chess(scenario.fen);
      chessRef.current = g;
      setSelectedScenario(scenario);
      setMoveCount(0);
      setStatus("playing");
      setFeedback({
        type: "info",
        text: `🎯 ${scenario.goalText}. ${scenario.description}`,
      });
      setPhase("training");
      onBoardUpdate({
        fen: g.fen(),
        orientation: g.turn() === "w" ? "white" : "black",
        arrows: [],
        isTrainingActive: true,
      });
    },
    [onBoardUpdate],
  );

  // ── Training move handler ──────────────────────────────────────────────────
  const handleTrainingMove = useCallback(
    (from, to) => {
      const game = chessRef.current;
      if (!game || status !== "playing") return false;

      try {
        const mv = game.move({ from, to, promotion: "q" });
        if (!mv) return false;

        const newFen = game.fen();
        setFen(newFen);
        setMoveCount((c) => c + 1);

        if (game.isCheckmate()) {
          setStatus("won");
          setFeedback({
            type: "success",
            text: `🏆 Checkmate! Excellent technique! You successfully executed the ${selectedScenario?.category} endgame.`,
          });
          onBoardUpdate({ fen: newFen, orientation: game.turn() === "w" ? "black" : "white", arrows: [], isTrainingActive: true });
          return true;
        }

        if (game.isStalemate() || game.isDraw()) {
          setStatus("drawn");
          setFeedback({
            type: "error",
            text: `⚠️ Stalemate or draw! In ${selectedScenario?.category} endgames, be careful not to trap the king without giving check. Try again!`,
          });
          onBoardUpdate({ fen: newFen, orientation: game.turn() === "w" ? "white" : "black", arrows: [], isTrainingActive: true });
          return true;
        }

        // Give contextual feedback every few moves
        const tips = getEndgameTip(selectedScenario, game, moveCount);
        setFeedback({
          type: "info",
          text: tips,
        });
        onBoardUpdate({ fen: newFen, orientation: game.turn() === "w" ? "white" : "black", arrows: [], isTrainingActive: true });
        return true;
      } catch {
        return false;
      }
    },
    [chessRef, status, selectedScenario, moveCount, onBoardUpdate],
  );

  // Register/unregister handler
  useEffect(() => {
    if (phase === "training") {
      onRegisterMoveHandler(handleTrainingMove);
    } else {
      onRegisterMoveHandler(null);
    }
    return () => onRegisterMoveHandler(null);
  }, [phase, handleTrainingMove, onRegisterMoveHandler]);

  const handleBackToList = () => {
    clearTimeout(engineTimerRef.current);
    onRegisterMoveHandler(null);
    onBoardUpdate({ fen: null, orientation: "white", arrows: [], isTrainingActive: false });
    setPhase("list");
    setSelectedScenario(null);
  };

  const categories = ["all", ...new Set(ENDGAMES.map((e) => e.category))];
  const filtered = ENDGAMES.filter(
    (e) => catFilter === "all" || e.category === catFilter,
  );

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (phase === "list") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Crown className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Endgame Training</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {ENDGAMES.length} scenarios
          </span>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-border shrink-0 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide transition-colors border whitespace-nowrap shrink-0 ${
                catFilter === c
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-2 py-2 space-y-1.5">
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => startScenario(e)}
              className="w-full text-left p-2.5 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-start gap-2 mb-1">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex-1">
                  {e.title}
                </p>
                <div className="flex gap-1 shrink-0">
                  <Badge
                    label={e.difficulty}
                    className={DIFF_STYLE[e.difficulty]}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {e.description}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Target className="h-3 w-3 text-primary/60" />
                <span className="text-[11px] text-primary/70">{e.goalText}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── TRAINING PHASE ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <button
          onClick={handleBackToList}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Crown className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">
            {selectedScenario?.title}
          </p>
          <p className="text-[10px] text-muted-foreground capitalize">
            {selectedScenario?.category} · Move {moveCount}
          </p>
        </div>
        <Badge
          label={selectedScenario?.difficulty}
          className={DIFF_STYLE[selectedScenario?.difficulty]}
        />
      </div>

      {/* Goal */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">
            {selectedScenario?.goalText}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {feedback && (
          <div
            className={`rounded-xl p-3 text-xs leading-relaxed border ${
              feedback.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                : feedback.type === "error"
                  ? "bg-red-950/40 border-red-500/40 text-red-300"
                  : "bg-muted/40 border-border text-foreground/80"
            }`}
          >
            {feedback.type === "success" && (
              <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />
            )}
            {feedback.type === "error" && (
              <XCircle className="h-3.5 w-3.5 inline mr-1.5" />
            )}
            {feedback.type === "info" && (
              <Info className="h-3.5 w-3.5 inline mr-1.5" />
            )}
            {feedback.text}
          </div>
        )}

        {/* Description & technique */}
        <div className="rounded-xl p-3 bg-muted/30 border border-border space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-400">
              Technique
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {selectedScenario?.description}
          </p>
        </div>

        {/* Move count indicator */}
        {moveCount > 0 && status === "playing" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-primary">
              {moveCount} {moveCount === 1 ? "move" : "moves"} made — keep going!
            </span>
          </div>
        )}

        {/* Won / drawn states */}
        {status === "won" && (
          <div className="rounded-xl p-3 bg-emerald-950/30 border border-emerald-500/30">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <span className="text-xs font-semibold text-yellow-400">
                Excellent!
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              You mastered this endgame in {moveCount} moves. Try to find if you
              can do it in fewer moves!
            </p>
          </div>
        )}

        {status === "drawn" && (
          <div className="rounded-xl p-3 bg-orange-950/30 border border-orange-500/30">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="h-4 w-4 text-orange-400" />
              <span className="text-xs font-semibold text-orange-400">
                Draw — Try Again!
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              You need to checkmate without causing stalemate. Restart and take
              it step by step.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-2.5 border-t border-border shrink-0 space-y-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={() => startScenario(selectedScenario)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={handleBackToList}
          >
            <Crown className="h-3 w-3 mr-1" />
            New Scenario
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Endgame tip generator ──────────────────────────────────────────────────
function getEndgameTip(scenario, game, moveCount) {
  if (!scenario) return "Make your move!";
  const { category } = scenario;

  const tips = {
    KQK: [
      "Use your queen to cut off the enemy king's escape squares.",
      "Box the king into a corner — your queen controls long diagonals and ranks!",
      "Bring your king closer to support the queen attack.",
      "Force the king to the edge, then close in for checkmate.",
    ],
    KRK: [
      "Use the rook to push the enemy king toward the edge.",
      "Keep your king active — it must support the rook to deliver checkmate.",
      "The 'lawnmower' technique: rook cuts off ranks one by one.",
      "Create a 'box' around the enemy king and shrink it each move.",
    ],
    KPK: [
      "Push the pawn while keeping your king in front of it.",
      "The key is the Opposition — put your kings face to face!",
      "Reach the 6th rank with your king to ensure promotion.",
      "Watch out for stalemate traps near the corner!",
    ],
    default: [
      "Stay patient and use your pieces together.",
      "Activate your king — in endgames, the king is a powerful piece!",
      "Control the center even in endgames.",
      "Calculate each move carefully before playing.",
    ],
  };

  const tipSet = tips[category] || tips.default;
  return tipSet[moveCount % tipSet.length];
}

// ═══════════════════════════════════════════════════════════════════════════
// ── TRAINING MODE SELECTOR ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const MODULES = [
  {
    id: "puzzle",
    icon: Puzzle,
    label: "Tactical Puzzles",
    desc: "Sharpen your calculation with curated tactical positions.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30 hover:border-orange-400/60",
    count: `${PUZZLES.length} puzzles`,
  },
  {
    id: "opening",
    icon: BookOpen,
    label: "Opening Drill",
    desc: "Memorize and practice opening theory move by move.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30 hover:border-blue-400/60",
    count: `${OPENINGS.length} openings`,
  },
  {
    id: "endgame",
    icon: Crown,
    label: "Endgame Training",
    desc: "Master essential endgame techniques and patterns.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30 hover:border-yellow-400/60",
    count: `${ENDGAMES.length} scenarios`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ── MAIN TRAINING PANEL COMPONENT ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
/**
 * TrainingPanel replaces ChatPanel when Learning mode is ON.
 *
 * Props:
 * - onBoardUpdate({ fen, orientation, arrows, isTrainingActive }) — updates main board
 * - onRegisterMoveHandler(fn | null) — registers/unregisters training move handler
 */
export default function TrainingPanel({ onBoardUpdate, onRegisterMoveHandler }) {
  const [activeModule, setActiveModule] = useState(null); // null | "puzzle" | "opening" | "endgame"

  const handleBack = () => {
    onRegisterMoveHandler(null);
    onBoardUpdate({ fen: null, orientation: "white", arrows: [], isTrainingActive: false });
    setActiveModule(null);
  };

  // ── Module selector ────────────────────────────────────────────────────────
  if (!activeModule) {
    return (
      <div className="flex flex-col h-full border-l border-border bg-card">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <Dumbbell className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Training Mode</span>
          <span className="ml-auto text-[10px] text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 font-medium uppercase tracking-wide">
            Learning On
          </span>
        </div>

        {/* Intro */}
        <div className="px-4 py-3 border-b border-border/50 shrink-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Select a training module to load positions on the board. Each module
            guides you step-by-step with explanations and feedback.
          </p>
        </div>

        {/* Module cards */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${mod.border} ${mod.bg} hover:scale-[1.01] group`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-2 rounded-lg ${mod.bg} border border-white/10`}>
                    <Icon className={`h-5 w-5 ${mod.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold ${mod.color}`}>
                        {mod.label}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {mod.count}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 ${mod.color} opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
            <p>
              Turn off <span className="text-primary">Learning</span> in the top bar
              to switch back to Engine analysis and AI coach.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sharedProps = {
    onBoardUpdate,
    onRegisterMoveHandler,
    onBack: handleBack,
  };

  return (
    <div className="flex flex-col h-full border-l border-border bg-card">
      {activeModule === "puzzle" && <PuzzleTrainer {...sharedProps} />}
      {activeModule === "opening" && <OpeningTrainer {...sharedProps} />}
      {activeModule === "endgame" && <EndgameTrainer {...sharedProps} />}
    </div>
  );
}
