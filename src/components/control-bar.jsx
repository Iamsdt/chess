import {
  Zap,
  Settings,
  RotateCcw,
  User,
  Bot,
  Cpu,
  ChevronDown,
  FolderOpen,
  Moon,
  Sun,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

// ── Simple dropdown component ─────────────────────────────────────────────
/**
 *
 */
export const Dropdown = ({
  label,
  icon: Icon,
  options,
  value,
  onChange,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const reference = useRef(null);

  useEffect(() => {
    /**
     *
     */
    const handle = (e) => {
      if (reference.current && !reference.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={reference} className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        title={disabled ? "Cannot change sides during a game" : undefined}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary border border-border text-xs font-medium transition-colors ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-secondary/80 cursor-pointer"
        }`}
      >
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-foreground">{label}:</span>
        <span className="text-primary font-semibold">
          {selected?.label || value}
        </span>
        {!disabled && (
          <ChevronDown
            className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && !disabled && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-md shadow-xl min-w-[160px] py-1 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors text-left ${
                opt.value === value
                  ? "text-primary bg-primary/5"
                  : "text-foreground"
              }`}
            >
              {opt.icon && <opt.icon className="h-3.5 w-3.5" />}
              <span>{opt.label}</span>
              {opt.desc && (
                <span className="text-muted-foreground ml-auto">
                  {opt.desc}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const OPPONENT_OPTIONS = [
  { value: "engine", label: "Chess Engine", icon: Cpu, desc: "strongest" },
  { value: "ai", label: "AI", icon: Bot, desc: "minimax" },
  { value: "manual", label: "Manual", icon: User, desc: "2 players" },
];

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy", desc: "random" },
  { value: "medium", label: "Medium", desc: "depth 2" },
  { value: "hard", label: "Hard", desc: "depth 3" },
];

// ── ControlBar ─────────────────────────────────────────────────────────────
/**
 *
 */
const ControlBar = ({
  isLiveMode,
  onToggleLiveMode,
  onNewGame,
  onOpenSettings,
  onOpenSavedGames,
  opponent,
  onOpponentChange,
  difficulty,
  onDifficultyChange,
  isDarkMode,
  onToggleDarkMode,
  // Train
}) => (
  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card gap-2 flex-wrap">
    {/* Left — branding */}
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-base font-bold tracking-tight text-primary">
        ♟ Chess King
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

      {/* Play as — pick side; disabled once game has started 
        {opponent !== "manual" && (
          <Dropdown
            label="Play as"
            icon={playerColor === "white" ? Crown : CircleUser}
            options={PLAYER_COLOR_OPTIONS}
            value={playerColor}
            onChange={onPlayerColorChange}
            disabled={isGameInProgress}
          />
        )} */}

      <div className="w-px h-4 bg-border mx-1" />

      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary">
        <Zap
          className={`h-3.5 w-3.5 ${
            isLiveMode ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {isLiveMode ? "Live Mode" : "Training"}
        </span>
        <Switch checked={isLiveMode} onCheckedChange={onToggleLiveMode} />
      </div>

      <Button variant="ghost" size="sm" onClick={onNewGame}>
        <RotateCcw className="h-4 w-4" />
        New Game
      </Button>

      <Button variant="ghost" size="sm" onClick={onOpenSavedGames}>
        <FolderOpen className="h-4 w-4" />
        Save / Load
      </Button>

      {/* <Button variant="ghost" size="sm" onClick={onSetPosition}>
        <LayoutGrid className="h-4 w-4" />
        Set Position
      </Button> */}

      {/* <TrainDropdown
        onOpenPuzzles={onOpenPuzzles}
        onOpenOpeningDrill={onOpenOpeningDrill}
        onOpenEndgame={onOpenEndgame}
        onOpenOpeningStats={onOpenOpeningStats}
        clockEnabled={clockEnabled}
        clockTimeControl={clockTimeControl}
        onToggleClock={onToggleClock}
        onSetTimeControl={onSetTimeControl}
      /> */}
    </div>

    {/* Right — dark mode + settings */}
    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleDarkMode}
        title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDarkMode ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </Button>
      <Button variant="ghost" size="icon" onClick={onOpenSettings}>
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

export default ControlBar;
