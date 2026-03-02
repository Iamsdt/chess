import { useRef, useEffect, useMemo, useState, Fragment } from "react";
import {
  ArrowDownUp,
  ChevronLeft,
  BookOpen,
  SkipBack,
  SkipForward,
  ChevronRight,
  X,
  Copy,
  BarChart2,
  Loader2,
  Timer,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatTime } from "@/hooks/useChessClock";

const qualityVariantMap = {
  excellent: "excellent",
  good: "good",
  inaccuracy: "inaccuracy",
  mistake: "mistake",
  blunder: "blunder",
};

function EvalBar({ score }) {
  const clamped = score === null ? 0 : Math.max(-5, Math.min(5, score));
  const whitePercent = Math.round(50 + (clamped / 5) * 40);
  const label =
    score === null
      ? "—"
      : score > 0
        ? `+${score.toFixed(1)}`
        : score.toFixed(1);

  return (
    <div className="p-3 border-t border-border shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Evaluation
        </span>
        <span className="text-xs font-semibold tabular-nums text-foreground">
          {label}
        </span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden bg-black border border-border/40">
        <div
          className="absolute right-0 top-0 bottom-0 bg-white transition-all duration-500 ease-out"
          style={{ width: `${whitePercent}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">Black</span>
        <span className="text-[10px] text-muted-foreground">Equal</span>
        <span className="text-[10px] text-muted-foreground">White</span>
      </div>
    </div>
  );
}

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };

function getCapturedPieces(game) {
  const start = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1 },
  };
  const board = game.board();
  const current = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  for (const row of board) {
    for (const sq of row) {
      if (sq) current[sq.color][sq.type]++;
    }
  }
  const capturedPts = { w: 0, b: 0 };
  for (const color of ["w", "b"]) {
    for (const piece of ["q", "r", "b", "n", "p"]) {
      const diff = start[color][piece] - current[color][piece];
      capturedPts[color] += (PIECE_VALUES[piece] || 0) * Math.max(0, diff);
    }
  }
  return { capturedPts };
}

function MoveHistorySidebar({
  moveHistory = [], // { san, fen, from, to }[]
  evalScore = null,
  onFlipBoard,
  onUndo,
  onCopyPgn,
  moveQuality,
  game,
  viewIndex, // null = live, -1 = start, 0..n-1 = historical
  onJumpToMove,
  onExitReview,
  onNavigateBack,
  onNavigateForward,
  isAnalyzing = false,
  analysisProgress = 0,
  gameReport = null,
  onViewReport,
  // Chess clock
  clockEnabled = false,
  timeWhite = null,
  timeBlack = null,
  currentTurn = "w",
  clockFlagged = null,
  // Annotations
  annotations = {},
  onAnnotationChange = null,
}) {
  const fen = game.fen();
  const { capturedPts } = useMemo(() => getCapturedPieces(game), [game, fen]);

  // Build pairs from { san }[] entries
  const pairs = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moveHistory[i]?.san ?? moveHistory[i],
      whiteIdx: i,
      black: moveHistory[i + 1]
        ? (moveHistory[i + 1]?.san ?? moveHistory[i + 1])
        : null,
      blackIdx: i + 1,
    });
  }

  const isReviewMode = viewIndex !== null;
  const endRef = useRef(null);
  const activeRowRef = useRef(null);
  const [editingAnnotationIdx, setEditingAnnotationIdx] = useState(null);
  const [annotationDraft, setAnnotationDraft] = useState("");

  // Auto-scroll to bottom when new moves arrive (live mode)
  useEffect(() => {
    if (!isReviewMode) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [moveHistory, isReviewMode]);

  // Scroll active (reviewed) move into view
  useEffect(() => {
    if (isReviewMode && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [viewIndex, isReviewMode]);

  function isMoveActive(idx) {
    if (viewIndex === null) return false;
    return viewIndex === idx;
  }

  function isLastLiveMove(idx) {
    if (viewIndex !== null) return false;
    return idx === moveHistory.length - 1;
  }

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Controls: Flip + quality badge + Undo */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onFlipBoard}
          title="Flip board"
          className="text-muted-foreground h-7 px-2 text-xs"
        >
          <ArrowDownUp className="h-3 w-3" />
          Flip
        </Button>

        {moveQuality && !isReviewMode && (
          <Badge
            variant={qualityVariantMap[moveQuality.toLowerCase()] || "default"}
            className="text-[10px]"
          >
            {moveQuality}
          </Badge>
        )}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={moveHistory.length === 0 || isReviewMode}
          title="Undo last move"
          className="text-muted-foreground h-7 px-2 text-xs"
        >
          <ChevronLeft className="h-3 w-3" />
          Undo
        </Button>

        {moveHistory.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopyPgn}
            title="Copy game as PGN"
            className="text-muted-foreground h-7 px-2 text-xs"
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Review mode nav bar */}
      {isReviewMode && (
        <div className="flex items-center gap-0.5 px-1.5 py-1.5 border-b border-border bg-primary/5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onJumpToMove(-1)}
            title="Go to start"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <SkipBack className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateBack}
            title="Previous move (←)"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateForward}
            title="Next move (→)"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onJumpToMove(moveHistory.length - 1)}
            title="Go to end"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="h-3 w-3" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onExitReview}
            title="Return to live game (Esc)"
            className="h-6 px-2 text-[10px] text-primary hover:text-primary gap-1"
          >
            <X className="h-3 w-3" />
            Live
          </Button>
        </div>
      )}

      {/* Move list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {pairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
            <BookOpen className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-xs">No moves yet</p>
            <p className="text-[10px] mt-1 opacity-60">
              Make a move to see history
            </p>
          </div>
        ) : (
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border sticky top-0 bg-card">
                <th className="text-left px-2 py-1.5 w-7">#</th>
                <th className="text-left px-2 py-1.5">
                  White {capturedPts.b > 0 ? `+${capturedPts.b}` : ""}
                </th>
                <th className="text-left px-2 py-1.5">
                  Black {capturedPts.w > 0 ? `+${capturedPts.w}` : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair) => {
                const whiteActive = isMoveActive(pair.whiteIdx);
                const blackActive = isMoveActive(pair.blackIdx);
                const whiteLastLive = isLastLiveMove(pair.whiteIdx);
                const blackLastLive = isLastLiveMove(pair.blackIdx);
                const rowRef = whiteActive || blackActive ? activeRowRef : null;
                const whiteNote = annotations[pair.whiteIdx];
                const blackNote = annotations[pair.blackIdx];

                function openAnnotation(idx, currentNote) {
                  if (!onAnnotationChange) return;
                  setEditingAnnotationIdx(idx);
                  setAnnotationDraft(currentNote || "");
                }

                function saveAnnotation() {
                  if (onAnnotationChange && editingAnnotationIdx !== null) {
                    onAnnotationChange(
                      editingAnnotationIdx,
                      annotationDraft.trim(),
                    );
                  }
                  setEditingAnnotationIdx(null);
                  setAnnotationDraft("");
                }

                return (
                  <Fragment key={pair.number}>
                    <tr
                      ref={rowRef}
                      className="border-b border-border/30 transition-colors group"
                    >
                      <td className="px-2 py-1 text-muted-foreground">
                        {pair.number}.
                      </td>
                      {/* White move cell */}
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <span
                            onClick={() => onJumpToMove(pair.whiteIdx)}
                            className={`cursor-pointer rounded transition-colors
                              ${
                                whiteActive
                                  ? "bg-primary text-primary-foreground font-bold px-1"
                                  : whiteLastLive
                                    ? "font-bold text-primary hover:bg-secondary/60"
                                    : "font-semibold text-foreground hover:bg-secondary/60"
                              }`}
                          >
                            {pair.white}
                          </span>
                          {onAnnotationChange && (
                            <button
                              onClick={() =>
                                openAnnotation(pair.whiteIdx, whiteNote)
                              }
                              className={`opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-secondary ${
                                whiteNote
                                  ? "!opacity-100 text-primary"
                                  : "text-muted-foreground"
                              }`}
                              title={whiteNote || "Add annotation"}
                            >
                              <MessageSquare className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                        {whiteNote && (
                          <p className="text-[10px] text-primary/70 italic mt-0.5 font-sans">
                            {whiteNote}
                          </p>
                        )}
                      </td>
                      {/* Black move cell */}
                      <td className="px-2 py-1">
                        {pair.black ? (
                          <div className="flex items-center gap-1">
                            <span
                              onClick={() => onJumpToMove(pair.blackIdx)}
                              className={`cursor-pointer rounded transition-colors
                                ${
                                  blackActive
                                    ? "bg-primary text-primary-foreground font-bold px-1"
                                    : blackLastLive
                                      ? "font-bold text-primary hover:bg-secondary/60"
                                      : "text-foreground hover:bg-secondary/60"
                                }`}
                            >
                              {pair.black}
                            </span>
                            {onAnnotationChange && (
                              <button
                                onClick={() =>
                                  openAnnotation(pair.blackIdx, blackNote)
                                }
                                className={`opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-secondary ${
                                  blackNote
                                    ? "!opacity-100 text-primary"
                                    : "text-muted-foreground"
                                }`}
                                title={blackNote || "Add annotation"}
                              >
                                <MessageSquare className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                        {blackNote && (
                          <p className="text-[10px] text-primary/70 italic mt-0.5 font-sans">
                            {blackNote}
                          </p>
                        )}
                      </td>
                    </tr>
                    {/* Inline annotation editor row */}
                    {editingAnnotationIdx !== null &&
                      (editingAnnotationIdx === pair.whiteIdx ||
                        editingAnnotationIdx === pair.blackIdx) && (
                        <tr
                          key={`note-${pair.number}`}
                          className="bg-primary/5"
                        >
                          <td colSpan={3} className="px-2 py-1.5">
                            <div className="flex gap-1 items-end">
                              <textarea
                                autoFocus
                                value={annotationDraft}
                                onChange={(e) =>
                                  setAnnotationDraft(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    saveAnnotation();
                                  }
                                  if (e.key === "Escape") {
                                    setEditingAnnotationIdx(null);
                                  }
                                }}
                                placeholder="Add a note… (Enter to save, Esc to cancel)"
                                className="flex-1 bg-secondary/50 border border-primary/30 rounded px-2 py-1 text-[11px] text-foreground placeholder-muted-foreground resize-none outline-none focus:border-primary/70 font-sans"
                                rows={2}
                              />
                              <button
                                onClick={saveAnnotation}
                                className="text-[10px] bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/80 transition-colors font-medium"
                              >
                                Save
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        <div ref={endRef} />
      </div>

      {/* Post-game analysis status */}
      {(isAnalyzing || gameReport) && (
        <div className="shrink-0 border-t border-border px-2 py-2">
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span>Analyzing game…</span>
              <span className="ml-auto tabular-nums">{analysisProgress}%</span>
            </div>
          ) : gameReport ? (
            <button
              onClick={onViewReport}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              View Analysis Report
            </button>
          ) : null}
        </div>
      )}

      {/* Chess clock panel */}
      {clockEnabled && timeWhite !== null && timeBlack !== null && (
        <div className="shrink-0 border-t border-border px-3 py-2 bg-secondary/10">
          <div className="flex items-center gap-1 mb-1.5">
            <Timer className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Clock
            </span>
          </div>
          <div className="flex gap-2">
            {/* Black clock */}
            <div
              className={`flex-1 rounded-md border px-2 py-1.5 text-center transition-colors ${
                clockFlagged === "b"
                  ? "border-red-500/60 bg-red-500/10"
                  : currentTurn === "b" && !clockFlagged
                    ? "border-primary/70 bg-primary/10"
                    : "border-border bg-secondary/30"
              }`}
            >
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">
                Black
              </p>
              <p
                className={`text-lg font-mono font-bold tabular-nums leading-none ${
                  clockFlagged === "b"
                    ? "text-red-400"
                    : currentTurn === "b" && !clockFlagged
                      ? "text-primary"
                      : "text-foreground"
                }`}
              >
                {clockFlagged === "b" ? "⏱ TIME" : formatTime(timeBlack)}
              </p>
            </div>
            {/* White clock */}
            <div
              className={`flex-1 rounded-md border px-2 py-1.5 text-center transition-colors ${
                clockFlagged === "w"
                  ? "border-red-500/60 bg-red-500/10"
                  : currentTurn === "w" && !clockFlagged
                    ? "border-primary/70 bg-primary/10"
                    : "border-border bg-secondary/30"
              }`}
            >
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">
                White
              </p>
              <p
                className={`text-lg font-mono font-bold tabular-nums leading-none ${
                  clockFlagged === "w"
                    ? "text-red-400"
                    : currentTurn === "w" && !clockFlagged
                      ? "text-primary"
                      : "text-foreground"
                }`}
              >
                {clockFlagged === "w" ? "⏱ TIME" : formatTime(timeWhite)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation bar pinned at bottom */}
      <EvalBar score={evalScore} />
    </div>
  );
}

export default MoveHistorySidebar;
