/**
 * Stockfish 18 UCI wrapper.
 * Loads the lite single-threaded WASM build served from /public.
 *
 * Difficulty → Skill Level + movetime mapping:
 *   easy   → Skill Level  3,  movetime  150 ms
 *   medium → Skill Level 12,  movetime  800 ms
 *   hard   → Skill Level 20,  movetime 2000 ms
 *
 * Analysis (full strength, depth-based, multi-PV).
 */

const SKILL = { easy: 3, medium: 12, hard: 20 };
const MOVETIME = { easy: 150, medium: 800, hard: 2000 };

export class StockfishEngine {
  constructor() {
    this._worker = null;
    this._ready = false;
    this._initPromise = null;
    /** @type {{ type: 'move'|'analyze', resolve: Function, reject: Function, infoLines?: object }|null} */
    this._pending = null;
  }

  // ── Lazy init ─────────────────────────────────────────────────────────────
  init() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      try {
        this._worker = new Worker("/stockfish-18-lite-single.js");

        this._worker.onmessage = (e) => {
          const line = typeof e === "string" ? e : e.data;
          if (!line || typeof line !== "string") return;

          // Init handshake (handled before _ready is true)
          if (!this._ready) {
            if (line === "uciok") {
              this._worker.postMessage("isready");
              return;
            }
            if (line === "readyok") {
              this._ready = true;
              resolve(this);
              return;
            }
          }

          this._dispatch(line);
        };

        this._worker.onerror = (error) => {
          console.error("Stockfish worker error:", error);
          reject(error);
        };

        this._worker.postMessage("uci");

        setTimeout(() => {
          if (!this._ready) reject(new Error("Stockfish init timed out"));
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });

    return this._initPromise;
  }

  // ── Internal message dispatcher ───────────────────────────────────────────
  _dispatch(line) {
    if (!this._pending) return;
    const p = this._pending;

    if (p.type === "move") {
      if (line.startsWith("bestmove")) {
        this._pending = null;
        const uci = line.split(" ")[1];
        p.resolve(uci && uci !== "(none)" ? uci : null);
      }
    } else if (p.type === "analyze") {
      // Accumulate info lines (we want the last/deepest entry per multipv index)
      if (line.startsWith("info") && line.includes(" pv ")) {
        const pvIndexM = line.match(/multipv (\d+)/);
        const pvIndex = pvIndexM ? pvIndexM[1] : "1";
        const depthM = line.match(/depth (\d+)/);
        const cpM = line.match(/score cp (-?\d+)/);
        const mateM = line.match(/score mate (-?\d+)/);
        const pvM = line.match(/ pv (.+)$/);

        if (depthM && (cpM || mateM) && pvM) {
          p.infoLines[pvIndex] = {
            pvIdx: parseInt(pvIndex),
            depth: parseInt(depthM[1]),
            scoreCp: cpM ? parseInt(cpM[1]) : null,
            isMate: !!mateM,
            mateIn: mateM ? parseInt(mateM[1]) : null,
            pv: pvM[1].trim().split(" ").slice(0, 10),
          };
        }
      }

      if (line.startsWith("bestmove")) {
        this._pending = null;
        const bestUci = line.split(" ")[1];
        const lines = Object.values(p.infoLines).sort(
          (a, b) => a.pvIdx - b.pvIdx,
        );
        p.resolve({
          lines,
          bestMove: bestUci && bestUci !== "(none)" ? bestUci : null,
          scoreCp: lines[0]?.scoreCp ?? null,
          isMate: lines[0]?.isMate ?? false,
          mateIn: lines[0]?.mateIn ?? null,
          pv: lines[0]?.pv ?? [],
        });
      }
    }
  }

  // ── Abort any in-flight operation ─────────────────────────────────────────
  async _abort() {
    if (!this._pending) return;
    this._worker.postMessage("stop");
    // Give the engine a tick to reply with bestmove before we stomp on state
    await new Promise((r) => setTimeout(r, 60));
    if (this._pending) {
      this._pending.reject(new Error("Aborted"));
      this._pending = null;
    }
  }

  // ── Get best move (game mode) ─────────────────────────────────────────────
  /**
   * @param {string} fen
   * @param {'easy'|'medium'|'hard'} difficulty
   * @returns {Promise<string|null>} UCI move like "e2e4"
   */
  async getMove(fen, difficulty = "medium") {
    await this.init();
    await this._abort();

    const skill = SKILL[difficulty] ?? 12;
    const movetime = MOVETIME[difficulty] ?? 800;

    return new Promise((resolve, reject) => {
      this._pending = { type: "move", resolve, reject };
      this._worker.postMessage("setoption name MultiPV value 1");
      this._worker.postMessage(`setoption name Skill Level value ${skill}`);
      this._worker.postMessage(`position fen ${fen}`);
      this._worker.postMessage(`go movetime ${movetime}`);
    });
  }

  // ── Analyze position (coach mode) ────────────────────────────────────────
  /**
   * @param {string} fen
   * @param {number} [depth]
   * @param {number} [multiPV]   number of top lines to return
   * @returns {Promise<{ lines, bestMove, scoreCp, isMate, mateIn, pv }>}
   */
  async analyze(fen, depth = 18, multiPV = 3) {
    await this.init();
    await this._abort();

    return new Promise((resolve, reject) => {
      this._pending = { type: "analyze", resolve, reject, infoLines: {} };
      this._worker.postMessage(`setoption name MultiPV value ${multiPV}`);
      this._worker.postMessage("setoption name Skill Level value 20"); // full strength for analysis
      this._worker.postMessage(`position fen ${fen}`);
      this._worker.postMessage(`go depth ${depth}`);
    });
  }

  // ── Convert UCI move string → chess.js move object ────────────────────────
  static uciToMove(uci) {
    if (!uci || uci.length < 4) return null;
    return {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? uci[4] : undefined,
    };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  destroy() {
    if (this._pending) {
      this._pending.reject(new Error("Engine destroyed"));
      this._pending = null;
    }
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._ready = false;
    this._initPromise = null;
  }
}

// ── Singleton helpers ─────────────────────────────────────────────────────────
let _instance = null;

/**
 *
 */
export const getStockfishEngine = () => {
  if (!_instance) _instance = new StockfishEngine();
  return _instance;
};

/**
 *
 */
export const destroyStockfishEngine = () => {
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
};
