# Chess King — Sprint Plan (v1 rebuild)

**What we are building:** a free, open-source, offline-capable chess _learning_ app. Single user, no accounts, no server database. Everything runs in the browser: Stockfish (WASM, in workers), IndexedDB for storage, a bring-your-own-key AI coach ("Sage"). Hosted as static files on Cloudflare's free tier. The approved UI is the "Grove Bloom" design in `prototype/` — those 23 HTML pages are the visual source of truth.

**Stack:** Vite + React 19 + **TypeScript** (strict; zod for runtime validation at boundaries) · TanStack Router · Zustand (UI state) + TanStack Query (async/worker calls) · Dexie (IndexedDB) · Tailwind v4 + shadcn/ui · chess.js · **Stockfish 19 lite, multi-threaded** WASM (1.6 MB; single-threaded lite as fallback) · Comlink for workers · Vitest + Testing Library + Playwright · ESLint + Prettier + Husky · GitHub Actions → Cloudflare Workers static assets.

**Engineering rules that apply to every sprint** (the "quality bar", see §5): contract-first (shared types + zod schemas), strict types with no `any`, pure domain logic separated from React, everything heavy off the main thread, tests with every unit of work, no dead code, no TODOs left behind.

---

## 1. Sprint summary (one line each)

| #       | Sprint              | What it delivers                                                                                                                           | Depends on         |
| ------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| **S01** | Repo scaffold       | Vite/React/TS project, lint, test, CI, folder structure, dev server running                                                                | —                  |
| **S02** | Design system       | Grove Bloom tokens + shadcn components + custom primitives, light/dark, kitchen-sink route                                                 | S01                |
| **S03** | Domain contracts    | Shared TypeScript types + zod schemas for every shared shape, enums, IDs, fixture factories                                                                    | S01                |
| **S04** | App shell & routing | Routes, sidebar, bottom nav, chat panel frame, theme switching, responsive layout                                                          | S02, S03           |
| **S05** | Persistence layer   | Dexie schema, migrations, repositories, live-query hooks, backup/restore                                                                   | S03                |
| **S06** | Chess core          | chess.js wrapper, FEN/PGN/SAN utils, material, ECO opening detection, pure classifiers                                                     | S03                |
| **S07** | Engine layer        | Stockfish 19 lite multi-thread worker pool, UCI parser, lanes, cancellation, benchmarks                                                  | S03                |
| **S08** | Board component     | Interactive board: drag/click, arrows, marks, hints, promotion, themes, piece sets, a11y                                                   | S02, S03           |
| **S09** | Chat UI (mock)      | Sage panel: thread, composer, attachments, streaming renderer, `CoachPort` interface + mock                                                | S02, S03           |
| **S10** | Puzzle + lesson data| Import the 10,000-puzzle Lichess CSV set into IndexedDB, lesson packs, attribution, registry                                                   | S03                |
| **S11** | Background jobs     | Durable job queue (IndexedDB), idle scheduler, Web Locks, BroadcastChannel, worker orchestration, devtools                                 | S05, S07           |
| **S12** | Play vs engine      | Game state machine, clocks, takeback, promotion, sounds, blunder guard, setup + game screens                                               | S05, S06, S07, S08 |
| **S13** | Game review         | Background full-game analysis, accuracy, classifications, eval graph, key moments, review screen                                           | S11, S06, S08      |
| **S14** | Puzzles             | Band curriculum + rating-based selection, hint ladder, session runner, hub + solver screens                                              | S05, S06, S08, S10 |
| **S15** | SRS + Mistake Bank  | FSRS scheduler, card states, due queues, mistake capture, review session, bank screen                                                      | S05, S06, S08      |
| **S16** | Lessons             | Lesson player (retrieval practice), course map, progress tracking                                                                          | S08, S10, S05      |
| **S17** | Openings            | Repertoire tree editor, PGN→tree import, drill screen reusing the SRS scheduler                                                            | S15, S06, S08      |
| **S18** | Drills              | Endgame drills vs engine (par moves), board-vision drills                                                                                  | S07, S08           |
| **S19** | Analysis board      | MultiPV lines, variation tree, position setup, FEN/PGN in/out, optional online explorer                                                    | S07, S06, S08      |
| **S20** | Games library       | PGN import/export in a worker, Lichess + Chess.com import, filters, table                                                                  | S05, S06, S11      |
| **S21** | Sage providers      | BYOK crypto (AES-GCM + optional passphrase), Gemini/OpenAI/Anthropic adapters, streaming, context builder, spoiler guard, token accounting | S09, S07, S05      |
| **S22** | Growth              | Rating charts, skill radar, heatmap, garden levels, milestones                                                                             | S05                |
| **S23** | Settings            | All panels incl. live board/piece switching, data export/import, storage, about                                                            | S02, S05, S21      |
| **S24** | Habit loop          | Streak + freeze, daily goal, today's path builder, session summary, garden growth                                                          | S05, S14           |
| **S25** | Onboarding          | 4-step first run, placement puzzles, defaults written to DB                                                                                | S14, S05           |
| **S26** | PWA & offline       | Service worker, precache app + engine + packs, update flow, offline states                                                                 | S07, S10           |
| **S27** | Share links         | URL-fragment codec (compressed), share landing, puzzle challenges, correspondence by link                                                  | S06, S14           |
| **S28** | Friends live        | Cloudflare Durable Object relay, transport client, live game screen, reconnect, rematch                                                    | S12, S27           |
| **S29** | Hardening & release | CSP + COOP/COEP headers, Lighthouse/a11y/bundle budgets in CI, error boundaries, deploy                                                    | most               |

---

## 2. Execution waves (what can run in parallel)

Each sprint is sized for **one agent working alone in its own git worktree**. A wave starts only when the previous wave's sprints are merged.

```
WAVE 0  (sequential, 1 agent)          S01
WAVE 1  (2 agents, parallel)           S02   S03
WAVE 2  (6 agents, parallel)           S04  S05  S06  S07  S08  S09  S10
WAVE 3  (5 agents, parallel)           S11  S12*  S14*  S19  S20
WAVE 4  (6 agents, parallel)           S13  S15  S16  S17  S18  S22  S23
WAVE 5  (5 agents, parallel)           S21  S24  S25  S26  S27
WAVE 6  (2 agents)                     S28  S29
```

\* S12 and S14 need S05–S08 only, so they can start as soon as Wave 2 lands; S11 runs beside them and S13 waits for both S11 and S12.

**Why this is safe to parallelize:** Wave 1 freezes the two contracts everyone else codes against — the design system (S02) and the domain types (S03). After that, each Wave 2 sprint owns a separate top-level folder and never edits another sprint's files. Wave 3+ sprints consume published interfaces, not implementations, and each ships with fixtures so it can be built and tested before its upstream feature exists.

**File ownership (no two sprints touch the same folder):**

```
src/app/            S04   routes, layout, shell
src/design/         S02   tokens, ui primitives (shadcn)
src/domain/         S03   types, schemas, pure helpers
src/data/           S05   dexie, repositories, backup
src/chess/          S06   rules, pgn, eco, classify
src/engine/         S07   stockfish worker, pool, uci
src/board/          S08   board component + pieces
src/coach/          S09 (ui) + S21 (providers, crypto)
src/content/        S10   pack schema, loader, packs
src/jobs/           S11   queue, scheduler, workers
src/features/play/        S12
src/features/review/      S13
src/features/puzzles/     S14
src/features/srs/         S15
src/features/learn/       S16
src/features/openings/    S17
src/features/drills/      S18
src/features/analysis/    S19
src/features/library/     S20
src/features/growth/      S22
src/features/settings/    S23
src/features/habit/       S24
src/features/onboarding/  S25
src/features/share/       S27
src/features/friends/     S28
worker/                   S28 (Durable Object), S29 (headers)
```

---

## 3. Sprint detail

Every sprint below states: **Goal · Scope · Interfaces · Done when · Tests**. "Done when" is the merge gate; nothing merges without its tests green and its screens matching the prototype.

### WAVE 0

#### S01 · Repo scaffold

- **Goal:** a clean, strict project skeleton that boots.
- **Scope:** Vite + React 19 + **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`); path aliases (`@/…`); ESLint set strictly (typescript-eslint strict + type-checked rules, react-hooks `exhaustive-deps` as an **error**, import ordering, no-restricted-imports to protect layer boundaries) + Prettier; Vitest + Testing Library + jsdom; Playwright smoke; Husky + lint-staged; GitHub Actions (typecheck, lint, unit, build, size budget); `docs/` and `CONTRIBUTING.md`; no `.env` (this app has no secrets of its own).
- **Interfaces:** folder structure above created with `index.ts` barrels.
- **Done when:** `npm run dev`, `npm test`, `npm run build`, `npm run lint`, `npm run typecheck` all pass in CI on a blank route.
- **Tests:** one trivial unit test + one Playwright smoke ("app boots").

### WAVE 1

#### S02 · Design system

- **Goal:** the Grove Bloom look as reusable components.
- **Scope:** port `prototype/assets/theme.js` tokens into `globals.css` (light + `.dark`, board themes); install shadcn components (button, card, badge, dialog, sheet, tabs, switch, select, slider, input, textarea, tooltip, progress, separator, avatar, dropdown-menu, scroll-area, sonner); add project primitives: `CtaButton`, `StatCard`, `SectionHeader`, `QualityGlyph` (move-quality), `RingProgress`, `EmptyState`, `PageHeader`; theme provider with persisted light/dark; a `/dev/kitchen-sink` route rendering every component in both themes.
- **Interfaces:** `@/design` exports; token names identical to the prototype so prototype markup ports 1:1.
- **Done when:** kitchen-sink matches prototype visuals side by side; zero raw hex outside tokens.
- **Tests:** render tests per primitive; a11y (axe) on kitchen-sink; visual snapshot of kitchen-sink in both themes.

#### S03 · Domain contracts

- **Goal:** the single source of truth all other sprints code against: **types at compile time, zod at run time**.
- **Scope:** one zod schema per shared shape, with the TypeScript type derived from it via `z.infer` so the two can never drift — `Game`, `GameMeta`, `MoveRecord`, `MoveQuality`, `EngineEval`, `EngineLine`, `Puzzle`, `PuzzleAttempt`, `Lesson`, `LessonStep`, `ContentPack`, `RepertoireNode`, `SrsCard`, `ReviewOutcome`, `MistakeEntry`, `Profile`, `Settings`, `StreakState`, `Job`, `CoachMessage`, `CoachContext`, `SharePayload`; branded ID types (`GameId`, `PuzzleId`…) and branded `Fen`/`San`/`Uci` so look-alike strings can't be swapped; enums as const unions; `Result<T, E>` helpers (`ok()`, `err()`) so boundaries return values instead of throwing; `assertValid(schema, value, where)` for data crossing a runtime boundary, throwing loudly in dev and reporting a readable error in production; fixture factories (`makeGame()`, `makePuzzle()`…) used by every other sprint's tests.
- **Done when:** types compile standalone with no `any`; every schema round-trips its fixture; `assertValid` produces a readable message naming the field and the source.
- **Tests:** round-trip + rejection tests per schema; fixtures validate against schemas; type-level tests (`expectTypeOf`) for the branded IDs and `Result`.

### WAVE 2 — platform (all parallel)

#### S04 · App shell & routing

- **Goal:** the frame every screen lives in.
- **Scope:** TanStack Router file routes for all 23 screens (placeholder pages); sidebar with groups/badges, mobile bottom nav, compact rail on board layouts, right chat panel slot with open/closed/overlay behaviour, keyboard shortcuts (`/` focus chat, `g` navigation), command palette shell (⌘K), toasts, error boundary + 404.
- **Interfaces:** `<AppShell>`, `useChatPanel()`, route ids/paths exported for typed links.
- **Done when:** every prototype URL exists and navigates; layout correct at 1440 / 1280 / 390; chat panel behaviour matches prototype.
- **Tests:** route smoke tests; responsive + keyboard e2e.

#### S05 · Persistence layer

- **Goal:** durable local storage with a clean repository API.
- **Scope:** Dexie DB `chessking` with tables: games, moves, puzzles, attempts, srsCards, mistakes, packs, lessonsProgress, repertoire, sessions, jobs, settings, profile, kv; versioned migrations (with a migration test harness); repositories per aggregate (no Dexie calls in UI); `useLiveQuery` hooks; JSON backup export/import (zod-validated, versioned, **never includes API keys**); storage estimate + quota warning; dev seed script.
- **Interfaces:** `@/data` repositories + hooks.
- **Done when:** repositories cover CRUD + queries used by features; backup/restore round-trips a seeded DB; migration v1→v2 test passes.
- **Tests:** fake-indexeddb unit tests per repository; migration tests; backup round-trip property test.

#### S06 · Chess core

- **Goal:** all rules/format logic in pure, fast, tested functions.
- **Scope:** immutable game wrapper over chess.js (apply/undo, legal moves, check/mate/stalemate, threefold, 50-move); FEN validation and normalization; PGN parse/serialize incl. headers, comments, NAGs, variations; SAN↔UCI; material count and imbalance; ECO opening detection from a bundled table; pure move classification given before/after evals (brilliant…blunder thresholds); accuracy formula (documented, tested against known games).
- **Interfaces:** `@/chess` pure functions, no React, no workers.
- **Done when:** classification and accuracy match a golden file of 3 annotated games within tolerance.
- **Tests:** heavy unit tests + property tests (random legal playouts never crash), golden-file tests.

#### S07 · Engine layer _(background-processing keystone)_

- **Goal:** Stockfish that never blocks the UI and can run several jobs at once.
- **Scope:** **Stockfish 19 lite (multi-threaded)** WASM — `stockfish-19-lite.wasm`, about 1.6 MB, small NNUE embedded — in **dedicated Web Workers**, wrapped with Comlink; capability detection (SharedArrayBuffer + cross-origin isolation → multi-thread build; otherwise `stockfish-19-lite-single`, about 1.7 MB); the full 94 MB build is explicitly rejected as too heavy for the browser; **worker pool** with named lanes and priorities — `play` (move for the opponent), `interactive` (hints, eval bar), `batch` (full-game analysis, runs at low priority) — so a background review never delays a live move; per-request cancellation (`stop`) and timeouts; strict UCI parser (info/bestmove/multipv/score cp+mate/wdl); NNUE asset loading with Cache API; warm-up and idle shutdown; hard caps on threads/hash sized from `navigator.hardwareConcurrency` and `deviceMemory`; telemetry (nps, depth, time) surfaced for the devtools panel.
- **Interfaces:** `engine.bestMove(fen, opts)`, `engine.analyse(fen, {multiPv, depth, movetime, signal})` (async iterator of `EngineLine[]`), `engine.evaluate(fen)`, `engine.setStrength(elo)`, `engine.capabilities()`.
- **Done when:** the multi-thread build loads under cross-origin isolation and uses `min(hardwareConcurrency - 1, 4)` threads; 3 concurrent analyses on a 4-core machine keep the main thread at 60 fps (measured); cancel stops CPU within 100 ms; the single-thread fallback is verified by disabling SAB; a documented nps comparison of both builds is in `docs/engine-benchmarks.md`.
- **Tests:** UCI parser unit tests; pool tests with a fake engine worker; a benchmark script (`npm run bench:engine`) recording nps and startup time.

#### S08 · Board component

- **Goal:** one board used by every screen.
- **Scope:** `<Board>` with FEN, orientation, drag + click-to-move (touch-friendly), legal-move dots/capture rings, last-move and check highlights, arrows (3 kinds), move-quality badges, focus squares, promotion picker, premoves, coordinates toggle, animation speed, board themes + piece sets (california/staunty/maestro/alpha, self-hosted, licence noted), reduced-motion support, full keyboard play (select square, arrow keys, enter) and screen-reader move announcements.
- **Interfaces:** `<Board onMove={} shapes={} …/>`, imperative `boardRef.flash()/shake()`.
- **Done when:** parity with prototype boards; 60 fps drag on mid-range mobile; a11y keyboard play works end to end.
- **Tests:** interaction tests (click, drag, promotion, illegal move rejection), a11y test, visual snapshots per theme.

#### S09 · Chat UI (mock coach)

- **Goal:** the whole Sage panel, provider-agnostic.
- **Scope:** thread with day dividers, timestamps, bubbles, board attachment cards, quick replies, typing indicator, streaming token renderer, markdown subset (bold, lists, `san`), "no spoilers" and "engine" toggles, attachment chip for the current position, per-screen seed messages, chat history list, new chat, empty/no-key states, error + retry states, virtualized list for long threads.
- **Interfaces:** `CoachPort` (`send(messages, context, {signal}) → AsyncIterable<Delta>`), `useCoach()`; ships with `MockCoach` returning scripted replies.
- **Done when:** every prototype chat state renders from the mock; panel works as overlay on mobile.
- **Tests:** streaming render test, cancellation test, a11y (live region announces new messages).

#### S10 · Puzzle data + lesson packs

- **Goal:** get the real content in, correctly attributed, without a server.
- **Source of truth:** `public/quiz/` — **10,000 puzzles from the Lichess open puzzle database**, already curated into six "bands" as CSV plus an `index.json` manifest. The old per-puzzle JSON format is dead; do not use it.

  | Band | Puzzles | Band | Puzzles |
  |---|---|---|---|
  | pawn | 200 | rook | 1,500 |
  | knight | 400 | queen | 2,700 |
  | bishop | 800 | king | 4,400 |

  Columns: `id, fen, solution_ucis, category (band), sub_level (1–10), difficulty (beginner/intermediate/advanced), title, theme, prompt, rating (789–2297, mean 1547), rating_label, tags, explanation, active, source (lichess), lichess_id, nb_plays, popularity, opening_tags`. 35 distinct themes, the biggest being fork (1,931), mateIn2 (1,463), pin (886), mateIn3 (868), discoveredAttack (814), endgame (530).
- **Scope:**
  - CSV parsing **in a worker** (streaming, quoted fields with embedded commas and braces, `{"a","b"}` list columns), validated row by row with the S03 `Puzzle` schema; a row that fails validation is skipped and reported, never silently dropped.
  - First-run import into IndexedDB, band by band with visible progress, resumable through the S11 job queue; idempotent (re-import updates, never duplicates); indexes on band, sub_level, rating, theme and difficulty for the selection queries in S14.
  - Manifest handling via `index.json` (version per band) so a content update re-imports only the changed bands.
  - Keep the CSVs as static assets (3.6 MB total) cached by the service worker; the app works offline after the first import.
  - **Attribution, in the app not just the repo:** every puzzle keeps `source` and `lichess_id`, the solver shows a "Puzzle from Lichess" link to `lichess.org/training/<lichess_id>`, and About + README credit the Lichess open puzzle database with its licence. Verify the exact licence text (the Lichess puzzle database is published as open data under CC0) before release and record it in `docs/licences.md` along with the piece-set licences.
  - Lesson/tutorial packs keep the JSON pack format (zod `ContentPack` schema, loader, registry, import from file or URL with a readable validation report), seeded from the existing 49 tutorials, plus authoring docs and a CLI validator (`npm run content:validate`) that checks both CSV puzzles and JSON packs.
- **Interfaces:** `@/content` — `importPuzzleBands({onProgress})`, `getPuzzleStats()`, pack loader/registry APIs.
- **Done when:** all 10,000 puzzles import in under ~20 s on a mid-range laptop without blocking the UI, every FEN and solution validates as legal (spot-checked by replaying `solution_ucis` through the S06 rules), and re-running the import changes nothing.
- **Tests:** CSV parser tests on the tricky quoted columns; a legality test that replays a random 500-puzzle sample; idempotency test; manifest-bump test; CLI exit codes.

### WAVE 3 — core loops

#### S11 · Background job system _(background-processing keystone)_

- **Goal:** long work that survives reloads and never fights the UI.
- **Scope:** durable queue in IndexedDB (`jobs` table: type, payload, state, priority, attempts, progress, error, createdAt); scheduler using `requestIdleCallback` + `navigator.scheduling.isInputPending()` with a main-thread budget; **Web Locks** so only one tab processes a job type; **BroadcastChannel** to fan out progress to all tabs; retry with exponential backoff and poison-job quarantine; pause/resume on visibility and on battery saver; job types registered by features (`analyse-game`, `import-pgn`, `recompute-srs`, `prefetch-pack`, `rebuild-stats`); a `/dev/jobs` panel showing queue, progress, throughput, and engine telemetry.
- **Interfaces:** `jobs.enqueue(type, payload, {priority})`, `jobs.observe(id)`, `jobs.cancel(id)`, `registerHandler(type, handler)`.
- **Done when:** a queued full-game analysis survives a page reload and finishes; UI stays responsive (frame timings recorded in the test); two tabs never double-process.
- **Tests:** queue unit tests (fake timers), multi-tab lock test, crash-recovery test.

#### S12 · Play vs engine

- **Goal:** the sparring loop end to end.
- **Scope:** game state machine (XState-style reducer, no library required): setup → playing → gameOver; engine opponent with rating-calibrated strength (skill level + move-time + occasional human-like inaccuracy, documented mapping), personalities (solid/aggressive/tricky via search bias); clocks with increment and low-time warning; takeback (full move pair, engine-aware), resign, offer draw; promotion picker; sounds; **training wheels** — pre-move blunder guard that runs on the `interactive` engine lane and warns before a hanging move; autosave every move; play-setup screen; game-over dialog that enqueues the analysis job.
- **Done when:** a full game can be played, reloaded mid-game and resumed; takeback never desyncs; blunder guard adds no perceptible lag.
- **Tests:** state machine unit tests, resume-after-reload e2e, guard timing test.

#### S14 · Puzzles

- **Goal:** the adaptive puzzle loop.
- **Scope:** Glicko-2 rating for the user (puzzle ratings come from the dataset); selection targeting ~75% success, drawn from the band curriculum (pawn → knight → bishop → rook → queen → king, `sub_level` 1–10 within each) and weighted toward weak themes; session runner (streaks, timer, progress dots); hint ladder (nudge → square → move) with rating penalty; solution validation incl. multi-move lines and engine replies; Puzzle Rush and Survival modes with their own timers/lives; daily puzzle (deterministic by date); theme mastery stats; hub + solver + rush screens.
- **Done when:** ratings converge sensibly in a simulation (property test over 1000 attempts); sessions resume after reload; each solved puzzle shows its theme, rating and its Lichess source link.
- **Tests:** Glicko-2 unit tests vs reference values; selection distribution test; solver interaction e2e.

#### S19 · Analysis board

- **Goal:** a serious analysis surface.
- **Scope:** interactive board, eval bar, MultiPV top-3 lines with arrows, depth/time controls, variation tree with branching and promote/delete, position setup dialog (piece palette, castling/en-passant/side-to-move, FEN validation), PGN/FEN load and copy, "practice from here", optional online opening explorer (Lichess API, clearly labelled, graceful offline).
- **Done when:** analysis runs on the `interactive` lane and stops instantly on navigation; variation tree survives reload.
- **Tests:** tree operations unit tests, setup-dialog validation tests, offline behaviour test.

#### S20 · Games library

- **Goal:** get games in and out.
- **Scope:** PGN parse/serialize **in a worker** (streaming, thousands of games); import from file, paste, Lichess username, Chess.com username (public APIs, from the browser, with rate-limit handling and progress); dedupe on import; filters (result, opponent type, opening, date, accuracy) and sortable virtualized table; export single/all PGN; bulk "analyse imported games" enqueued as background jobs.
- **Done when:** a 5 MB PGN imports without freezing the UI and shows progress; re-import creates no duplicates.
- **Tests:** parser fuzz tests, dedupe tests, import e2e with a mocked API.

### WAVE 4 — learning features

#### S13 · Game review

- **Goal:** turn each game into a lesson.
- **Scope:** `analyse-game` job handler (batch lane, resumable, progress per move); accuracy + classification per move; eval graph; key moments detection (biggest swings, missed wins, turning points); plain-language explanations generated from engine + rules (no LLM required); "retry this position"; mistakes pushed into the Mistake Bank; review screen with tabs (Summary / Key moments / Moves).
- **Done when:** a 40-move game analyses in the background while the user keeps using the app; explanations never contradict the engine line.
- **Tests:** golden-file review of 3 games; resumability test; explanation template tests.

#### S15 · SRS + Mistake Bank

- **Goal:** your own mistakes, scheduled.
- **Scope:** FSRS-6 implementation (pure, documented, unit-tested against reference vectors), card states (new/learning/review/relearning/mastered), due queue with daily caps and interleaving, mistake capture from review and from puzzles, review session runner reusing the puzzle solver UI, "why you missed it" recap, bank screen with filters, schedule strip, mastery pipeline.
- **Done when:** scheduling matches reference implementation outputs; 200 cards schedule in <10 ms.
- **Tests:** FSRS vector tests, queue ordering tests, session e2e.

#### S16 · Lessons

- **Goal:** learning by playing the moves.
- **Scope:** lesson player driven by pack data (steps, coach text, arrows, focus squares, expected move, alternatives), retrieval prompts, hint ladder, wrong-move feedback, completion card, course map with units and progress, resume where you left off.
- **Done when:** all 49 converted tutorials play through without content errors.
- **Tests:** player state tests, content-driven smoke test across every lesson.

#### S17 · Openings

- **Goal:** a repertoire you build and drill.
- **Scope:** repertoire tree data model + editor (add/annotate/delete moves, mark main line, transpositions), import lines from PGN, coverage stats ("what happens if Black plays X?" gaps), drill mode that feeds lines into the S15 scheduler, opponent replies weighted by popularity, explore catalogue with ECO/style tags.
- **Done when:** a 200-node repertoire edits and drills smoothly; gaps report is correct on a fixture.
- **Tests:** tree ops unit tests, transposition detection test, drill integration test.

#### S18 · Drills

- **Goal:** technique practice.
- **Scope:** endgame drills (position, par moves, engine defends at full strength, win/draw detection, star rating, best record) for the basic mates, opposition, square rule, Lucena, Philidor; board-vision drills (name the square, find all checks, knight route, blindfold move) with timers and scores.
- **Done when:** drills detect success/failure correctly, including "technically won but over par".
- **Tests:** drill rule tests per position, timing tests.

#### S22 · Growth

- **Goal:** see yourself improve.
- **Scope:** rating charts (puzzle, sparring) with range selector, "you vs you 30 days ago" deltas, skill radar from theme mastery, 16-week practice heatmap, garden levels, milestones (earned/locked), stats aggregation job (`rebuild-stats`) so charts read precomputed rows.
- **Done when:** charts render from real DB data under 16 ms; no leaderboard anywhere.
- **Tests:** aggregation unit tests, chart a11y (table alternative) tests.

#### S23 · Settings

- **Goal:** full control, clearly explained.
- **Scope:** profile, daily goal, reminder; board theme + piece set + coordinates + animation + premove + promotion (live preview); light/dark/system; sound; coach panel (provider, model, key, tone, spoiler guard, usage meter — UI here, crypto in S21); data (export/import backup, export PGN, storage meter, clear all with typed confirmation); about (MIT, GitHub, version, "no accounts, no tracking").
- **Done when:** every setting persists and takes effect immediately; clear-all really clears and reloads to onboarding.
- **Tests:** persistence tests per setting, destructive-flow e2e.

### WAVE 5 — coach, habit, offline, sharing

#### S21 · Sage providers (BYOK + crypto)

- **Goal:** the real coach, with the user's key kept safe.
- **Scope:** key vault — AES-GCM with a **non-extractable** CryptoKey stored in IndexedDB, optional passphrase lock (PBKDF2, session unlock), keys never in backups, masked display, test-key call, remove-key; provider adapters (Gemini, OpenAI, Anthropic) behind `CoachPort` with streaming, abort, retries, and provider-specific browser headers; context builder (current position, engine lines when "engine" is on, recent games, weak themes, current screen) with a token budget and redaction; spoiler guard (system prompt + client-side answer filter during puzzles/lessons); token + cost accounting per month; graceful degradation when no key.
- **Done when:** real streaming answers appear in the S09 UI; locked vault cannot decrypt without the passphrase; backup file provably contains no key material.
- **Tests:** vault unit tests (encrypt/decrypt/lock/wrong passphrase), adapter tests against recorded responses, spoiler-guard tests, backup-has-no-key test.

#### S24 · Habit loop

- **Goal:** why the user comes back tomorrow.
- **Scope:** streak with one freeze per week, daily goal (5/15/30 min) and its ring, "today's path" builder that picks the next 2–4 actions from due mistakes, weak themes and the current lesson, session summary screen (peak-end), garden growth tied to streak + goals, optional local reminder notification.
- **Done when:** the path builder produces sensible plans for 6 fixture profiles; streak/freeze logic survives timezone changes and clock skew.
- **Tests:** planner unit tests over fixtures, streak edge-case tests (midnight, DST, missed days).

#### S25 · Onboarding

- **Goal:** playing in under a minute.
- **Scope:** 4 steps (level, goals, daily time + board theme, optional coach key with prominent skip), optional 5-puzzle placement that seeds the starting puzzle rating, writes profile/settings/first path, skippable at any point, re-runnable from settings.
- **Done when:** a fresh browser reaches a usable Today screen in under 60 seconds with no dead ends.
- **Tests:** full onboarding e2e, placement-rating unit tests.

#### S26 · PWA & offline

- **Goal:** installable and fully usable offline.
- **Scope:** service worker (Workbox or hand-rolled): precache app shell, the Stockfish lite WASM (multi-thread + single-thread fallback), lesson packs and piece sets; puzzles need no caching after the first import because they already live in IndexedDB, but the band CSVs are cached so a fresh device can import offline; runtime caching rules; versioned update flow with an "update ready" prompt; offline indicators on online-only features (explorer, imports, coach); install prompt; iOS quirks documented.
- **Done when:** after one visit, airplane mode still allows play, puzzles, lessons, review and analysis.
- **Tests:** Playwright offline tests, SW update test.

#### S27 · Share links

- **Goal:** sharing with zero infrastructure.
- **Scope:** codec that packs a position/game/puzzle-challenge/correspondence move into a URL fragment (binary encode + deflate + base64url, versioned, size-guarded), share landing screen that decodes without touching a server, challenge links with fixed puzzle sets and score comparison, correspondence-by-link flow (make move → copy link → friend opens → replies), copy/QR UI.
- **Done when:** a 60-move game fits in a shareable URL; malformed links fail gracefully.
- **Tests:** codec round-trip property tests, size budget test, tamper test.

### WAVE 6 — live play and release

#### S28 · Friends live

- **Goal:** play a friend in real time, still with no database.
- **Scope:** Cloudflare Worker + **Durable Object** room (SQLite-backed, free tier): WebSocket hibernation, move relay with server-side legality check via a tiny rules subset, turn/clock authority, reconnect with state resync, idle room expiry, no persistence of user data; client transport with heartbeats, backoff, offline detection; live game screen (clocks, connection quality, canned reactions, draw/resign/rematch); both players get the game in their own Review afterwards; fallback note when the relay is unreachable.
- **Done when:** two browsers play a full game through the relay; killing one's network and returning resumes the game; free-tier request math documented in the README.
- **Tests:** DO unit tests (Miniflare), reconnect e2e with simulated network loss.

#### S29 · Hardening & release

- **Goal:** ship it, keep it fast.
- **Scope:** `_headers` with COOP/COEP (for multi-thread Stockfish) and a strict CSP (the defence that makes the key vault meaningful); Lighthouse CI budgets (LCP, TBT, CLS), bundle-size budget per route, axe a11y gate, unit coverage gate on `src/domain`, `src/chess`, `src/engine`; error boundaries + a local ring-buffer log with "copy diagnostics"; empty/error/loading states audit; README, screenshots, licence notes for piece sets; deploy workflow to Cloudflare, preview per PR; post-deploy smoke test.
- **Done when:** production build meets every budget and the deployed site passes the smoke suite.
- **Tests:** the gates themselves are the tests.

---

## 4. Dependency rules (read before starting any sprint)

- **S01 → everything.** Nothing starts before the scaffold merges.
- **S02 and S03 gate all of Wave 2.** They must be reviewed carefully; changing a token name or a core type later costs every downstream sprint.
- **S05, S06, S07, S08 gate all features.** A feature sprint may not reimplement rules, storage or engine access — if something is missing there, raise it instead of working around it.
- **S11 gates anything long-running** (S13 review, S20 bulk import, S22 stats). Features enqueue jobs; they never spawn their own workers.
- **S15 (SRS) gates S17 (openings drill)** — one scheduler, reused.
- **S09 gates S21**: the chat UI is built against `CoachPort` first, providers later. Nothing in the UI knows which provider is in use.
- **S12 gates S28**: live play reuses the same game machine as sparring.
- **S29 runs last** but its budgets are enforced from Wave 3 onward in CI.

---

## 5. Quality bar (every sprint, non-negotiable)

**Architecture**

- Pure domain logic in `src/domain`, `src/chess`, `src/engine` — no React imports, fully unit-tested.
- React components stay thin: data via hooks, no business rules in JSX.
- No feature touches Dexie directly; only repositories.
- Types cover compile time, zod covers run time: every boundary (worker messages, repository writes, CSV/PGN imports, content packs, share links, backups, coach responses) validates through `assertValid` before the data is trusted.
- No `any`, no non-null `!` assertions and no unchecked casts outside tests; `unknown` plus a schema at every entry point.
- Errors are values (`Result`) at boundaries; exceptions only for programmer errors.

**Performance (the "use the whole CPU" rule)**

- Nothing heavier than ~5 ms runs on the main thread. Engine, PGN parsing, analysis, stats aggregation and share-link compression all run in workers.
- Engine work is lane-prioritized (`play` > `interactive` > `batch`) and always cancellable.
- Background jobs yield to input (`isInputPending`), pause when the tab is hidden, and resume after reload.
- Worker count derives from `hardwareConcurrency`; memory from `deviceMemory`; both capped and configurable.
- Budgets in CI: route JS < 200 KB gzip (engine excluded), LCP < 2.0 s, TBT < 150 ms on a mid-tier phone profile.

**Testing**

- Unit tests for every pure module; property tests where inputs are generative (moves, ratings, codecs).
- Component tests for every interactive component; e2e for every user loop (play, solve, review, drill, import, share).
- Golden files for analysis, classification and SRS so behaviour changes are visible in diffs.
- No merge with failing or skipped tests.

**Accessibility & UX**

- Keyboard path through every flow, including the board; visible focus; axe clean.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`.
- Every screen has loading, empty and error states.
- Copy is calm and non-shaming; a mistake is "the idea you missed".

**Hygiene**

- Conventional commits, small PRs, one sprint per PR, no unrelated refactors.
- Public functions documented with a short JSDoc line stating _why_, not _what_.
- No dead code, no commented-out blocks, no leftover TODOs (use issues).

---

## 6. How the multi-agent run works

1. **One sprint = one agent = one git worktree = one PR.** The agent owns only the folders listed for its sprint.
2. **Contract first:** the agent reads `src/domain` and the prototype page(s) it implements, then writes types and tests before UI.
3. **Fixtures over dependencies:** if an upstream feature isn't merged yet, build against the S03 fixture factories and a mock, never against a half-finished branch.
4. **Definition of done** is the sprint's "Done when" plus: tests green, typecheck clean, lint clean, screenshots of the screen(s) in light and dark at 1440/390, and a one-paragraph PR description naming the interfaces it added.
5. **Integration checkpoint after each wave:** one agent merges, runs the full suite, walks every route in both themes, and files follow-ups. No new wave starts before this passes.
6. **Prototype parity:** each feature sprint links its prototype page; a reviewer compares side by side before merge.

---

## 7. Estimated effort

| Wave | Sprints                           | Agents in parallel | Rough agent-days |
| ---- | --------------------------------- | ------------------ | ---------------- |
| 0    | S01                               | 1                  | 0.5              |
| 1    | S02, S03                          | 2                  | 2                |
| 2    | S04–S10                           | 6–7                | 10               |
| 3    | S11, S12, S14, S19, S20           | 5                  | 9                |
| 4    | S13, S15, S16, S17, S18, S22, S23 | 6–7                | 11               |
| 5    | S21, S24, S25, S26, S27           | 5                  | 8                |
| 6    | S28, S29                          | 2                  | 4                |

Sequential wall-clock is roughly the longest sprint in each wave plus integration: about **8–10 working sessions** with a full agent team, versus ~45 agent-days of work.

---

## 8. What is explicitly out of scope for v1

Accounts, servers and databases; a global leaderboard; a rating system shared between users; tournaments; video content; mobile app stores; anything that requires paying for hosting beyond Cloudflare's free tier.
