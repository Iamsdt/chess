/**
 * useChessClock — chess clock with per-side countdown and optional increment.
 *
 * Usage:
 *   const clock = useChessClock({ enabled, timeControlMs, incrementMs, currentTurn, isGameOver, isReviewMode });
 *   clock.timeWhite  — ms remaining for White
 *   clock.timeBlack  — ms remaining for Black
 *   clock.flagged    — null | "w" | "b"  (who ran out of time)
 *   clock.addIncrement(side) — call after a move to add increment
 *   clock.reset(newTimeMs)  — restart both clocks
 *   clock.pause()            — pause without resetting
 *   clock.resume()           — resume after pause
 */

import { useState, useRef, useEffect, useCallback } from "react";

export const TIME_CONTROLS = [
  { label: "Bullet 1+0", time: 60_000, inc: 0, display: "1+0" },
  { label: "Bullet 2+1", time: 120_000, inc: 1_000, display: "2+1" },
  { label: "Blitz 3+2", time: 180_000, inc: 2_000, display: "3+2" },
  { label: "Blitz 5+0", time: 300_000, inc: 0, display: "5+0" },
  { label: "Blitz 5+3", time: 300_000, inc: 3_000, display: "5+3" },
  { label: "Rapid 10+0", time: 600_000, inc: 0, display: "10+0" },
  { label: "Rapid 15+10", time: 900_000, inc: 10_000, display: "15+10" },
  { label: "Classical 30", time: 1800_000, inc: 0, display: "30+0" },
];

/** Format ms → "M:SS" or "H:MM:SS" */
export function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function useChessClock({
  enabled = false,
  timeControlMs = 300_000,
  incrementMs = 0,
  currentTurn = "w", // "w" | "b"
  isGameOver = false,
  isReviewMode = false,
}) {
  const [timeWhite, setTimeWhite] = useState(timeControlMs);
  const [timeBlack, setTimeBlack] = useState(timeControlMs);
  const [flagged, setFlagged] = useState(null); // "w" | "b" | null
  const [paused, setPaused] = useState(false);

  const intervalRef = useRef(null);
  const flaggedRef = useRef(null);
  const pausedRef = useRef(false);

  // Keep refs in sync
  flaggedRef.current = flagged;
  pausedRef.current = paused;

  const shouldTick =
    enabled && !isGameOver && !isReviewMode && !flagged && !paused;

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!shouldTick) return;

    intervalRef.current = setInterval(() => {
      if (currentTurn === "w") {
        setTimeWhite((t) => {
          const next = t - 100;
          if (next <= 0) {
            setFlagged("w");
            clearInterval(intervalRef.current);
            return 0;
          }
          return next;
        });
      } else {
        setTimeBlack((t) => {
          const next = t - 100;
          if (next <= 0) {
            setFlagged("b");
            clearInterval(intervalRef.current);
            return 0;
          }
          return next;
        });
      }
    }, 100);

    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldTick, currentTurn]);

  /** Call immediately after a move to add the increment for the side who just moved. */
  const addIncrement = useCallback(
    (side) => {
      if (!incrementMs || !enabled) return;
      if (side === "w") setTimeWhite((t) => t + incrementMs);
      else setTimeBlack((t) => t + incrementMs);
    },
    [incrementMs, enabled],
  );

  /** Reset both clocks to a new time (or the original timeControlMs). */
  const reset = useCallback(
    (newTimeMs) => {
      clearInterval(intervalRef.current);
      const t = newTimeMs ?? timeControlMs;
      setTimeWhite(t);
      setTimeBlack(t);
      setFlagged(null);
      setPaused(false);
    },
    [timeControlMs],
  );

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  return {
    timeWhite,
    timeBlack,
    flagged,
    paused,
    addIncrement,
    reset,
    pause,
    resume,
  };
}
