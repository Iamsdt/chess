import { useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/Button";
import { X, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";

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

  // ── Board interaction ───────────────────────────────────────────────────────
  function handleDrop(sourceSquare, targetSquare) {
    if (answered) return false;
    try {
      const g = new Chess(blunder.preFen);
      const move = g.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
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

  // Show best move arrow after answered
  const arrows = answered && blunder.bestSan
    ? (() => {
        try {
          const g = new Chess(blunder.preFen);
          const mv = g.move(blunder.bestSan);
          if (!mv) return [];
          return [{ startSquare: mv.from, endSquare: mv.to, color: "#22c55e" }];
        } catch {
          return [];
        }
      })()
    : [];

  const orientation = blunder.side === "w" ? "white" : "black";
  const whoPlayed = blunder.side === "w" ? "White" : "Black";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col md:flex-row gap-0 w-full max-w-[860px] overflow-hidden">

        {/* ── Left: Board ──────────────────────────────────────────────────── */}
        <div className="shrink-0 w-[380px] flex items-center justify-center p-4 bg-black/20">
          <div className="w-full">
            <Chessboard
              id="blunder-review-board"
              position={blunder.preFen}
              onPieceDrop={handleDrop}
              boardOrientation={orientation}
              arePiecesDraggable={!answered}
              customBoardStyle={{ borderRadius: "6px", boxShadow: "0 4px 24px #0008" }}
              customDarkSquareStyle={{ backgroundColor: "#4a7c59" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              options={{
                showNotation: true,
                arrows,
                clearArrowsOnPositionChange: false,
              }}
            />
          </div>
        </div>

        {/* ── Right: Info panel ────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 p-5 gap-4 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-0.5">
                Blunder Review
              </p>
              <p className="text-xs text-muted-foreground">
                Error {idx + 1} of {totalErrors}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Blunder info */}
          <div className="border border-border rounded-lg p-3 bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-1">
              {whoPlayed} played move {blunder.moveNum}
            </p>
            <p className="text-sm text-foreground">
              <span className="text-red-400 font-bold text-base">
                {blunder.qualityEmoji} {blunder.san}
              </span>
              <span className="text-muted-foreground ml-2 text-xs">
                was a {blunder.quality}
                {blunder.cpLost ? ` (−${blunder.cpLost} cp)` : ""}
              </span>
            </p>
          </div>

          {/* Prompt */}
          {!answered ? (
            <div className="flex-1 flex flex-col justify-center gap-3">
              <div className="text-center">
                <p className="text-base font-semibold text-foreground mb-1">
                  What should {whoPlayed} have played instead?
                </p>
                <p className="text-xs text-muted-foreground">
                  Drag a piece on the board to make your move.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="self-center text-muted-foreground text-xs"
              >
                <SkipForward className="w-3 h-3 mr-1" />
                Show answer
              </Button>
            </div>
          ) : (
            /* Answer reveal */
            <div className="flex-1 flex flex-col gap-3">
              {playerMoveSan ? (
                <div
                  className={`border rounded-lg p-3 ${
                    isCorrect
                      ? "border-green-500/40 bg-green-500/10"
                      : "border-red-500/40 bg-red-500/10"
                  }`}
                >
                  <p className={`text-sm font-semibold mb-0.5 ${isCorrect ? "text-green-400" : "text-red-400"}`}>
                    {isCorrect ? "✓ Correct!" : "✗ Not quite."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You played: <strong className="text-foreground">{playerMoveSan}</strong>
                  </p>
                </div>
              ) : (
                <div className="border border-border rounded-lg p-3 bg-secondary/20">
                  <p className="text-xs text-muted-foreground">Answer revealed</p>
                </div>
              )}

              {/* Best move */}
              <div className="border border-green-500/30 rounded-lg p-3 bg-green-500/5">
                <p className="text-[10px] uppercase tracking-widest text-green-400 font-semibold mb-1">
                  Best Move
                </p>
                <p className="text-xl font-bold text-green-300">{blunder.bestSan}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The green arrow shows the correct move on the board.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-border mt-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={idx === 0}
              className="text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>

            {/* Progress dots */}
            <div className="flex gap-1">
              {blunders.map((b, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setIdx(i);
                    setAnswered(false);
                    setPlayerMoveSan(null);
                    setIsCorrect(false);
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === idx
                      ? "bg-primary"
                      : b.quality === "Blunder"
                      ? "bg-red-500/60"
                      : "bg-orange-500/60"
                  }`}
                  title={`${b.side === "w" ? "White" : "Black"} move ${b.moveNum}: ${b.san} (${b.quality})`}
                />
              ))}
            </div>

            <Button
              variant={answered ? "default" : "ghost"}
              size="sm"
              onClick={handleNext}
              disabled={!answered && !isLastItem}
              className={!answered ? "text-muted-foreground" : ""}
            >
              {isLastItem ? "Finish" : "Next"}
              {!isLastItem && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
