import { useRef, useEffect, useMemo } from "react";
import { ArrowDownUp, ChevronLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const qualityVariantMap = {
  excellent: "excellent",
  good: "good",
  inaccuracy: "inaccuracy",
  mistake: "mistake",
  blunder: "blunder",
};

function EvalBar({ score }) {
  // score: null or number (White perspective: positive = White better)
  const clamped = score === null ? 0 : Math.max(-5, Math.min(5, score));
  const whitePercent = Math.round(50 + (clamped / 5) * 40);
  const label =
    score === null ? "—"
    : score > 0   ? `+${score.toFixed(1)}`
    :                score.toFixed(1);

  return (
    <div className="p-3 border-t border-border shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Evaluation
        </span>
        <span className="text-xs font-semibold tabular-nums text-foreground">{label}</span>
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

// ── compute captured pieces from move history of a chess.js game ──
function getCapturedPieces(game) {
  const start = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1 },
  };
  const board = game.board();
  const current = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const row of board) {
    for (const sq of row) {
      if (sq) current[sq.color][sq.type]++;
    }
  }
  // captured[color] = pieces of that color that were taken
  // capturedPts[color] = total point value of pieces taken from that side
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
  moveHistory = [],
  evalScore = null,
  onFlipBoard,
  onUndo,
  moveQuality,
  game,
}) {

  const fen = game.fen();

  const { capturedPts } = useMemo(() => getCapturedPieces(game), [game, fen]);

  const pairs = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moveHistory[i],
      black: moveHistory[i + 1] || null,
    });
  }
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moveHistory]);

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Controls: Flip + moveQuality badge + Undo */}
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

        {moveQuality && (
          <Badge variant={qualityVariantMap[moveQuality.toLowerCase()] || "default"} className="text-[10px]">
            {moveQuality}
          </Badge>
        )}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={moveHistory.length === 0}
          title="Undo last move"
          className="text-muted-foreground h-7 px-2 text-xs"
        >
          <ChevronLeft className="h-3 w-3" />
          Undo
        </Button>
      </div>

      {/* Move list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {pairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
            <BookOpen className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-xs">No moves yet</p>
            <p className="text-[10px] mt-1 opacity-60">Make a move to see history</p>
          </div>
        ) : (
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border sticky top-0 bg-card">
                <th className="text-left px-2 py-1.5 w-7">#</th>
                <th className="text-left px-2 py-1.5">White {capturedPts.b}</th>
                <th className="text-left px-2 py-1.5">Black {capturedPts.w}</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair) => (
                <tr
                  key={pair.number}
                  className={`border-b border-border/30 hover:bg-secondary/40 transition-colors ${
                    pair.number === pairs.length ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 text-muted-foreground">{pair.number}.</td>
                  <td className={`px-2 py-1.5 text-foreground ${
                    pair.number === pairs.length && moveHistory.length % 2 !== 0
                      ? "font-bold text-primary"
                      : "font-semibold"
                  }`}>
                    {pair.white}
                  </td>
                  <td className={`px-2 py-1.5 ${
                    pair.number === pairs.length && moveHistory.length % 2 === 0
                      ? "font-bold text-primary"
                      : "text-foreground"
                  }`}>
                    {pair.black ?? <span className="text-muted-foreground/40">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div ref={endRef} />
      </div>

      {/* Evaluation bar pinned at bottom */}
      <EvalBar score={evalScore} />
    </div>
  );
}

export default MoveHistorySidebar;
