import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

// ── Quality color mapping ─────────────────────────────────────────────────────
const QUALITY_COLORS = {
  Brilliant: { bar: "#06b6d4", text: "text-cyan-400" },
  Excellent: { bar: "#10b981", text: "text-emerald-400" },
  Good: { bar: "#22c55e", text: "text-green-400" },
  Inaccuracy: { bar: "#eab308", text: "text-yellow-400" },
  Mistake: { bar: "#f97316", text: "text-orange-400" },
  Blunder: { bar: "#ef4444", text: "text-red-400" },
};

const QUALITY_ORDER = [
  "Brilliant",
  "Excellent",
  "Good",
  "Inaccuracy",
  "Mistake",
  "Blunder",
];

// ── Accuracy color ────────────────────────────────────────────────────────────
function accuracyColor(pct) {
  if (pct >= 90) return "text-cyan-400";
  if (pct >= 75) return "text-emerald-400";
  if (pct >= 60) return "text-green-400";
  if (pct >= 45) return "text-yellow-400";
  if (pct >= 30) return "text-orange-400";
  return "text-red-400";
}

// ── Eval Graph ────────────────────────────────────────────────────────────────
function EvalGraph({ evalHistory, onJumpToMove }) {
  if (!evalHistory || evalHistory.length < 2) return null;

  const W = 600;
  const H = 100;
  const PAD = 4;
  const inner_h = H - PAD * 2;
  const inner_w = W - PAD * 2;

  const n = evalHistory.length;
  const pts = evalHistory.map((e, i) => {
    const x = PAD + (i / (n - 1)) * inner_w;
    const y = PAD + ((10 - e.score) / 20) * inner_h; // 10 = top, -10 = bottom
    return { x, y, ...e };
  });

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");

  // White fill: polygon from line to top
  const whiteFill = [
    `${pts[0].x},${PAD + inner_h / 2}`,
    ...pts.map((p) => `${p.x},${p.y}`),
    `${pts[pts.length - 1].x},${PAD + inner_h / 2}`,
  ].join(" ");

  // Black fill: polygon from line to bottom
  const blackFill = [
    `${pts[0].x},${PAD + inner_h / 2}`,
    ...pts.map((p) => `${p.x},${p.y}`),
    `${pts[pts.length - 1].x},${PAD + inner_h / 2}`,
  ].join(" ");

  const midY = PAD + inner_h / 2;

  return (
    <div className="w-full">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
        Evaluation Graph
      </p>
      <div className="relative rounded overflow-hidden bg-black/30 border border-border">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 90 }}
          preserveAspectRatio="none"
        >
          {/* Background */}
          <rect x={0} y={0} width={W} height={H} fill="transparent" />

          {/* White-advantage region (above midline) */}
          <polygon
            points={whiteFill}
            fill="#ffffff18"
            clipPath={`polygon(0 0, ${W} 0, ${W} ${midY}, 0 ${midY})`}
          />
          <clipPath id="whiteClip">
            <rect x={0} y={0} width={W} height={midY} />
          </clipPath>
          <polygon
            points={whiteFill}
            fill="#ffffff22"
            clipPath="url(#whiteClip)"
          />

          {/* Black-advantage region (below midline) */}
          <clipPath id="blackClip">
            <rect x={0} y={midY} width={W} height={H - midY} />
          </clipPath>
          <polygon
            points={blackFill}
            fill="#00000044"
            clipPath="url(#blackClip)"
          />

          {/* Midline */}
          <line
            x1={PAD}
            y1={midY}
            x2={W - PAD}
            y2={midY}
            stroke="#ffffff30"
            strokeWidth={1}
          />

          {/* Eval line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="#22c55e"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />

          {/* Clickable hover areas */}
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={6}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onJumpToMove && onJumpToMove(i - 1)}
            >
              <title>
                {p.label}
                {p.score !== null
                  ? ` (${p.score > 0 ? "+" : ""}${p.score?.toFixed(1)})`
                  : ""}
              </title>
            </circle>
          ))}
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pb-0.5">
          <span className="text-[9px] text-white/40">White</span>
          <span className="text-[9px] text-white/40">Black</span>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground mt-1 text-center">
        Click any point to jump to that position
      </p>
    </div>
  );
}

// ── Accuracy Ring ─────────────────────────────────────────────────────────────
function AccuracyRing({ accuracy, label }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - accuracy / 100);
  const color =
    accuracy >= 80
      ? "#10b981"
      : accuracy >= 60
        ? "#22c55e"
        : accuracy >= 45
          ? "#eab308"
          : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#ffffff15"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text
          x="40"
          y="44"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill="white"
        >
          {accuracy}%
        </text>
      </svg>
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

// ── Quality breakdown bar ─────────────────────────────────────────────────────
function QualityRow({ label, count, emoji, color, total }) {
  if (!count) return null;
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 text-center">{emoji}</span>
      <span className="w-16 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-4 text-right font-mono text-foreground">{count}</span>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────
export default function GameReportDialog({
  open,
  onOpenChange,
  report,
  moveHistory = [],
  onJumpToMove,
  onReviewBlunders,
}) {
  if (!report) return null;

  const { white, black, evalHistory, criticalMoveIdx, moveSummary, blunders } =
    report;

  const whiteTotalMoves = moveHistory.filter((_, i) => i % 2 === 0).length;
  const blackTotalMoves = moveHistory.filter((_, i) => i % 2 !== 0).length;
  const criticalMove =
    criticalMoveIdx >= 0 ? moveSummary[criticalMoveIdx] : null;

  const QUALITY_META = {
    Brilliant: { emoji: "💎", bar: "#06b6d4" },
    Excellent: { emoji: "✨", bar: "#10b981" },
    Good: { emoji: "👍", bar: "#22c55e" },
    Inaccuracy: { emoji: "⚠️", bar: "#eab308" },
    Mistake: { emoji: "❌", bar: "#f97316" },
    Blunder: { emoji: "💥", bar: "#ef4444" },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            📊 Game Report
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {moveHistory.length} moves analyzed
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Accuracy rings */}
        <div className="flex justify-around py-2">
          <AccuracyRing accuracy={white.accuracy} label="White" />
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Accuracy
            </span>
            <div className="w-px h-12 bg-border" />
          </div>
          <AccuracyRing accuracy={black.accuracy} label="Black" />
        </div>

        {/* Quality breakdown */}
        <div className="grid grid-cols-2 gap-4 border border-border rounded-lg p-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              White Moves
            </p>
            <div className="space-y-1.5">
              {QUALITY_ORDER.map((q) => (
                <QualityRow
                  key={q}
                  label={q}
                  count={white.counts[q]}
                  emoji={QUALITY_META[q].emoji}
                  color={QUALITY_META[q].bar}
                  total={whiteTotalMoves}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Black Moves
            </p>
            <div className="space-y-1.5">
              {QUALITY_ORDER.map((q) => (
                <QualityRow
                  key={q}
                  label={q}
                  count={black.counts[q]}
                  emoji={QUALITY_META[q].emoji}
                  color={QUALITY_META[q].bar}
                  total={blackTotalMoves}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Evaluation graph */}
        <EvalGraph
          evalHistory={evalHistory}
          onJumpToMove={(idx) => {
            onJumpToMove && onJumpToMove(idx);
            onOpenChange(false);
          }}
        />

        {/* Critical moment */}
        {criticalMove && (
          <div className="border border-orange-500/30 rounded-lg p-3 bg-orange-500/5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400 mb-1">
              🎯 Critical Moment
            </p>
            <p className="text-sm text-foreground">
              <span className="font-bold text-orange-400">
                Move {criticalMove.moveNum}
                {criticalMove.side === "w" ? "." : "..."} {criticalMove.san}
              </span>{" "}
              — {criticalMove.qualityEmoji} {criticalMove.quality}
              {criticalMove.cpLost && (
                <span className="text-muted-foreground ml-1">
                  (−{criticalMove.cpLost} cp)
                </span>
              )}
            </p>
            {criticalMove.bestSan && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Better was{" "}
                <span className="text-green-400 font-semibold">
                  {criticalMove.bestSan}
                </span>
              </p>
            )}
            <button
              onClick={() => {
                onJumpToMove && onJumpToMove(criticalMoveIdx - 1);
                onOpenChange(false);
              }}
              className="mt-1 text-[10px] text-primary underline underline-offset-2"
            >
              Jump to this position →
            </button>
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex justify-between items-center pt-1 gap-2">
          {blunders.length > 0 ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onReviewBlunders && onReviewBlunders();
              }}
            >
              🔍 Review {blunders.length} Error
              {blunders.length !== 1 ? "s" : ""}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              No blunders or mistakes — clean game! 🎉
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
