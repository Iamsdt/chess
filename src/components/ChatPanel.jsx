import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Send, Bot, User, Loader2, Cpu,
  Search, Lightbulb, Crosshair, Zap,
  AlertTriangle, Sparkles, BrainCircuit,
  BookOpen, X, ChevronRight, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

// ── Quality colour map ────────────────────────────────────────────────────
const QUALITY_STYLES = {
  Brilliant:  { border: "border-cyan-500/60",   bg: "bg-cyan-950/50",   badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"   },
  Excellent:  { border: "border-emerald-500/60", bg: "bg-emerald-950/40",badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  Good:       { border: "border-green-600/50",   bg: "bg-green-950/30",  badge: "bg-green-500/20 text-green-300 border-green-500/40"   },
  Inaccuracy: { border: "border-yellow-500/50",  bg: "bg-yellow-950/30", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
  Mistake:    { border: "border-orange-500/60",  bg: "bg-orange-950/40", badge: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  Blunder:    { border: "border-red-500/70",     bg: "bg-red-950/50",    badge: "bg-red-500/20 text-red-300 border-red-500/40"         },
};

const SEVERITY_STYLES = {
  critical: { border: "border-red-500/70",    bg: "bg-red-950/50",    icon: "text-red-400"    },
  high:     { border: "border-orange-500/60", bg: "bg-orange-950/40", icon: "text-orange-400" },
  medium:   { border: "border-yellow-500/50", bg: "bg-yellow-950/30", icon: "text-yellow-400" },
  low:      { border: "border-blue-500/40",   bg: "bg-blue-950/30",   icon: "text-blue-400"   },
};

// ── Eval score colour helper ──────────────────────────────────────────────
function evalColor(wScore) {
  if (wScore === null) return "text-muted-foreground";
  if (wScore >  1.5) return "text-emerald-400";
  if (wScore >  0.3) return "text-green-400";
  if (wScore < -1.5) return "text-red-400";
  if (wScore < -0.3) return "text-orange-400";
  return "text-muted-foreground";
}
function evalIcon(wScore) {
  if (wScore === null) return Minus;
  if (wScore >  0.3) return TrendingUp;
  if (wScore < -0.3) return TrendingDown;
  return Minus;
}

// ── Move chip — renders a single SAN token as a styled pill ──────────────
function MoveChip({ move, idx }) {
  // Detect special SAN features for mini colouring
  const isCapture   = move.includes("x");
  const isCheck     = move.includes("+");
  const isMate      = move.includes("#");
  const isCastle    = move.startsWith("O-O");
  const isPromotion = move.includes("=");

  let cls = "bg-white/[0.06] text-foreground/80 border-white/10";
  if (isMate)      cls = "bg-red-500/20 text-red-300 border-red-500/30";
  else if (isCheck) cls = "bg-yellow-500/15 text-yellow-300 border-yellow-500/25";
  else if (isCapture) cls = "bg-orange-500/15 text-orange-300 border-orange-500/25";
  else if (isCastle)  cls = "bg-blue-500/15 text-blue-300 border-blue-500/25";
  else if (isPromotion) cls = "bg-purple-500/15 text-purple-300 border-purple-500/25";

  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-medium px-1.5 py-0.5 rounded border ${cls}`}>
      {idx !== undefined && <span className="text-[9px] text-muted-foreground/60 mr-0.5">{idx}.</span>}
      {move}
    </span>
  );
}

// ── Move line — sequence of SAN chips ────────────────────────────────────
function MoveLine({ moves, startMoveNum = 1 }) {
  if (!moves || moves.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {moves.map((m, i) => (
        <MoveChip key={i} move={m} idx={startMoveNum + i} />
      ))}
    </div>
  );
}

// ── My-Move Analysis Card ─────────────────────────────────────────────────
function MyMoveCard({ card }) {
  const qs = QUALITY_STYLES[card.quality] || QUALITY_STYLES.Good;
  const hasSuggestion = card.suggestion && card.suggestion.bestMove;
  const EvalIcon = evalIcon(card.evalAfterRaw ?? null);

  return (
    <div className={`rounded-xl border ${qs.border} ${qs.bg} p-3 text-sm space-y-2 w-full`}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{card.qualityEmoji}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${qs.badge}`}>
            {card.quality}
          </span>
          <MoveChip move={card.moveSan} />
        </div>
        {card.evalAfter && (
          <span className={`text-xs font-mono tabular-nums ${evalColor(card.evalAfterRaw ?? null)}`}>
            {card.evalAfter}
          </span>
        )}
      </div>

      {/* Varied message */}
      <p className="text-xs text-foreground/80 leading-relaxed">{card.message}</p>

      {/* cp lost hint */}
      {card.cpLost !== null && card.cpLost > 20 && (
        <p className="text-[11px] text-muted-foreground">
          −{card.cpLost} cp vs engine best
        </p>
      )}

      {/* Alternative suggestion */}
      {hasSuggestion && (
        <div className="mt-1 pt-2 border-t border-white/10 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-cyan-400 shrink-0" />
            <span className="text-[11px] font-semibold text-cyan-300">Better:</span>
            <MoveChip move={card.suggestion.bestMove} />
          </div>
          {card.suggestion.line.length > 0 && (
            <div className="pl-5">
              <MoveLine moves={card.suggestion.line.slice(0, 4)} startMoveNum={2} />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground/70 pl-5 italic">
            {card.suggestion.eloContext}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Best Move Card ────────────────────────────────────────────────────────
function BestMoveCard({ card }) {
  const EvalIcon = evalIcon(card.wScore);
  const eColor   = evalColor(card.wScore);

  return (
    <div className="rounded-xl border border-cyan-600/50 bg-cyan-950/40 p-3 text-sm space-y-2.5 w-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
        <span className="text-xs font-semibold text-cyan-300">Best Move</span>
      </div>

      {/* Big move display */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold font-mono text-foreground">{card.moveSan}</span>
          {card.tacticalTag && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.07] text-muted-foreground border border-white/10">
              {card.tacticalTag}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1 text-xs font-mono tabular-nums ${eColor}`}>
          <EvalIcon className="h-3 w-3 shrink-0" />
          <span>{card.evalStr}</span>
        </div>
      </div>

      {/* Continuation line */}
      {card.line.length > 1 && (
        <div className="space-y-1 pt-1 border-t border-white/10">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Best continuation</p>
          <MoveLine moves={card.line.slice(0, 5)} startMoveNum={1} />
        </div>
      )}
    </div>
  );
}

// ── Hint Card ─────────────────────────────────────────────────────────────
const PIECE_ICONS = {
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

function HintCard({ card }) {
  const EvalIcon = evalIcon(card.wScore);
  const eColor   = evalColor(card.wScore);

  return (
    <div className="rounded-xl border border-violet-600/50 bg-violet-950/40 p-3 text-sm space-y-2.5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crosshair className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          <span className="text-xs font-semibold text-violet-300">Hint</span>
        </div>
        {card.evalStr && (
          <div className={`flex items-center gap-1 text-xs font-mono tabular-nums ${eColor}`}>
            <EvalIcon className="h-3 w-3 shrink-0" />
            <span>{card.evalStr}</span>
          </div>
        )}
      </div>

      {/* General motivating message */}
      <p className="text-xs text-foreground/85 leading-relaxed">{card.generalMsg}</p>

      {/* Piece-specific hint */}
      {card.pieceName && (
        <div className="flex items-start gap-2 pt-1 border-t border-white/10">
          <span className="text-base leading-none mt-0.5">{PIECE_ICONS[card.pieceType] || "♟"}</span>
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-foreground/80">
              Think about your <span className="text-violet-300">{card.pieceName}</span>
              {card.fromSquare ? ` on ${card.fromSquare}` : ""}.
            </p>
            {card.pieceContext && (
              <p className="text-[11px] text-muted-foreground italic">{card.pieceContext}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Threat Card ───────────────────────────────────────────────────────────
function ThreatCard({ card, onAskAI }) {
  const primary = card.primaryThreat;
  const ss = SEVERITY_STYLES[primary.severity] || SEVERITY_STYLES.medium;

  return (
    <div className={`rounded-xl border ${ss.border} ${ss.bg} p-3 text-sm space-y-2 w-full`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertTriangle className={`h-4 w-4 shrink-0 ${ss.icon}`} />
        <span className="text-xs font-semibold text-foreground/90">{primary.name}</span>
        <div className="ml-auto">
          <MoveChip move={card.opponentMoveSan} />
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-foreground/80 leading-relaxed">{primary.description}</p>

      {/* Additional threats */}
      {card.allThreats.length > 1 && (
        <div className="pt-1 space-y-1">
          {card.allThreats.slice(1).map((t, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-xs">{t.icon}</span>
              <p className="text-[11px] text-muted-foreground">{t.name}: {t.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Ask AI button */}
      {card.hasAiButton && (
        <div className="pt-1 border-t border-white/10">
          <button
            onClick={() => onAskAI?.(card)}
            className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <BrainCircuit className="h-3 w-3" />
            Ask AI to explain this threat
          </button>
        </div>
      )}
    </div>
  );
}

// ── Glossary Dialog ───────────────────────────────────────────────────────
const GLOSSARY_SECTIONS = [
  {
    title: "Move Quality",
    items: [
      { symbol: "💎", label: "Brilliant", desc: "The engine's exact top choice. Rare — this is precisely what a computer would play." },
      { symbol: "✨", label: "Excellent", desc: "Only a tiny fraction off the best. Very strong, near-perfect play." },
      { symbol: "👍", label: "Good", desc: "A solid, correct move. Nothing wrong here — you're playing well." },
      { symbol: "⚠️", label: "Inaccuracy", desc: "A small imprecision. A slightly better move existed, but the position is still playable." },
      { symbol: "❌", label: "Mistake", desc: "A significant error. The position noticeably worsened — worth reviewing." },
      { symbol: "💥", label: "Blunder", desc: "A serious error. Often loses material or the game. Study these moments most." },
    ],
  },
  {
    title: "Evaluation & Centipawns",
    items: [
      { symbol: "+", label: "Positive score", desc: "White has an advantage. E.g. +1.50 means White is up roughly 1.5 pawns in value." },
      { symbol: "−", label: "Negative score", desc: "Black has an advantage. E.g. −0.88 means Black is better by about a pawn." },
      { symbol: "0.00", label: "Equal", desc: "The position is balanced — neither side has a notable edge." },
      { symbol: "cp", label: "Centipawns", desc: "100 cp = 1 pawn. Used to measure how much weaker your move was vs the engine's best." },
      { symbol: "M#", label: "Mate in N", desc: "Forced checkmate in N moves. M1 = checkmate next move." },
    ],
  },
  {
    title: "Chess Notation",
    items: [
      { symbol: "e4", label: "Pawn move", desc: "Lowercase letters are pawn moves. 'e4' means pawn moves to the e4 square." },
      { symbol: "Nf3", label: "Piece move", desc: "Capital letter = piece type (N=Knight, B=Bishop, R=Rook, Q=Queen, K=King). 'Nf3' = Knight to f3." },
      { symbol: "x", label: "Capture", desc: "'exf3' means the pawn on e captures the piece on f3. 'Nxe5' = Knight captures on e5." },
      { symbol: "+", label: "Check", desc: "The king is under attack. E.g. 'Bb5+' = Bishop to b5, giving check." },
      { symbol: "#", label: "Checkmate", desc: "The game is over — the king cannot escape. E.g. 'Qh7#'." },
      { symbol: "O-O", label: "Kingside castle", desc: "King moves two squares right and rook jumps over. Short castling." },
      { symbol: "O-O-O", label: "Queenside castle", desc: "King moves two squares left. Long castling." },
      { symbol: "=Q", label: "Promotion", desc: "A pawn reaches the last rank and becomes a new piece. '=Q' means promoted to Queen." },
    ],
  },
  {
    title: "Analysis Terms",
    items: [
      { symbol: "PV", label: "Principal Variation", desc: "The engine's predicted best sequence of moves for both sides from the current position." },
      { symbol: "Best line", label: "Continuation", desc: "The sequence of moves the engine recommends. Studying this line teaches strong patterns." },
      { symbol: "Fork", label: "Tactical threat", desc: "One piece attacks two or more enemy pieces simultaneously, winning material." },
      { symbol: "Pin", label: "Tactical threat", desc: "A piece cannot move safely because a more valuable piece sits behind it on the same line." },
      { symbol: "Hanging", label: "Tactical vulnerability", desc: "An undefended piece that can be captured for free." },
      { symbol: "Tempo", label: "Initiative", desc: "A move that gains time by forcing your opponent to react. 'Losing a tempo' = wasting a move." },
    ],
  },
];

function GlossaryDialog({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Chess & Analysis Glossary</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
          {GLOSSARY_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className="shrink-0 w-10 text-center text-xs font-mono font-bold text-primary/80 bg-primary/10 border border-primary/20 rounded px-1 py-0.5 leading-tight mt-0.5">
                      {item.symbol}
                    </span>
                    <div>
                      <span className="text-xs font-medium text-foreground/90">{item.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────
function MessageBubble({ msg, onAskAI }) {
  // Special structured cards
  if (msg.type === "my-move-analysis" && typeof msg.content === "object") {
    return (
      <div className="flex gap-2.5 justify-start">
        <div className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-cyan-500/15">
          <Cpu className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <MyMoveCard card={msg.content} />
        </div>
      </div>
    );
  }

  if (msg.type === "best-move-card" && typeof msg.content === "object") {
    return (
      <div className="flex gap-2.5 justify-start">
        <div className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-cyan-500/15">
          <Cpu className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <BestMoveCard card={msg.content} />
        </div>
      </div>
    );
  }

  if (msg.type === "hint-card" && typeof msg.content === "object") {
    return (
      <div className="flex gap-2.5 justify-start">
        <div className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-violet-500/15">
          <Crosshair className="h-3.5 w-3.5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <HintCard card={msg.content} />
        </div>
      </div>
    );
  }

  if (msg.type === "threat-card" && typeof msg.content === "object") {
    return (
      <div className="flex gap-2.5 justify-start">
        <div className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-orange-500/15">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <ThreatCard card={msg.content} onAskAI={onAskAI} />
        </div>
      </div>
    );
  }

  const isEngine = msg.type === "engine" || msg.type === "engine-query";
  const isUser   = msg.role  === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center
          ${isEngine ? "bg-cyan-500/15" : "bg-primary/10"}`}>
          {isEngine
            ? <Cpu   className="h-3.5 w-3.5 text-cyan-400" />
            : <Bot   className="h-3.5 w-3.5 text-primary" />}
        </div>
      )}
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${
        isUser
          ? (msg.type === "engine-query"
              ? "bg-cyan-500/20 text-cyan-100 border border-cyan-500/30"
              : "bg-primary text-primary-foreground")
          : (isEngine
              ? "bg-cyan-950/60 text-cyan-50 border border-cyan-800/40 font-mono text-xs"
              : "bg-secondary text-secondary-foreground")
      }`}>
        {msg.content}
      </div>
      {isUser && (
        <div className="shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────
function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  coachMode = "engine",
  onCoachModeChange,
  isLiveMode = false,
  onEngineAnalyze,
  onEngineBestMove,
  onEngineHint,
  onAskAI,
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const [activeTab, setActiveTab] = useState(coachMode === "ai" ? "ai" : "engine");

  function handleTabClick(tab) {
    setActiveTab(tab);
    onCoachModeChange?.(tab);
  }

  // Keep tab in sync if coachMode is changed externally
  useEffect(() => {
    if (coachMode !== activeTab) setActiveTab(coachMode);
  }, [coachMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSendMessage(text);
    setInput("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const visibleMessages = messages.filter((m) => {
    if (activeTab === "engine") return (
      m.type === "engine" || m.type === "engine-query" ||
      m.type === "my-move-analysis" || m.type === "threat-card" ||
      m.type === "best-move-card" || m.type === "hint-card"
    );
    if (activeTab === "ai")     return m.type !== "engine" && m.type !== "engine-query" &&
      m.type !== "my-move-analysis" && m.type !== "threat-card" &&
      m.type !== "best-move-card" && m.type !== "hint-card";
    return false;
  });

  const tabs = [
    { id: "engine", icon: Cpu, label: "Engine", iconCls: "text-cyan-400" },
    { id: "ai",     icon: Bot, label: "AI Coach" },
  ];

  return (
    <div className="flex flex-col h-full border-l border-border bg-card">
      {/* Glossary modal */}
      <GlossaryDialog open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />

      {/* Tab bar */}
      <div className="flex items-center border-b border-border">
        <div className="flex flex-1">
        {tabs.map(({ id, icon: Icon, label, iconCls }) => {
          const isActive = activeTab === id;
          return (
            <button key={id}
              onClick={() => handleTabClick(id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors border-b-2 flex-1 justify-center ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive && iconCls ? iconCls : ""}`} />
              <span>{label}</span>
              {id === "engine" && isLiveMode && (
                <span className="ml-0.5 inline-flex items-center gap-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded-full px-1.5 py-0.5 leading-none">
                  <Zap className="h-2.5 w-2.5" />Live
                </span>
              )}
            </button>
          );
        })}
        </div>
        {/* Glossary button */}
        <button
          onClick={() => setGlossaryOpen(true)}
          title="Chess & Analysis Glossary"
          className="shrink-0 mx-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            {activeTab === "engine" ? (
              <>
                <Cpu className="h-10 w-10 mb-3 opacity-20 text-cyan-400" />
                <p className="text-sm">Stockfish Engine Coach</p>
                <p className="text-xs mt-1">
                  {isLiveMode
                    ? "Live analysis is on — analysis appears after each move."
                    : "Use the buttons below to analyze the position."}
                </p>
              </>
            ) : (
              <>
                <Bot className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">AI Coach</p>
                <p className="text-xs mt-1">Ask me anything about the position!</p>
              </>
            )}
          </div>
        )}

        {visibleMessages.map((msg, i) => <MessageBubble key={i} msg={msg} onAskAI={onAskAI} />)}

        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center
              ${activeTab === "engine" ? "bg-cyan-500/15" : "bg-primary/10"}`}>
              {activeTab === "engine"
                ? <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                : <Bot className="h-3.5 w-3.5 text-primary" />}
            </div>
            <div className="bg-secondary rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {activeTab === "engine" ? "Calculating…" : "Thinking…"}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom action area */}
      {activeTab === "engine" ? (
        <div className="p-3 border-t border-border space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEngineAnalyze}
              disabled={isLoading}
              className="flex flex-col h-auto py-2 gap-1 border-cyan-800/40 hover:bg-cyan-950/40 hover:border-cyan-600/60"
            >
              <Search className="h-4 w-4 text-cyan-400" />
              <span className="text-[11px] text-cyan-300">Analyze</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEngineBestMove}
              disabled={isLoading}
              className="flex flex-col h-auto py-2 gap-1 border-cyan-800/40 hover:bg-cyan-950/40 hover:border-cyan-600/60"
            >
              <Lightbulb className="h-4 w-4 text-cyan-400" />
              <span className="text-[11px] text-cyan-300">Best Move</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEngineHint}
              disabled={isLoading}
              className="flex flex-col h-auto py-2 gap-1 border-cyan-800/40 hover:bg-cyan-950/40 hover:border-cyan-600/60"
            >
              <Crosshair className="h-4 w-4 text-cyan-400" />
              <span className="text-[11px] text-cyan-300">Hint</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your AI coach…"
              disabled={isLoading}
              className="flex-1"
            />
            <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatPanel;
