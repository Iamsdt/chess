import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import {
  Zap,
  Settings,
  RotateCcw,
  User,
  Bot,
  Cpu,
  ChevronDown,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

// ── Simple dropdown component ─────────────────────────────────────────────
function Dropdown({ label, icon: Icon, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium transition-colors"
      >
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-foreground">{label}:</span>
        <span className="text-primary font-semibold">{selected?.label || value}</span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-md shadow-xl min-w-[160px] py-1 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors text-left ${
                opt.value === value ? "text-primary bg-primary/5" : "text-foreground"
              }`}
            >
              {opt.icon && <opt.icon className="h-3.5 w-3.5" />}
              <span>{opt.label}</span>
              {opt.desc && (
                <span className="text-muted-foreground ml-auto">{opt.desc}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const OPPONENT_OPTIONS = [
  { value: "manual",  label: "Manual",        icon: User, desc: "2 players" },
  { value: "ai",      label: "AI",            icon: Bot,  desc: "minimax"   },
  { value: "engine",  label: "Chess Engine",  icon: Cpu,  desc: "strongest" },
];

const DIFFICULTY_OPTIONS = [
  { value: "easy",   label: "Easy",   desc: "random"  },
  { value: "medium", label: "Medium", desc: "depth 2" },
  { value: "hard",   label: "Hard",   desc: "depth 3" },
];

// ── ControlBar ─────────────────────────────────────────────────────────────
function ControlBar({
  isLiveMode,
  onToggleLiveMode,
  onNewGame,
  onOpenSettings,
  opponent,
  onOpponentChange,
  difficulty,
  onDifficultyChange,
  isAIThinking,
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card gap-2 flex-wrap">
      {/* Left — branding */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-base font-bold tracking-tight text-primary">
          ♟ Chess
        </span>
      </div>

      {/* Center — controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Opponent selector */}
        <Dropdown
          label="Opponent"
          icon={opponent === "manual" ? User : opponent === "ai" ? Bot : Cpu}
          options={OPPONENT_OPTIONS}
          value={opponent}
          onChange={onOpponentChange}
        />

        {/* Difficulty — visible when opponent is AI or Chess Engine */}
        {opponent !== "manual" && (
          <Dropdown
            label="Difficulty"
            options={DIFFICULTY_OPTIONS}
            value={difficulty}
            onChange={onDifficultyChange}
          />
        )}

        {/* AI thinking indicator */}
        {isAIThinking && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary animate-pulse">
            <Cpu className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        )}

        <div className="w-px h-4 bg-border mx-1" />

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary">
          <Zap
            className={`h-3.5 w-3.5 ${
              isLiveMode ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <span className="text-xs text-muted-foreground">Live</span>
          <Switch checked={isLiveMode} onCheckedChange={onToggleLiveMode} />
        </div>

        <Button variant="ghost" size="sm" onClick={onNewGame}>
          <RotateCcw className="h-4 w-4" />
          New Game
        </Button>
      </div>

      {/* Right — settings */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenSettings}
        className="flex-shrink-0"
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default ControlBar;
