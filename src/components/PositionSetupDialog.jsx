import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chess } from "chess.js";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const PRESET_POSITIONS = [
  { label: "Starting Position", fen: STARTING_FEN },
  { label: "King & Rook vs King", fen: "4k3/8/8/8/8/8/8/4K2R w K - 0 1" },
  { label: "King & Queen vs King", fen: "4k3/8/8/8/8/8/8/4KQ2 w - - 0 1" },
  {
    label: "Scholar's Mate threat",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  },
  { label: "King & Pawn vs King", fen: "4k3/4P3/4K3/8/8/8/8/8 w - - 0 1" },
];

export default function PositionSetupDialog({
  open,
  onOpenChange,
  onLoadPosition,
}) {
  const [tab, setTab] = useState("fen"); // "fen" | "pgn"
  const [fenInput, setFenInput] = useState("");
  const [pgnInput, setPgnInput] = useState("");
  const [error, setError] = useState("");

  function resetState() {
    setFenInput("");
    setPgnInput("");
    setError("");
    setTab("fen");
  }

  function handleClose() {
    resetState();
    onOpenChange(false);
  }

  function handleLoadFen() {
    const fen = fenInput.trim() || STARTING_FEN;
    try {
      const g = new Chess(fen);
      onLoadPosition({ type: "fen", fen: g.fen() });
      handleClose();
    } catch {
      setError("Invalid FEN string. Please check the format and try again.");
    }
  }

  function handleLoadPgn() {
    const pgn = pgnInput.trim();
    if (!pgn) {
      setError("Please enter a PGN string.");
      return;
    }
    try {
      const g = new Chess();
      g.loadPgn(pgn);
      onLoadPosition({ type: "pgn", pgn: g.pgn(), game: g });
      handleClose();
    } catch {
      setError("Invalid PGN. Please check the format and try again.");
    }
  }

  function handlePreset(fen) {
    try {
      const g = new Chess(fen);
      onLoadPosition({ type: "fen", fen: g.fen() });
      handleClose();
    } catch {
      setError("Failed to load preset position.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Position</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-secondary rounded-md mb-3">
          {["fen", "pgn"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${
                tab === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {tab === "fen" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                FEN String
              </label>
              <Input
                value={fenInput}
                onChange={(e) => {
                  setFenInput(e.target.value);
                  setError("");
                }}
                placeholder={STARTING_FEN}
                className="font-mono text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleLoadFen()}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Leave blank to load the starting position.
              </p>
            </div>

            {/* Preset positions */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Presets</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_POSITIONS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handlePreset(p.fen)}
                    className="px-2 py-1 rounded text-[11px] bg-secondary hover:bg-secondary/70 text-foreground transition-colors border border-border"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "pgn" && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground mb-1 block">
              PGN String
            </label>
            <textarea
              value={pgnInput}
              onChange={(e) => {
                setPgnInput(e.target.value);
                setError("");
              }}
              placeholder={"1. e4 e5 2. Nf3 Nc6 ..."}
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono
                         text-foreground placeholder:text-muted-foreground resize-none
                         focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground">
              Paste a full PGN game to import and replay.
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={tab === "fen" ? handleLoadFen : handleLoadPgn}
          >
            Load {tab.toUpperCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
