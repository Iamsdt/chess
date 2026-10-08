# PWA and offline

Chess King installs as an app and, after one visit, runs with no network: play, puzzles,
lessons, review and analysis. Code lives in `src/pwa/`; the worker is bundled by the plugin in
`vite.config.ts`.

## How it works

- **Precache.** At build time the plugin walks `dist/`, merges Vite's manifest with the public
  folders (`engine/`, `pieces/`, `tutorial/`, `quiz/`, `icons/`) and bakes the list into `sw.js`
  (`precache.ts`). `core` files must all cache or the install fails. `heavy` files (Stockfish
  binaries, puzzle CSVs) may fail; the next install or first use fills them in.
- **Versioning.** The precache cache is named after a hash of every file and revision, so any
  deploy gives a byte-different `sw.js`. Unchanged files are copied from the previous cache
  instead of downloaded.
- **Routing** (`sw-routing.ts`). Navigations get the cached shell, static folders are cache-first,
  other same-origin GETs are network-first with a cache fallback, Google Fonts are
  stale-while-revalidate. Everything else, including every API call (Lichess, Chess.com, coach
  providers), bypasses the worker so keys and user content are never stored.
- **Cross-origin isolation.** Multi-thread Stockfish needs COOP/COEP on the document. Every
  response the worker replays gets those headers stamped on, so offline never silently falls
  back to the single-thread engine. Cache lookups use `ignoreVary` because hosts send
  `Vary: Origin`, which would otherwise miss every module script.
- **Production only.** `registerServiceWorker` does nothing outside `import.meta.env.PROD`, so
  `npm run dev` never serves stale modules.

## Updates

A new worker installs and then waits. The page shows "A new version is ready"; pressing Reload
sends `SKIP_WAITING`, and the page reloads when the new worker takes control. Nothing swaps
mid-game on its own. The first install shows "Ready to work offline" and never reloads.
The state machine is `update-flow.ts`. The browser re-checks for a new `sw.js` hourly and
whenever the tab becomes visible.

## Offline indicators

`PwaRuntime` shows a pill while `navigator.onLine` is false. `OnlineOnlyNotice` marks features
that need a network: the opening explorer and the Lichess and Chess.com imports. PGN paste and
file import work offline. The coach is deferred and has no notice yet.

## Install

Chromium fires `beforeinstallprompt`; `useInstallPrompt` holds it and the app offers an Install
toast once. Declining is remembered in `localStorage` (`ck-install-dismissed`).

## iOS and Safari quirks

- No `beforeinstallprompt`. Users must choose Share, then Add to Home Screen. `useInstallPrompt`
  exposes `showIosHint` for that case. iPadOS reports itself as a Mac, so touch support is the
  tell.
- Apple ignores the manifest icons and uses `apple-touch-icon.png` (180 px, no transparency).
- Standalone mode is detected with `navigator.standalone`, not only `display-mode`.
- Safari evicts script-writable storage (IndexedDB, caches, service workers) after about seven
  days without use unless the app is added to the Home Screen. Back up from Settings.
- Storage quota is smaller than on desktop. The engine binaries are the largest cache entries.
- `SharedArrayBuffer` needs COOP/COEP on iOS too; without them the single-thread engine is used.
- Background tabs are suspended, so the hourly update check may only run when the app returns to the foreground.
- Phones are turned away by the desktop-only gate, so installing on iPhone is mostly moot; iPad
  is the realistic target.

## Testing

- Unit: `npx vitest run src/pwa` (precache list, routing, update state machine, hooks).
- E2E: `npm run build` then `npx playwright test e2e/offline.spec.ts`. The suite blocks service
  workers by default; the offline spec opts back in and runs serially because the update test
  rewrites `dist/sw.js` (set `PW_DIST` if the build goes elsewhere).
