import { Chess } from "chess.js";
import { X, ChevronRight, Target } from "lucide-react";
import { useState } from "react";

import { ENDGAMES, ENDGAME_CATEGORIES } from "@/data/endgames";

// ── Difficulty color mapping ──────────────────────────────────────────────
const DIFF_STYLE = {
  beginner: {
    color: "text-green-400",
    bg: "bg-green-500/10  border-green-500/30",
  },
  intermediate: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/30",
  },
  advanced: { color: "text-red-400", bg: "bg-red-500/10    border-red-500/30" },
};

const GOAL_ICON = { checkmate: "♔", promote: "♛", draw: "½", technique: "⭐" };

/**
 * Endgame Scenario Picker.
 * When the user picks a scenario the parent loads it onto the main board.
 *
 * Props:
 *   onClose        – close without loading
 *   onLoadScenario – ({ fen, title, playerColor: "white"|"black" }) => void
 */
export default function EndgameMode({ onClose, onLoadScenario }) {
  const [category, setCategory] = useState("all");

  const filtered =
    category === "all"
      ? ENDGAMES
      : ENDGAMES.filter((e) => e.category === category);

  /**
   *
   */
  const handlePick = (scenario) => {
    const g = new Chess(scenario.fen);
    const playerColor = g.turn() === "w" ? "white" : "black";
    onLoadScenario({ fen: scenario.fen, title: scenario.title, playerColor });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold flex items-center gap-1.5">
              <Target className="w-3 h-3" /> Endgame Scenarios
            </p>
            <h2 className="text-base font-semibold text-foreground mt-0.5">
              Pick a position to study
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Loads on the main board — play against the engine
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category filter tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto shrink-0">
          {ENDGAME_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                category === cat.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Scenario list */}
        <div className="overflow-y-auto flex-1 py-1">
          {filtered.map((s) => {
            const diff = DIFF_STYLE[s.difficulty] ?? DIFF_STYLE.beginner;
            return (
              <button
                key={s.id}
                onClick={() => handlePick(s)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary/40 active:bg-secondary/70 transition-colors text-left border-b border-border/30 group"
              >
                <span className="text-xl mt-0.5 shrink-0">
                  {GOAL_ICON[s.goal] ?? "♟"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      {s.title}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide border rounded px-1.5 py-0.5 ${diff.color} ${diff.bg}`}
                    >
                      {s.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {s.description}
                  </p>
                  <p className="text-[10px] text-primary/70 mt-1 font-medium">
                    Goal: {s.goalText}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10">
              No scenarios in this category
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border bg-secondary/20 shrink-0">
          <p className="text-[10px] text-muted-foreground text-center">
            {filtered.length} scenario{filtered.length !== 1 ? "s" : ""} · Click
            any to load it onto the main board
          </p>
        </div>
      </div>
    </div>
  );
}
