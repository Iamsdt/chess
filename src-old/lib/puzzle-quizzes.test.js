import { describe, expect, it } from "vitest";

import { normalizeQuiz, normalizeUci } from "@/lib/puzzle-quizzes";

describe("puzzle quizzes", () => {
  it("normalizes UCI moves", () => {
    expect(normalizeUci(" E2E4 ")).toBe("e2e4");
    expect(normalizeUci("a7a8Q")).toBe("a7a8q");
  });

  it("normalizes quiz metadata and solution", () => {
    const quiz = normalizeQuiz({
      id: "sample",
      title: "Sample",
      fen: "8/8/8/8/8/8/4P3/4K3 w - - 0 1",
      solution: [" E2E4 "],
      theme: "fork",
      difficulty: "easy",
      description: "Find the move.",
    });

    expect(quiz.title).toBe("Sample");
    expect(quiz.solution).toEqual(["e2e4"]);
    expect(quiz.theme).toBe("fork");
  });
});
