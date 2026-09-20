import { Chess } from "chess.js";
import {
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Lightbulb,
  Puzzle,
  RotateCcw,
  SkipForward,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { TYPE_QUIZ } from "@/lib/progress";
import { loadQuizByFile, loadQuizCatalog } from "@/lib/puzzle-quizzes";
import useProgressStore from "@/store/use-progress-store";

const THEME_GUIDE = {
  checkmate: {
    intro: "Your goal is checkmate. Look for forcing moves first.",
    hint: "Checks, captures, and direct mating nets matter most here.",
  },
  fork: {
    intro: "One move should attack two targets at once.",
    hint: "Look for a knight or queen jump that hits multiple valuable pieces.",
  },
  pin: {
    intro: "A pinned piece cannot move freely without losing something bigger.",
    hint: "Line up your attack with the king, queen, or rook behind it.",
  },
  skewer: {
    intro: "Attack the more valuable piece first so the one behind it falls.",
    hint: "Long-range pieces are usually best for skewers.",
  },
  discovered: {
    intro: "Move one piece so another attack is revealed behind it.",
    hint: "Find the hidden line first, then clear it with tempo.",
  },
  deflection: {
    intro: "Remove a defender from its job before cashing in.",
    hint: "Ask which enemy piece is overloaded or guarding too much.",
  },
  "back-rank": {
    intro: "Back-rank weaknesses come from trapped kings and missing luft.",
    hint: "Check if the king has no escape square on the back rank.",
  },
  hanging: {
    intro: "An undefended piece can often be won cleanly.",
    hint: "Scan for loose pieces before calculating deep tactics.",
  },
  promotion: {
    intro: "Promotion races are about tempo and precise calculation.",
    hint: "Count checks and forcing moves before auto-queening.",
  },
};

const DIFF_STYLE = {
  easy: "text-green-400 bg-green-500/10 border-green-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  hard: "text-red-400 bg-red-500/10 border-red-500/20",
};

const Badge = ({ label, className }) => (
  <span
    className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${className}`}
  >
    {label}
  </span>
);

const TrainingPuzzleQuizPanel = ({
  onBoardUpdate,
  onRegisterMoveHandler,
  onBack,
}) => {
  const [phase, setPhase] = useState("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [solveFilter, setSolveFilter] = useState("all");
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [catalogError, setCatalogError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [solutionStep, setSolutionStep] = useState(0);
  const [status, setStatus] = useState("idle");
  const [feedback, setFeedback] = useState(null);
  const [quizError, setQuizError] = useState("");
  const [, setArrows] = useState([]);
  const [wrongCount, setWrongCount] = useState(0);

  const { fetchProgress, isSolved, solveItem, getSolvedCount } =
    useProgressStore();

  const chessReference = useRef(null);
  const orientationReference = useRef("white");
  const engineTimerReference = useRef(null);

  useEffect(() => {
    const loadProgress = async () => {
      await fetchProgress();
    };
    loadProgress();
  }, [fetchProgress]);

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      setCatalogState("loading");
      setCatalogError("");

      try {
        const data = await loadQuizCatalog();
        if (cancelled) return;
        setCatalog(data.items);
        setCatalogState("ready");
      } catch (error) {
        if (cancelled) return;
        setCatalogState("error");
        setCatalogError(
          error instanceof Error ? error.message : "Failed to load quizzes.",
        );
      }
    };

    loadCatalog();

    return () => {
      cancelled = true;
      clearTimeout(engineTimerReference.current);
    };
  }, []);

  const pushBoardState = useCallback(
    (nextArrows = []) => {
      if (!chessReference.current) return;

      onBoardUpdate({
        fen: chessReference.current.fen(),
        orientation: orientationReference.current,
        arrows: nextArrows,
        isTrainingActive: true,
      });
    },
    [onBoardUpdate],
  );

  const initializeQuiz = useCallback(
    (quiz, entry) => {
      clearTimeout(engineTimerReference.current);
      const game = new Chess(quiz.fen);
      chessReference.current = game;
      orientationReference.current = game.turn() === "b" ? "black" : "white";
      setSelectedEntry(entry);
      setSelectedQuiz(quiz);
      setSolutionStep(0);
      setStatus("idle");
      setWrongCount(0);
      setArrows([]);
      setQuizError("");
      setFeedback({
        type: "info",
        text: quiz.description || "Find the tactical solution.",
      });
      setPhase("training");

      onBoardUpdate({
        fen: game.fen(),
        orientation: orientationReference.current,
        arrows: [],
        isTrainingActive: true,
      });
    },
    [onBoardUpdate],
  );

  const openQuiz = useCallback(
    async (entry) => {
      try {
        const quiz = await loadQuizByFile(entry.file);
        initializeQuiz(quiz, entry);
      } catch (error) {
        setQuizError(
          error instanceof Error ? error.message : "Failed to open quiz.",
        );
      }
    },
    [initializeQuiz],
  );

  const guide = useMemo(
    () => THEME_GUIDE[selectedQuiz?.theme] || {},
    [selectedQuiz],
  );

  const playEngineStep = useCallback(
    (step) => {
      const quiz = selectedQuiz;
      const game = chessReference.current;
      if (!quiz || !game || step >= quiz.solution.length) return;

      const uci = quiz.solution[step];
      engineTimerReference.current = setTimeout(() => {
        try {
          const move = game.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci[4] || "q",
          });
          if (!move) return;

          const nextStep = step + 1;
          setSolutionStep(nextStep);
          setArrows([]);
          pushBoardState([]);

          if (nextStep >= quiz.solution.length) {
            setStatus("solved");
            setFeedback({
              type: "success",
              text: "Puzzle solved. You completed the full tactical line.",
            });
            if (selectedEntry?.id) {
              solveItem(selectedEntry.id, TYPE_QUIZ);
            }
            return;
          }

          setStatus("idle");
          setFeedback({
            type: "info",
            text: `Good. ${guide.hint || "Keep the tactic going."}`,
          });
        } catch {
          /* ignore */
        }
      }, 700);
    },
    [guide.hint, pushBoardState, selectedQuiz, selectedEntry?.id, solveItem],
  );

  const handleTrainingMove = useCallback(
    (from, to) => {
      const game = chessReference.current;
      const quiz = selectedQuiz;

      if (!game || !quiz || status === "solved" || status === "revealed") {
        return false;
      }

      const expectedUci = quiz.solution[solutionStep];
      if (!expectedUci) return false;

      try {
        const move = game.move({ from, to, promotion: expectedUci[4] || "q" });
        if (!move) return false;

        if (
          from === expectedUci.slice(0, 2) &&
          to === expectedUci.slice(2, 4)
        ) {
          const nextStep = solutionStep + 1;
          setSolutionStep(nextStep);
          setArrows([]);
          pushBoardState([]);

          if (nextStep >= quiz.solution.length) {
            setStatus("solved");
            setFeedback({
              type: "success",
              text: "Puzzle solved. You found the complete winning line.",
            });
            if (selectedEntry?.id) {
              solveItem(selectedEntry.id, TYPE_QUIZ);
            }
          } else {
            setStatus("correct-step");
            playEngineStep(nextStep);
          }

          return true;
        }

        game.undo();
        const nextWrongCount = wrongCount + 1;
        setWrongCount(nextWrongCount);
        setStatus("wrong");
        setFeedback({
          type: "error",
          text:
            nextWrongCount >= 2
              ? guide.hint || "Try to identify the forcing move first."
              : "That is not the tactical move here. Try again.",
        });
        return false;
      } catch {
        return false;
      }
    },
    [
      guide.hint,
      playEngineStep,
      pushBoardState,
      selectedQuiz,
      solutionStep,
      status,
      wrongCount,
      selectedEntry?.id,
      solveItem,
    ],
  );

  useEffect(() => {
    if (phase !== "training") {
      onRegisterMoveHandler(null);
      return () => onRegisterMoveHandler(null);
    }

    onRegisterMoveHandler(handleTrainingMove);
    return () => onRegisterMoveHandler(null);
  }, [handleTrainingMove, onRegisterMoveHandler, phase]);

  const handleHint = () => {
    if (!selectedQuiz || !chessReference.current) return;

    const uci = selectedQuiz.solution[solutionStep];
    if (!uci) return;

    const hintArrows = [
      {
        startSquare: uci.slice(0, 2),
        endSquare: uci.slice(2, 4),
        color: "#f59e0b",
      },
    ];

    setArrows(hintArrows);
    setFeedback({
      type: "info",
      text: `Hint: ${uci.slice(0, 2).toUpperCase()} to ${uci.slice(2, 4).toUpperCase()}.`,
    });
    pushBoardState(hintArrows);
  };

  const handleReveal = () => {
    if (!selectedQuiz || !chessReference.current) return;

    const revealArrows = selectedQuiz.solution
      .slice(solutionStep)
      .map((uci, index) => ({
        startSquare: uci.slice(0, 2),
        endSquare: uci.slice(2, 4),
        color: index % 2 === 0 ? "#22c55e" : "#ef4444",
      }));

    setStatus("revealed");
    setArrows(revealArrows);
    setFeedback({
      type: "info",
      text: "Solution revealed. Follow the arrows and study the sequence.",
    });
    pushBoardState(revealArrows);
  };

  const handleRetry = () => {
    if (selectedQuiz && selectedEntry) {
      initializeQuiz(selectedQuiz, selectedEntry);
    }
  };

  const handleNextQuiz = () => {
    if (!catalog.length || !selectedEntry) return;
    const currentIndex = catalog.findIndex(
      (entry) => entry.id === selectedEntry.id,
    );
    const nextEntry = catalog[(currentIndex + 1) % catalog.length];
    openQuiz(nextEntry);
  };

  const handleBackToList = () => {
    clearTimeout(engineTimerReference.current);
    onRegisterMoveHandler(null);
    onBoardUpdate({
      fen: null,
      orientation: "white",
      arrows: [],
      isTrainingActive: false,
    });
    setPhase("list");
    setSelectedEntry(null);
    setSelectedQuiz(null);
    setSolutionStep(0);
    setStatus("idle");
    setArrows([]);
    setQuizError("");
  };

  const displayed = catalog.filter((entry) => {
    const matchesDifficulty =
      difficultyFilter === "all" || entry.difficulty === difficultyFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [entry.title, entry.description, entry.theme]
        .join(" ")
        .toLowerCase()
        .includes(query);

    const matchesSolve =
      solveFilter === "all" ||
      (solveFilter === "solved" && isSolved(entry.id, TYPE_QUIZ)) ||
      (solveFilter === "unsolved" && !isSolved(entry.id, TYPE_QUIZ));

    return matchesDifficulty && matchesSearch && matchesSolve;
  });

  const solvedCount = getSolvedCount(TYPE_QUIZ);

  if (phase === "list") {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-150">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Puzzle className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Tactical Quizzes</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {catalog.length} quizzes
          </span>
        </div>

        <div className="px-3 py-2 border-b border-border shrink-0 space-y-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search quizzes..."
            className="w-full bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
          <div className="flex gap-1.5 overflow-x-auto">
            {["all", "easy", "medium", "hard"].map((difficulty) => (
              <button
                key={difficulty}
                onClick={() => setDifficultyFilter(difficulty)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-colors border whitespace-nowrap ${
                  difficultyFilter === difficulty
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {difficulty}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Quizzes are loaded from `/public/quiz/*.json` so you can add new
              tactical sets without touching the React code.
            </p>
            <div className="flex gap-1 shrink-0">
              {[
                { key: "all", label: "All" },
                { key: "unsolved", label: "To Solve" },
                { key: "solved", label: "Done" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSolveFilter(key)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                    solveFilter === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {label}
                  {key === "solved" && solvedCount > 0 && (
                    <span className="ml-1 text-primary/60">
                      ({solvedCount})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-2 py-2 space-y-1.5">
          {catalogState === "loading" && (
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              Loading quiz library...
            </div>
          )}

          {catalogState === "error" && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-300">
              {catalogError}
            </div>
          )}

          {quizError && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-300">
              {quizError}
            </div>
          )}

          {displayed.map((entry) => {
            const solved = isSolved(entry.id, TYPE_QUIZ);
            return (
              <button
                key={entry.id}
                onClick={() => openQuiz(entry)}
                className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {entry.title}
                      {solved && (
                        <Check className="h-3 w-3 text-green-500 inline ml-1" />
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {entry.description}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
                      <span className="rounded border border-border px-1.5 py-0.5 capitalize">
                        {entry.turn} to move
                      </span>
                      <span className="rounded border border-border px-1.5 py-0.5">
                        {entry.moveCount} ply
                      </span>
                      <span className="rounded border border-border px-1.5 py-0.5 capitalize">
                        {entry.theme}
                      </span>
                    </div>
                  </div>
                  <Badge
                    label={entry.difficulty}
                    className={DIFF_STYLE[entry.difficulty]}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const totalMoves = selectedQuiz?.solution.length ?? 1;
  const progressPct = Math.round((solutionStep / totalMoves) * 100);

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <button
          onClick={handleBackToList}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Puzzle className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">
            {selectedQuiz?.title}
          </p>
          <p className="text-[10px] text-muted-foreground capitalize">
            {selectedQuiz?.theme} · {selectedEntry?.turn} to move
          </p>
        </div>
        <Badge
          label={selectedQuiz?.difficulty}
          className={DIFF_STYLE[selectedQuiz?.difficulty]}
        />
      </div>

      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
          <span>
            Move {solutionStep} of {totalMoves}
          </span>
          <span className="text-primary font-medium">{progressPct}%</span>
        </div>
        <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

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
              <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5 shrink-0" />
            )}
            {feedback.type === "error" && (
              <XCircle className="h-3.5 w-3.5 inline mr-1.5 shrink-0" />
            )}
            {feedback.type === "info" && (
              <Info className="h-3.5 w-3.5 inline mr-1.5 shrink-0" />
            )}
            {feedback.text}
          </div>
        )}

        <div className="rounded-xl p-3 bg-muted/30 border border-border space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">
              Quiz Prompt
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {selectedQuiz?.description}
          </p>
        </div>

        <div className="rounded-xl p-3 bg-muted/30 border border-border space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-400">
              What to look for
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {guide.intro || "Find the strongest forcing move in the position."}
          </p>
          {guide.hint && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {guide.hint}
            </p>
          )}
        </div>

        {(status === "revealed" || status === "solved") &&
          selectedQuiz?.solution && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Solution Line
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedQuiz.solution.map((uci, index) => (
                  <span
                    key={`${uci}-${index}`}
                    className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                      index % 2 === 0
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-red-500/10 border-red-500/30 text-red-400"
                    }`}
                  >
                    {uci.slice(0, 2).toUpperCase()}→
                    {uci.slice(2, 4).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}

        {status === "solved" && (
          <div className="rounded-xl p-3 bg-emerald-950/30 border border-emerald-500/30 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-[11px] font-semibold text-yellow-400">
                Quiz Solved
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              You completed the full {selectedQuiz?.theme} sequence correctly.
            </p>
          </div>
        )}
      </div>

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
            onClick={handleRetry}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={handleNextQuiz}
          >
            Next
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TrainingPuzzleQuizPanel;
