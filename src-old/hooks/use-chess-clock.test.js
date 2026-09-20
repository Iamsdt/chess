// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatTime, useChessClock } from "@/hooks/use-chess-clock";

describe("useChessClock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats elapsed time", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(61_000)).toBe("1:01");
    expect(formatTime(3_661_000)).toBe("1:01:01");
  });

  it("ticks the active side, supports increment, and can reset", () => {
    vi.useFakeTimers();

    const { result } = renderHook(
      ({ currentTurn }) =>
        useChessClock({
          enabled: true,
          timeControlMs: 100,
          incrementMs: 500,
          currentTurn,
          isGameOver: false,
          isReviewMode: false,
        }),
      {
        initialProps: { currentTurn: "w" },
      },
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.timeWhite).toBe(0);
    expect(result.current.flagged).toBe("w");

    act(() => {
      result.current.reset(1_000);
      result.current.addIncrement("b");
    });

    expect(result.current.timeWhite).toBe(1_000);
    expect(result.current.timeBlack).toBe(1_500);
    expect(result.current.flagged).toBeNull();
    expect(result.current.paused).toBe(false);
  });

  it("does not tick while in review mode", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useChessClock({
        enabled: true,
        timeControlMs: 250,
        incrementMs: 0,
        currentTurn: "b",
        isGameOver: false,
        isReviewMode: true,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current.timeWhite).toBe(250);
    expect(result.current.timeBlack).toBe(250);
    expect(result.current.flagged).toBeNull();
  });
});
