import { X, Save, FolderOpen, Trash2, Clock, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadAutoSave } from "@/lib/db";
import useGameStore from "@/store/use-game-store";

/**
 *
 */

const formatDate = (ts) =>
  new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// ── Single saved-game row ─────────────────────────────────────────────────
/**
 *
 */
const GameRow = ({ game, onLoad, onDelete, isAutoSave = false }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/40 hover:bg-secondary/70 border border-border/50 transition-colors group">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-sm font-medium text-foreground truncate">
          {game.name}
        </span>
        {isAutoSave && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold shrink-0">
            AUTO
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        <span>{formatDate(game.timestamp)}</span>
        <span>·</span>
        <span>{game.moveHistory?.length ?? 0} moves</span>
        {game.opponent && (
          <>
            <span>·</span>
            <span className="capitalize">{game.opponent}</span>
          </>
        )}
      </div>
    </div>

    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onLoad(game)}
        className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
      >
        <ChevronRight className="h-3.5 w-3.5" />
        Load
      </Button>
      {!isAutoSave && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(game.id)}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  </div>
);

// ── SavedGamesDialog ──────────────────────────────────────────────────────
/**
 *
 */
export default function SavedGamesDialog({
  open,
  onClose,
  onLoadGame,
  currentGameSnapshot, // { pgn, fen, moveHistory, opponent, difficulty, boardOrientation }
}) {
  const { savedGames, fetchSavedGames, saveCurrentGame, deleteSavedGame } =
    useGameStore();

  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveEntry, setAutoSaveEntry] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load list and autosave whenever dialog opens
  useEffect(() => {
    if (!open) return;
    fetchSavedGames();
    loadAutoSave()
      .then(setAutoSaveEntry)
      .catch(() => {});
  }, [open, fetchSavedGames]);

  const handleSave = useCallback(async () => {
    if (!currentGameSnapshot?.moveHistory?.length) return;
    setIsSaving(true);
    try {
      const opponent = currentGameSnapshot.opponent || "engine";
      const moves = currentGameSnapshot.moveHistory?.length ?? 0;
      const name =
        saveName.trim() ||
        `vs ${opponent.charAt(0).toUpperCase() + opponent.slice(1)} · ${moves} moves`;
      await saveCurrentGame({ ...currentGameSnapshot, name });
      setSaveName("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  }, [currentGameSnapshot, saveName, saveCurrentGame]);

  const handleLoad = useCallback(
    (game) => {
      onLoadGame(game);
      onClose();
    },
    [onLoadGame, onClose],
  );

  const handleDelete = useCallback(
    async (id) => {
      await deleteSavedGame(id);
    },
    [deleteSavedGame],
  );

  if (!open) return null;

  const moveCount = currentGameSnapshot?.moveHistory?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Saved Games</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Save current game */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Save Current Game
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder={
                  moveCount > 0
                    ? `e.g. My favourite game · ${moveCount} moves`
                    : "Play some moves first…"
                }
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                disabled={moveCount === 0}
                className="text-sm h-8"
              />
              <Button
                size="sm"
                onClick={handleSave}
                disabled={moveCount === 0 || isSaving}
                className="shrink-0 h-8 px-3 gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {saveSuccess ? "Saved!" : isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
            {moveCount === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                No moves yet — make at least one move to save.
              </p>
            )}
          </section>

          {/* Auto-save */}
          {autoSaveEntry && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Auto-saved
              </h3>
              <GameRow
                game={autoSaveEntry}
                onLoad={handleLoad}
                onDelete={() => {}}
                isAutoSave
              />
            </section>
          )}

          {/* Manual saves */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Saved Games{" "}
              {savedGames.length > 0 && (
                <span className="text-primary font-bold">
                  {savedGames.length}
                </span>
              )}
            </h3>

            {savedGames.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No saved games yet.
                <br />
                Save your current game above.
              </div>
            ) : (
              <div className="space-y-1.5">
                {savedGames.map((game) => (
                  <GameRow
                    key={game.id}
                    game={game}
                    onLoad={handleLoad}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
