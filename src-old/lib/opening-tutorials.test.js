import { describe, expect, it } from "vitest";

import { normalizeSan, normalizeTutorial } from "@/lib/opening-tutorials";

describe("opening tutorials", () => {
  it("strips SAN annotations and checks", () => {
    expect(normalizeSan("Bb5+?!")).toBe("Bb5");
    expect(normalizeSan("Qxd4#")).toBe("Qxd4");
  });

  it("normalizes tutorial metadata and steps", () => {
    const tutorial = normalizeTutorial({
      id: "sample",
      title: "Sample tutorial",
      steps: [
        {
          actor: "player",
          san: "e4+",
          title: "Occupy the center",
          arrows: [{ from: "e2", to: "e4" }],
          focusSquares: ["e4", "d5"],
        },
      ],
    });

    expect(tutorial.title).toBe("Sample tutorial");
    expect(tutorial.steps).toHaveLength(1);
    expect(tutorial.steps[0].san).toBe("e4");
    expect(tutorial.steps[0].arrows[0]).toEqual({
      startSquare: "e2",
      endSquare: "e4",
      color: "#38bdf8",
    });
  });
});
