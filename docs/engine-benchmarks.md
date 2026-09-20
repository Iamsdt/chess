# Engine benchmarks

Measured numbers for the two vendored Stockfish builds in `public/engine/`, and the
evidence behind S07's "done when" list. Everything below was measured on one machine on
2026-09-20; nothing here is estimated. Where something was not measured, it says so.

**Reference machine:** AMD Ryzen 5 5600G, 12 logical cores, 14 GB RAM, Linux (CachyOS,
kernel 7.2.6). Node v24.16.0. Chrome 153 (X11, 1920×1080 at 75 Hz — which is why the
frame-rate numbers below are 75, not 60).

## The two builds

| Build                          | Files                                   | Size (js + wasm) |
| ------------------------------ | --------------------------------------- | ---------------- |
| Stockfish 19 lite, multithread | `stockfish-19-lite.js` + `.wasm`        | 33 KB + 1.64 MB  |
| Stockfish 19 lite, single      | `stockfish-19-lite-single.js` + `.wasm` | 21 KB + 1.79 MB  |

Both embed the same small NNUE (`nn-61e7af4bb97d`), so there is no separate network asset.
The 94 MB full build is deliberately not shipped. Both are **GPLv3** — see
`public/engine/Copying.txt`.

The multi-threaded build needs `SharedArrayBuffer`, which a browser only grants under
cross-origin isolation (COOP `same-origin` + COEP `require-corp`, set in `vite.config.ts`
for both `server` and `preview`). Without it the engine layer loads the single build and
says so through `engine.capabilities()`.

## Browser (Chrome 153, cross-origin isolated)

`movetime 3000` per position, MultiPV 1, Hash 128 MB (sized from `deviceMemory` = 16),
driven through the public `engine.evaluate()` API against the Vite dev server.

| Position   | Multithread (4 threads) | depth | Single thread | depth | Speed-up |
| ---------- | ----------------------: | ----: | ------------: | ----: | -------: |
| opening    |           3,242,195 nps |    25 |   695,255 nps |    24 |    ×4.66 |
| middlegame |           3,200,580 nps |    26 |   699,915 nps |    24 |    ×4.57 |
| endgame    |          12,210,165 nps |    86 | 2,063,791 nps |    69 |    ×5.92 |
| **mean**   |       **6,217,647 nps** |       | **1,152,987** |       |    ×5.39 |

Positions: the start position; the Italian after 7 moves
(`r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7`); a king-and-pawn
endgame (`8/2k5/8/3K4/8/8/5P2/8 w - - 0 1`).

**Startup** (worker spawn → WASM compile → `uciok` → options → `readyok`): 476 ms for the
multi-threaded build on a cold HTTP cache, 230 ms for the single-threaded build on a warm
one. Both are one-off: the pool keeps an engine for 30 s of idleness, and `warmUp()` pays
this cost before the player needs a move.

## Node (`npm run bench:engine`)

The same binaries driven over UCI from Node, `movetime 3000`, Hash 64 MB. This is what CI
and a contributor can reproduce without a browser; the absolute numbers are Node's, and on
this machine Chrome was faster than Node for the same engine.

| Build                              | threads | startup | opening       | middlegame    | endgame       |
| ---------------------------------- | ------: | ------: | ------------- | ------------- | ------------- |
| stockfish-19-lite (multi-threaded) |       4 |  222 ms | 2,858,859 nps | 2,471,474 nps | 5,394,813 nps |
| stockfish-19-lite-single           |       1 |  268 ms | 645,737 nps   | 598,987 nps   | 1,982,900 nps |

Mean: 3,575,049 nps (mt) vs 1,075,875 nps (st) — ×3.32.

## The "done when" list

| Claim                                                | Result                                                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MT build loads under cross-origin isolation          | **Yes.** `crossOriginIsolated: true`, engine id `Stockfish 19 Lite WASM Multithreaded`.                                                                                                          |
| Uses `min(hardwareConcurrency - 1, 4)` threads       | **Yes.** 12 cores → 4 threads, confirmed by the engine's own `EngineInfo` and by the ×4.6 node-rate gain.                                                                                        |
| 3 concurrent analyses keep the main thread at 60 fps | **Yes.** Baseline 75 fps; with three analyses running (lanes `play`/`interactive`/`batch`, 4 + 2 + 2 threads) still 75 fps, median frame 13.33 ms, worst frame 13.34 ms, zero frames over 20 ms. |
| Cancel stops CPU within 100 ms                       | **Yes.** From `AbortController.abort()` to the engine reporting its search finished: 4.28, 4.31, 4.35, 4.36, 9.71 ms over five runs.                                                             |
| Single-thread fallback verified by disabling SAB     | **Yes.** With `hasSharedArrayBuffer: false` the planner selects `st`, and the engine that loads identifies as `Stockfish 19 Lite WASM` with `threads: 1`, `multiThreaded: false`.                |
| Documented nps comparison of both builds             | The two tables above.                                                                                                                                                                            |

The frame-rate figure was taken with `requestAnimationFrame` on a foreground tab; the page
was not also animating, so it measures the _headroom_ the engine leaves, not a busy UI.

## Not measured

- **Mid-range mobile.** No phone was available, so there is no Android or iOS figure —
  neither nps nor frame rate. The plan's "4-core machine" case was extrapolated from the
  planner's unit tests (4 cores → 3 threads, 2 engines), not measured on 4-core hardware.
- **Safari and Firefox.** Only Chrome 153 was measured. The engine worker spawns the
  Stockfish worker as a _nested_ worker, which Safari only supports from 16.4.
- **Production build.** All browser numbers come from the Vite dev server. The engine is a
  static asset either way, so the difference should be the app shell, not the engine — but
  it was not checked.
- **Memory.** Hash is sized from `deviceMemory`, but actual resident memory per worker was
  not measured.

## Reproducing

```sh
npm run bench:engine                 # Node, both builds
npm run bench:engine -- --movetime 5000 --threads 4 --json
```

For the browser figures: run `npx vite`, open the app, and drive `@/engine` from the
console — `createEngine()`, `warmUp()`, `evaluate(fen, { movetimeMs: 3000 })` for nps;
three `analyse()` iterators plus a `requestAnimationFrame` sampler for the frame rate; an
`AbortController` plus `engine.telemetry()` (watching `workers[].state`) for cancellation
latency. Passing `environment: { hasSharedArrayBuffer: false, … }` to `createEngine` forces
the single-threaded fallback without touching the headers.
