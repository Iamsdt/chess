import { Chess } from "chess.js";
import { ArrowLeftRight, BookOpen, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";

import { Button } from "@/components/ui/button";
import {
  loadTutorialByFile,
  loadTutorialCatalog,
  normalizeSan,
} from "@/lib/opening-tutorials";

const CATEGORY_STYLE = {
  open: { color: "text-blue-400", emoji: "⚔️" },
  "semi-open": { color: "text-yellow-400", emoji: "🔀" },
  closed: { color: "text-purple-400", emoji: "🛡️" },
  flank: { color: "text-green-400", emoji: "🌀" },
};

const sideLabel = (side) => (side === "black" ? "Black" : "White");

const buildSquareStyles = (lastMoveSquares, focusSquares) => {
  const styles = {};

  for (const square of focusSquares) {
    styles[square] = {
      backgroundColor: "rgba(56, 189, 248, 0.18)",
      boxShadow: "inset 0 0 0 2px rgba(56, 189, 248, 0.5)",
    };
  }

  for (const square of Object.keys(lastMoveSquares)) {
    styles[square] = {
      ...(styles[square] ?? {}),
      backgroundColor: "rgba(250, 204, 21, 0.35)",
    };
  }

  return styles;
};

const buildCorrectionArrow = (fen, san) => {
  try {
    const preview = new Chess(fen);
    const move = preview.move(san);
    if (!move) return [];

    return [
      {
        startSquare: move.from,
        endSquare: move.to,
        color: "#22c55e",
      },
    ];
  } catch {
    return [];
  }
};

/**
 *
 */
export default function OpeningDrillMode({ onClose }) {
  const chessReference = useRef(new Chess());
  const opponentTimeoutReference = useRef(null);
  const wrongMoveTimeoutReference = useRef(null);

  const [phase, setPhase] = useState("select");
  const [searchQuery, setSearchQuery] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [catalogError, setCatalogError] = useState("");

  const [tutorial, setTutorial] = useState(null);
  const [tutorialState, setTutorialState] = useState("idle");
  const [tutorialError, setTutorialError] = useState("");

  const [fen, setFen] = useState(chessReference.current.fen());
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [status, setStatus] = useState("idle");
  const [lastMoveSquares, setLastMoveSquares] = useState({});
  const [correctionArrow, setCorrectionArrow] = useState([]);
  const [boardOrientation, setBoardOrientation] = useState("white");

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      setCatalogState("loading");
      setCatalogError("");

      try {
        const data = await loadTutorialCatalog();
        if (cancelled) return;
        setCatalog(data.items);
        setCatalogState("ready");
      } catch (error) {
        if (cancelled) return;
        setCatalogError(
          error instanceof Error ? error.message : "Failed to load tutorials.",
        );
        setCatalogState("error");
      }
    };

    loadCatalog();

    return () => {
      cancelled = true;
      clearTimeout(opponentTimeoutReference.current);
      clearTimeout(wrongMoveTimeoutReference.current);
    };
  }, []);

  const resetBoardState = useCallback((nextTutorial) => {
    chessReference.current = new Chess();
    setFen(chessReference.current.fen());
    setCurrentStepIndex(0);
    setStatus("idle");
    setLastMoveSquares({});
    setCorrectionArrow([]);
    setBoardOrientation(nextTutorial.defaultOrientation);
  }, []);

  const openTutorial = useCallback(
    async (entry) => {
      clearTimeout(opponentTimeoutReference.current);
      clearTimeout(wrongMoveTimeoutReference.current);
      setTutorialState("loading");
      setTutorialError("");

      try {
        const loadedTutorial = await loadTutorialByFile(entry.file);
        setTutorial(loadedTutorial);
        resetBoardState(loadedTutorial);
        setTutorialState("ready");
        setPhase("drill");
      } catch (error) {
        setTutorial(null);
        setTutorialError(
          error instanceof Error ? error.message : "Failed to open tutorial.",
        );
        setTutorialState("error");
        setPhase("select");
      }
    },
    [resetBoardState],
  );

  const restartTutorial = useCallback(() => {
    if (!tutorial) return;
    clearTimeout(opponentTimeoutReference.current);
    clearTimeout(wrongMoveTimeoutReference.current);
    resetBoardState(tutorial);
    setTutorialState("ready");
  }, [resetBoardState, tutorial]);

  const currentStep = tutorial?.steps[currentStepIndex] ?? null;
  const previousStep =
    tutorial && currentStepIndex > 0
      ? tutorial.steps[currentStepIndex - 1]
      : null;

  useEffect(() => {
    clearTimeout(opponentTimeoutReference.current);

    if (
      phase !== "drill" ||
      tutorialState !== "ready" ||
      !tutorial ||
      !currentStep ||
      currentStep.actor !== "opponent"
    ) {
      return undefined;
    }

    setStatus("opponent");

    opponentTimeoutReference.current = setTimeout(() => {
      try {
        const move = chessReference.current.move(currentStep.san);
        if (!move) {
          throw new Error(
            `The tutorial move ${currentStep.san} is illegal in the current position.`,
          );
        }

        setFen(chessReference.current.fen());
        setLastMoveSquares({ [move.from]: true, [move.to]: true });
        setCorrectionArrow([]);
        setCurrentStepIndex((index) => index + 1);

        if (currentStepIndex + 1 >= tutorial.steps.length) {
          setStatus("complete");
          return;
        }

        setStatus("idle");
      } catch (error) {
        setTutorialError(
          error instanceof Error
            ? error.message
            : "Failed to play tutorial move.",
        );
        setTutorialState("error");
      }
    }, 950);

    return () => clearTimeout(opponentTimeoutReference.current);
  }, [currentStep, currentStepIndex, phase, tutorial, tutorialState]);

  const handleDrop = useCallback(
    (from, to) => {
      if (
        tutorialState !== "ready" ||
        !tutorial ||
        !currentStep ||
        currentStep.actor !== "player" ||
        status === "complete"
      ) {
        return false;
      }

      let move;
      try {
        move = chessReference.current.move({ from, to, promotion: "q" });
        if (!move) return false;
      } catch {
        return false;
      }

      if (normalizeSan(move.san) === currentStep.san) {
        setFen(chessReference.current.fen());
        setLastMoveSquares({ [move.from]: true, [move.to]: true });
        setCorrectionArrow([]);
        setStatus("idle");
        setCurrentStepIndex((index) => index + 1);

        if (currentStepIndex + 1 >= tutorial.steps.length) {
          setStatus("complete");
        }

        return true;
      }

      chessReference.current.undo();
      setStatus("wrong");
      setCorrectionArrow(
        buildCorrectionArrow(chessReference.current.fen(), currentStep.san),
      );
      clearTimeout(wrongMoveTimeoutReference.current);
      wrongMoveTimeoutReference.current = setTimeout(() => {
        setStatus((value) => (value === "wrong" ? "idle" : value));
        setCorrectionArrow([]);
      }, 2200);
      return false;
    },
    [currentStep, currentStepIndex, status, tutorial, tutorialState],
  );

  const filteredCatalog = catalog.filter((entry) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return [entry.title, entry.eco, entry.summary, ...(entry.tags ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const progressPct = tutorial
    ? Math.round((currentStepIndex / tutorial.steps.length) * 100)
    : 0;

  const cat = CATEGORY_STYLE[tutorial?.category] ?? CATEGORY_STYLE.open;
  const displayArrows =
    correctionArrow.length > 0 ? correctionArrow : (currentStep?.arrows ?? []);
  const squareStyles = buildSquareStyles(
    lastMoveSquares,
    currentStep?.focusSquares ?? previousStep?.focusSquares ?? [],
  );

  const isPlayerTurn =
    tutorialState === "ready" &&
    status !== "complete" &&
    currentStep?.actor === "player";

  const statusMessage =
    status === "complete"
      ? (tutorial?.completionSummary ?? "Tutorial complete.")
      : status === "wrong"
        ? currentStep?.hint ||
          `Look again and find ${currentStep?.san ?? "the move"}.`
        : status === "opponent"
          ? `${sideLabel(tutorial?.side)}'s opponent demonstrates ${currentStep?.san}.`
          : currentStep?.instruction || "Follow the lesson step by step.";

  if (phase === "select") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-card border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">
                Opening Tutorials
              </p>
              <h2 className="text-base font-semibold text-foreground mt-0.5">
                Learn full ideas, not one-move drills
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid md:grid-cols-[280px_1fr] min-h-0 flex-1">
            <div className="border-r border-border p-4 bg-black/10 space-y-4">
              <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  How this works
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each tutorial is a JSON script from the public tutorial
                  library. It controls both sides, explains the purpose of each
                  move, and ends on a concrete plan or tactical gain.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Search library
                </p>
                <input
                  type="text"
                  placeholder="French, Milner-Barry, C02..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/70 transition-colors"
                />
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Quality target
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed list-disc pl-4">
                  <li>Longer scripted lines with real plans</li>
                  <li>Coach-controlled opponent responses</li>
                  <li>Curated traps only when the tactic is real</li>
                </ul>
              </div>
            </div>

            <div className="min-h-0 flex flex-col">
              {catalogState === "loading" && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading tutorial library...
                </div>
              )}

              {catalogState === "error" && (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 space-y-3">
                    <p className="font-semibold text-red-200">
                      Could not load tutorial library
                    </p>
                    <p>{catalogError}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.location.reload()}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {catalogState === "ready" && (
                <div className="overflow-y-auto flex-1 p-3">
                  <div className="grid gap-3">
                    {filteredCatalog.map((entry) => {
                      const entryCategory =
                        CATEGORY_STYLE[entry.category] ??
                        CATEGORY_STYLE["semi-open"];

                      return (
                        <button
                          key={entry.id}
                          onClick={() => openTutorial(entry)}
                          className="w-full rounded-2xl border border-border bg-secondary/20 hover:bg-secondary/35 transition-colors p-4 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-lg">
                                  {entryCategory.emoji}
                                </span>
                                <span className="text-sm font-semibold text-foreground">
                                  {entry.title}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-1 rounded">
                                  {entry.eco}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wide ${entryCategory.color}`}
                                >
                                  {entry.category}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {entry.summary}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                                <span className="rounded-full border border-border px-2 py-0.5">
                                  Play as {sideLabel(entry.side)}
                                </span>
                                <span className="rounded-full border border-border px-2 py-0.5">
                                  {entry.stepCount} scripted steps
                                </span>
                                <span className="rounded-full border border-border px-2 py-0.5 capitalize">
                                  {entry.difficulty}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 text-primary text-xs font-semibold">
                              Open tutorial
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {filteredCatalog.length === 0 && (
                      <div className="rounded-2xl border border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
                        No tutorials match your search.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col lg:flex-row gap-0 w-full max-w-295 overflow-hidden max-h-[95vh]">
        <div className="shrink-0 w-full lg:w-130 p-4 bg-black/20 border-b lg:border-b-0 lg:border-r border-border">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">
                Opening Tutorial
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tutorial?.title} · Play as {sideLabel(tutorial?.side)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setBoardOrientation((value) =>
                    value === "white" ? "black" : "white",
                  )
                }
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary"
                title="Flip board"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPhase("select")}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary"
                title="Change tutorial"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden shadow-2xl">
            <Chessboard
              options={{
                id: "opening-tutorial-board",
                position: fen,
                onPieceDrop: ({ sourceSquare, targetSquare }) =>
                  handleDrop(sourceSquare, targetSquare),
                boardOrientation,
                allowDragging: isPlayerTurn,
                canDragPiece: () => isPlayerTurn,
                animationDurationInMs: 220,
                boardStyle: { borderRadius: "12px" },
                darkSquareStyle: { backgroundColor: "#4a7c59" },
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
                squareStyles,
                showNotation: true,
                arrows: displayArrows,
                clearArrowsOnPositionChange: false,
                clearArrowsOnClick: false,
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Board view:{" "}
              {boardOrientation === "white"
                ? "White at bottom"
                : "Black at bottom"}
            </span>
            <span>{progressPct}% complete</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">
                  {tutorial?.title}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-1 rounded">
                  {tutorial?.eco}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${cat.color}`}
                >
                  {cat.emoji} {tutorial?.category}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary rounded-full border border-primary/30 px-2 py-0.5">
                  {tutorial?.difficulty}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                {tutorial?.description}
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={restartTutorial}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Restart
              </Button>
            </div>
          </div>

          {tutorialState === "error" && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 space-y-2">
              <p className="font-semibold text-red-200">Tutorial error</p>
              <p>
                {tutorialError || "This tutorial script could not continue."}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Step{" "}
                {Math.min(currentStepIndex + 1, tutorial?.steps.length ?? 1)} /{" "}
                {tutorial?.steps.length}
              </span>
              <span>{progressPct}% mastered</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="grid xl:grid-cols-[1.25fr_0.75fr] gap-4">
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    {status === "complete"
                      ? "Result"
                      : currentStep?.actor === "player"
                        ? "Your Move"
                        : "Coach Move"}
                  </p>
                  {currentStep && status !== "complete" && (
                    <span className="text-[11px] rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                      Scripted move: {currentStep.san}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {status === "complete"
                      ? tutorial?.completionTitle
                      : currentStep?.title || "Follow the tutorial"}
                  </h3>
                  <p
                    className={`text-sm leading-relaxed ${
                      status === "wrong"
                        ? "text-red-300"
                        : status === "complete"
                          ? "text-green-300"
                          : "text-muted-foreground"
                    }`}
                  >
                    {statusMessage}
                  </p>
                </div>

                {status !== "complete" && currentStep?.coaching && (
                  <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-sm text-foreground leading-relaxed">
                    {currentStep.coaching}
                  </div>
                )}
              </div>

              {previousStep && status !== "complete" && (
                <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Last move explained
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">
                      {previousStep.title}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-1 rounded">
                      {previousStep.san}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {previousStep.coaching || previousStep.instruction}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Tutorial line
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tutorial?.steps.map((step, index) => {
                    const isPlayed = index < currentStepIndex;
                    const isCurrent =
                      index === currentStepIndex && status !== "complete";

                    return (
                      <span
                        key={`${Math.floor(index / 2) + 1}-${step.actor}-${step.san}-${step.title}`}
                        className={`text-xs px-2 py-1 rounded font-mono border ${
                          isPlayed
                            ? "text-muted-foreground bg-secondary/40 border-border/50"
                            : isCurrent
                              ? step.actor === "player"
                                ? "text-primary bg-primary/15 border-primary/40"
                                : "text-yellow-300 bg-yellow-500/10 border-yellow-500/30"
                              : "text-muted-foreground/40 border-border/30"
                        }`}
                        title={
                          step.actor === "player" ? "Your move" : "Coach move"
                        }
                      >
                        {index % 2 === 0 && `${Math.floor(index / 2) + 1}.`}
                        {step.san}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  What you are learning
                </p>
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  {tutorial?.objectives.map((objective) => (
                    <p key={objective}>{objective}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Core plans
                </p>
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  {tutorial?.plans.map((plan) => (
                    <p key={plan}>{plan}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Common mistakes to punish
                </p>
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  {tutorial?.commonMistakes.map((mistake) => (
                    <p key={mistake}>{mistake}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Full script
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {tutorial?.line}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
