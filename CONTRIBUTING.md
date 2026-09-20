# Contributing to Chess King

Chess King is a free, offline-capable chess _learning_ app. It has no accounts, no server
and no database — Stockfish runs in a worker, everything you do is stored in your own
browser, and the AI coach uses a key you supply yourself.

Work is organised as sprints. Read [docs/sprint-plan.md](docs/sprint-plan.md) before you
start: it says which folder each sprint owns and what "done" means for it.

## Getting set up

```bash
npm install          # Node 20.19+ (22 in CI)
npm run dev          # http://localhost:5173
```

One extra step before you run the end-to-end tests:

```bash
npm run e2e:install  # downloads the Chromium build Playwright drives
npm run e2e
```

## The commands that matter

| Command                 | What it does                                        |
| ----------------------- | --------------------------------------------------- |
| `npm run dev`           | Dev server with hot reload                          |
| `npm run typecheck`     | `tsc -b` across the app and node projects           |
| `npm run lint`          | ESLint, including the layer-boundary rules          |
| `npm run format`        | Prettier, with Tailwind class sorting               |
| `npm test`              | Vitest once                                         |
| `npm run test:watch`    | Vitest in watch mode                                |
| `npm run test:coverage` | Vitest with a coverage report in `coverage/`        |
| `npm run build`         | Typecheck, then the production build                |
| `npm run size`          | Bundle size budget (200 KB JS / 60 KB CSS, gzipped) |
| `npm run e2e`           | Playwright against a preview build                  |
| `npm run validate`      | Everything CI runs, in one go                       |

`npm run validate` is what to run before you open a pull request.

## How the code is organised

Each folder belongs to exactly one sprint, and sprints do not edit each other's folders:

```
src/app/       routes, layout, app shell
src/design/    Grove Bloom tokens, shadcn/ui and project primitives
src/domain/    shared types, zod schemas, fixture factories
src/data/      Dexie schema, migrations, repositories
src/chess/     rules, PGN, ECO, move classification
src/engine/    Stockfish worker pool, UCI
src/board/     the interactive board
src/coach/     the Sage chat panel and its providers
src/content/   content pack schema, loader, registry
src/jobs/      durable job queue and scheduler
src/features/  one folder per feature (play, puzzles, review, …)
```

`src-old/` is the previous JavaScript app, kept for reference during the rebuild. It is
excluded from the build, lint and tests, and nothing new should import from it.

### Layer boundaries

`src/domain`, `src/chess` and `src/engine` are pure: no React, no Zustand, no Dexie, no
imports from UI folders. Features never touch Dexie directly — they go through a
repository in `src/data`. ESLint enforces both rules, so you will find out at lint time
rather than in review.

## The quality bar

These are the rules from §5 of the sprint plan. They apply to every change:

- **Types.** Strict TypeScript, no `any`. Anything crossing a boundary — content packs,
  imports, share links, backups, provider responses — is validated with zod as well.
- **Errors are values.** Return a `Result` at boundaries; throw only for programmer errors.
- **Keep the main thread free.** Nothing heavier than about 5 ms runs on it. The engine,
  PGN parsing, CSV import, analysis and compression all belong in workers.
- **Tests come with the work.** Unit tests for pure modules, property tests where the
  inputs are generative, component tests for interactive components, and an end-to-end
  test for each user loop. Nothing merges with a failing or skipped test.
- **Accessibility.** Every flow works from the keyboard, focus is visible, axe is clean,
  and `prefers-reduced-motion` and `prefers-color-scheme` are respected.
- **Every screen has loading, empty and error states.** Copy stays calm and never shames
  the player — a mistake is "the idea you missed".
- **No dead code**, no commented-out blocks, no leftover TODOs. Open an issue instead.

## Pull requests

One sprint per pull request. Use conventional commits (`feat:`, `fix:`, `chore:`,
`refactor:`, `test:`, `docs:`) and keep unrelated refactors out. A pull request should say
which interfaces it adds, and feature work should include screenshots in light and dark at
1440 px and 390 px.

Husky runs lint-staged on commit, so formatting and lint fixes are applied as you go.

## Third-party content

Puzzles come from the [Lichess open puzzle database](https://database.lichess.org/#puzzles).
Attribution stays with the data: every puzzle keeps its `source` and `lichess_id`, and the
solver links back to the original. If you add a piece set, a sound or any other asset,
record its licence in `docs/licences.md` in the same change.
