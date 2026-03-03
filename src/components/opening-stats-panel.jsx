import { X, Trash2, TrendingUp, BarChart2 } from "lucide-react";
import { useState, useMemo } from "react";

import { Button } from "@/components/ui/Button";
import { getOpeningStats, clearOpeningStats } from "@/lib/opening-stats";

/**
 *
 */
const WinBar = ({ wins, draws, losses }) => {
  const total = wins + draws + losses;
  if (total === 0) {
    return <div className="h-2 rounded-full bg-border/40 w-full" />;
  }
  const wPct = (wins / total) * 100;
  const dPct = (draws / total) * 100;
  const lPct = (losses / total) * 100;

  return (
    <div className="flex h-2 rounded-full overflow-hidden w-full">
      <div style={{ width: `${wPct}%` }} className="bg-green-500" />
      <div style={{ width: `${dPct}%` }} className="bg-yellow-500/70" />
      <div style={{ width: `${lPct}%` }} className="bg-red-500/80" />
    </div>
  );
};

/**
 *
 */
export default function OpeningStatsPanel({ open, onClose }) {
  const [clearFlag, setClearFlag] = useState(false);

  const stats = useMemo(() => {
    void clearFlag; // trigger recompute when clearFlag changes
    return open ? getOpeningStats() : [];
  }, [open, clearFlag]);

  if (!open) return null;

  const totalGames = stats.reduce((s, e) => s + e.total, 0);
  const totalWins = stats.reduce((s, e) => s + e.wins, 0);
  const totalDraws = stats.reduce((s, e) => s + e.draws, 0);
  const totalLosses = stats.reduce((s, e) => s + e.losses, 0);
  const overallWinPct =
    totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  /**
   *
   */
  const handleClear = () => {
    if (
      window.confirm("Clear all opening statistics? This cannot be undone.")
    ) {
      clearOpeningStats();
      setClearFlag((f) => !f);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Opening Statistics
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Track your performance per opening
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Overall summary */}
        {totalGames > 0 && (
          <div className="px-5 py-3 border-b border-border bg-secondary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">
                Overall ({totalGames} games)
              </span>
              <span className="text-xs font-bold text-foreground">
                {overallWinPct}% wins
              </span>
            </div>
            <WinBar wins={totalWins} draws={totalDraws} losses={totalLosses} />
            <div className="flex gap-4 mt-1.5">
              {[
                { label: "Wins", val: totalWins, color: "text-green-400" },
                { label: "Draws", val: totalDraws, color: "text-yellow-400" },
                { label: "Losses", val: totalLosses, color: "text-red-400" },
              ].map(({ label, val, color }) => (
                <span key={label} className="text-[11px] text-muted-foreground">
                  {label}:{" "}
                  <span className={`font-semibold ${color}`}>{val}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats table */}
        <div className="overflow-y-auto flex-1">
          {stats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground gap-3">
              <TrendingUp className="w-10 h-10 opacity-20" />
              <div>
                <p className="text-sm font-medium">No data yet</p>
                <p className="text-xs mt-1 opacity-70">
                  Play complete games to track your opening statistics.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border sticky top-0 bg-card">
                  <th className="text-left px-5 py-2 text-muted-foreground font-medium">
                    Opening
                  </th>
                  <th className="text-center px-2 py-2 text-muted-foreground font-medium w-10">
                    G
                  </th>
                  <th className="text-center px-2 py-2 text-green-400 font-medium w-10">
                    W
                  </th>
                  <th className="text-center px-2 py-2 text-yellow-400 font-medium w-10">
                    D
                  </th>
                  <th className="text-center px-2 py-2 text-red-400 font-medium w-10">
                    L
                  </th>
                  <th className="text-right px-5 py-2 text-muted-foreground font-medium w-20">
                    Win%
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.map((e) => (
                  <tr
                    key={e.eco + e.name}
                    className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-1 rounded">
                          {e.eco}
                        </span>
                        <span
                          className="font-medium text-foreground truncate max-w-[180px]"
                          title={e.name}
                        >
                          {e.name}
                        </span>
                      </div>
                      <WinBar wins={e.wins} draws={e.draws} losses={e.losses} />
                    </td>
                    <td className="text-center px-2 py-2.5 text-muted-foreground tabular-nums">
                      {e.total}
                    </td>
                    <td className="text-center px-2 py-2.5 text-green-400 font-semibold tabular-nums">
                      {e.wins}
                    </td>
                    <td className="text-center px-2 py-2.5 text-yellow-400 tabular-nums">
                      {e.draws}
                    </td>
                    <td className="text-center px-2 py-2.5 text-red-400 tabular-nums">
                      {e.losses}
                    </td>
                    <td className="text-right px-5 py-2.5">
                      <span
                        className={`font-bold tabular-nums ${
                          e.winPct >= 60
                            ? "text-green-400"
                            : e.winPct >= 40
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {e.winPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <p className="text-[11px] text-muted-foreground">
            Stats are recorded automatically at game end
          </p>
          {stats.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-muted-foreground hover:text-red-400 text-xs h-7"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
