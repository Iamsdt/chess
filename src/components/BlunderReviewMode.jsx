import { useState, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/Button";
import {
  X,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Target,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────
function getMoveSquares(fen, san) {
  try {
    const g = new Chess(fen);
    const mv = g.move(san);
    if (!mv) return null;
    return { from: mv.from, to: mv.to };
  } catch {
    return null;
  }
}

// ── BlunderReviewMode ─────────────────────────────────────────────────────────
// Full-screen overlay: shows each blunder/mistake position, asks the player
// to find the correct move. Reveals the engine's best move after each attempt.
export default function BlunderReviewMode({ blunders = [], onClose }) {
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [playerMoveSan, setPlayerMoveSan] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);

  const blunder = blunders[idx] ?? null;
  if (!blunder) return null;

  const isLastItem = idx === blunders.length - 1;
  const totalErrors = blunders.length;
  const orientation = blunder.side === "w" ? "white" : "black";
  const whoPlayed = blunder.side === "w" ? "White" : "Black";

  // ── Compute arrows & highlights ────────────────────────────────────────────
  // Before answered: red arrow showing the blunder that was played
  // After answered: green arrow showing the best move
  const blunderSquares = useMemo(
    () => getMoveSquares(blunder.preFen, blunder.san),
    [blunder],
  );
  const bestSquares = useMemo(
    () =>
      blunder.bestSan ? getMoveSquares(blunder.preFen, blunder.bestSan) : null,
    [blunder],
  );

  const arrows = useMemo(() => {
    if (answered && bestSquares) {
      return [
        {
          startSquare: bestSquares.from,
          endSquare: bestSquares.to,
          color: "#22c55e",
        },
      ];
    }
    if (!answered && blunderSquares) {
      return [
        {
          startSquare: blunderSquares.from,
          endSquare: blunderSquares.to,
          color: "#ef4444",
        },
      ];
    }
    return [];
  }, [answered, blunderSquares, bestSquares]);

  // Square highlights: red tint on blunder squares, green tint after answering
  const squareStyles = useMemo(() => {
    const styles = {};
    if (answered && bestSquares) {
      styles[bestSquares.from] = { backgroundColor: "rgba(34,197,94,0.25)" };
      styles[bestSquares.to] = { backgroundColor: "rgba(34,197,94,0.35)" };
    } else if (!answered && blunderSquares) {
      styles[blunderSquares.from] = { backgroundColor: "rgba(239,68,68,0.22)" };
      styles[blunderSquares.to] = { backgroundColor: "rgba(239,68,68,0.32)" };
    }
    return styles;
  }, [answered, blunderSquares, bestSquares]);

  // ── Board interaction ───────────────────────────────────────────────────────
  function handleDrop({ sourceSquare, targetSquare }) {
    if (answered) return false;
    try {
      const g = new Chess(blunder.preFen);
      const move = g.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      if (!move) return false;
      const isRight = move.san === blunder.bestSan;
      setPlayerMoveSan(move.san);
      setIsCorrect(isRight);
      setAnswered(true);
      return true;
    } catch {
      return false;
    }
  }

  function handleSkip() {
    setAnswered(true);
    setPlayerMoveSan(null);
    setIsCorrect(false);
  }

  function handleNext() {
    if (isLastItem) {
      onClose();
      return;
    }
    setIdx((i) => i + 1);
    setAnswered(false);
    setPlayerMoveSan(null);
    setIsCorrect(false);
  }

  function handlePrev() {
    if (idx === 0) return;
    setIdx((i) => i - 1);
    setAnswered(false);
    setPlayerMoveSan(null);
    setIsCorrect(false);
  }

  function jumpTo(i) {
    setIdx(i);
    setAnswered(false);
    setPlayerMoveSan(null);
    setIsCorrect(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-5">
      <div className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col lg:flex-row w-full max-w-245 max-h-[95vh] overflow-hidden">
        {/* ── Board section ────────────────────────────────────────────────── */}
        <div className="lg:shrink-0 lg:w-130 flex flex-col items-center justify-center p-3 sm:p-5 bg-black/30">
          {/* Board header */}
          <div className="w-full mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              {answered ? (
                <span className="text-green-400 font-semibold">
                  Best move shown ↓
                </span>
              ) : (
                <span className="text-red-400 font-semibold">
                  ← Blunder: {blunder.qualityEmoji} {blunder.san}
                </span>
              )}
            </span>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
              {whoPlayed} to move
            </span>
          </div>

          {/* The board – full width of its container */}
          <div
            className="w-full"
            style={{ maxWidth: "min(100%, calc(95vh - 220px))" }}
          >
            <Chessboard
              options={{
                id: "blunder-review-board",
                position: blunder.preFen,
                boardOrientation: orientation,
                allowDragging: !answered,
                canDragPiece: () => !answered,
                boardStyle: { borderRadius: "4px", overflow: "hidden" },
                darkSquareStyle: { backgroundColor: "#4a7c59" },
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
                showNotation: true,
                arrows,
                clearArrowsOnPositionChange: false,
                clearArrowsOnClick: false,
                squareStyles,
                onPieceDrop: handleDrop,
              }}
            />
          </div>
        </div>

        {/* ── Info panel ───────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 p-5 gap-4 min-w-0 overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Target className="w-3.5 h-3.5 text-primary" />
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold">
                  Blunder Review
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Error {idx + 1} of {totalErrors}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Blunder info card */}
          <div className="border border-red-500/20 rounded-xl p-3.5 bg-red-500/5">
            <p className="text-[10px] uppercase tracking-widest text-red-400/80 font-semibold mb-1.5">
              {whoPlayed} — Move {blunder.moveNum}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-red-400 font-bold text-lg">
                {blunder.qualityEmoji} {blunder.san}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {blunder.quality}
                {blunder.cpLost ? ` (−${blunder.cpLost} cp)` : ""}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              The red arrow on the board shows this move.
            </p>
          </div>

          {/* Puzzle prompt / result */}
          {!answered ? (
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div className="text-center">
                <p className="text-[15px] font-semibold text-foreground mb-1.5">
                  What should {whoPlayed} have played instead?
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Drag a piece on the board to show the better move.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="self-center text-muted-foreground text-xs gap-1.5"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Show answer
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3">
              {/* Result badge */}
              {playerMoveSan ? (
                <div
                  className={`rounded-xl p-3.5 border ${
                    isCorrect
                      ? "border-green-500/30 bg-green-500/10"
                      : "border-orange-500/30 bg-orange-500/8"
                  }`}
                >
                  <p
                    className={`text-sm font-bold mb-1 ${isCorrect ? "text-green-400" : "text-orange-400"}`}
                  >
                    {isCorrect ? "✓ Correct!" : "✗ Not quite"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You played:{" "}
                    <strong
                      className={`${isCorrect ? "text-green-300" : "text-orange-300"}`}
                    >
                      {playerMoveSan}
                    </strong>
                  </p>
                </div>
              ) : (
                <div className="rounded-xl p-3.5 border border-border bg-secondary/20">
                  <p className="text-xs text-muted-foreground">
                    Answer revealed
                  </p>
                </div>
              )}

              {/* Best move */}
              <div className="rounded-xl border border-green-500/25 p-3.5 bg-green-500/5">
                <p className="text-[10px] uppercase tracking-widest text-green-400/80 font-semibold mb-1.5">
                  Best Move
                </p>
                <p className="text-2xl font-bold text-green-300 tracking-wide">
                  {blunder.bestSan}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  The green arrow on the board shows the correct move.
                </p>
              </div>
            </div>
          )}

          {/* Progress dots */}
          {totalErrors > 1 && (
            <div className="flex flex-wrap gap-1.5 justify-center py-1">
              {blunders.map((b, i) => (
                <button
                  key={i}
                  onClick={() => jumpTo(i)}
                  title={`${b.side === "w" ? "White" : "Black"} move ${b.moveNum}: ${b.san} (${b.quality})`}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === idx
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-card bg-primary scale-110"
                      : b.quality === "Blunder"
                        ? "bg-red-500/50 hover:bg-red-500/80"
                        : "bg-orange-500/50 hover:bg-orange-500/80"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={idx === 0}
              className="text-muted-foreground gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Button>

            <Button
              variant={answered ? "default" : "ghost"}
              size="sm"
              onClick={handleNext}
              disabled={!answered && !isLastItem}
              className={`gap-1 ${!answered ? "text-muted-foreground" : ""}`}
            >
              {isLastItem ? "Finish" : "Next"}
              {!isLastItem && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
