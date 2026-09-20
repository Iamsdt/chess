import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  destroyStockfishEngine,
  getStockfishEngine,
  StockfishEngine,
} from "@/lib/stockfish";

class MockWorker {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.messages = [];
    this.terminated = false;
    this.onmessage = null;
    this.onerror = null;
    MockWorker.instances.push(this);
  }

  emit(line) {
    this.onmessage?.({ data: line });
  }

  postMessage(message) {
    this.messages.push(message);

    if (message === "uci") {
      this.emit("uciok");
      return;
    }

    if (message === "isready") {
      this.emit("readyok");
      return;
    }

    if (String(message).startsWith("go movetime")) {
      this.emit("bestmove e2e4");
      return;
    }

    if (String(message).startsWith("go depth")) {
      this.emit("info depth 12 multipv 2 score cp 10 pv d2d4 d7d5");
      this.emit("info depth 18 multipv 1 score cp 34 pv e2e4 e7e5");
      this.emit("bestmove e2e4");
    }
  }

  terminate() {
    this.terminated = true;
  }
}

class SilentWorker extends MockWorker {
  postMessage(message) {
    this.messages.push(message);
  }
}

describe("StockfishEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWorker.instances = [];
    vi.stubGlobal("Worker", MockWorker);
  });

  afterEach(() => {
    destroyStockfishEngine();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("initializes the worker and performs move and analysis requests", async () => {
    const engine = getStockfishEngine();

    await expect(engine.init()).resolves.toBe(engine);

    expect(MockWorker.instances).toHaveLength(1);
    expect(MockWorker.instances[0].url).toContain(
      "stockfish-18-lite-single.js",
    );
    expect(MockWorker.instances[0].messages).toContain("uci");

    await expect(engine.getMove("startpos", "medium")).resolves.toBe("e2e4");

    const analysis = await engine.analyze("startpos", 18, 3);

    expect(analysis.bestMove).toBe("e2e4");
    expect(analysis.lines).toHaveLength(2);
    expect(analysis.lines[0].pvIdx).toBe(1);
    expect(analysis.lines[0].scoreCp).toBe(34);
    expect(analysis.lines[1].pvIdx).toBe(2);
    expect(StockfishEngine.uciToMove("e7e8q")).toEqual({
      from: "e7",
      to: "e8",
      promotion: "q",
    });
  });

  it("destroys the singleton engine and terminates its worker", async () => {
    const engine = getStockfishEngine();
    await engine.init();

    destroyStockfishEngine();

    expect(MockWorker.instances[0].terminated).toBe(true);
    expect(getStockfishEngine()).not.toBe(engine);
  });

  it("rejects when initialization never finishes", async () => {
    vi.stubGlobal("Worker", SilentWorker);

    const engine = getStockfishEngine();
    const initPromise = engine.init();
    const rejectionExpectation = expect(initPromise).rejects.toThrow(
      "Stockfish init timed out",
    );

    await vi.advanceTimersByTimeAsync(90_000);

    await rejectionExpectation;
  });

  it("can retry initialization after a timeout", async () => {
    vi.stubGlobal("Worker", SilentWorker);

    const engine = getStockfishEngine();
    const firstInit = engine.init();
    const timeoutExpectation = expect(firstInit).rejects.toThrow(
      "Stockfish init timed out",
    );

    await vi.advanceTimersByTimeAsync(90_000);

    await timeoutExpectation;

    vi.stubGlobal("Worker", MockWorker);

    await expect(engine.init()).resolves.toBe(engine);
  });
});
