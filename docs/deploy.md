# Deploying Chess King

## Why Cloudflare

Multi-threaded Stockfish needs `SharedArrayBuffer`, which browsers only expose to
cross-origin-isolated pages: the document must be served with
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.
`public/_headers` sets both, plus the CSP. Cloudflare applies `_headers` to static assets.
**GitHub Pages cannot send custom headers**, so on Pages `crossOriginIsolated` is false and
`src/engine/capabilities.ts` selects the single-threaded Stockfish build. Everything works
there, only slower. The Pages workflow (`.github/workflows/deploy.yml`) is kept as a fallback.

## One-time setup (needs a human)

1. Create a Cloudflare API token with the **Edit Cloudflare Workers** template
   (Account: Workers Scripts: Edit).
2. Add repository secrets (Settings, Secrets and variables, Actions):
   - `CLOUDFLARE_API_TOKEN` - the token above.
   - `CLOUDFLARE_ACCOUNT_ID` - from the Cloudflare dashboard sidebar.
3. Add the repository variable `PRODUCTION_URL` (for example
   `https://chess-king.<your-subdomain>.workers.dev`, or your custom domain). The production
   smoke test reads it.
4. Create a `production` environment in GitHub if you want approvals on production deploys
   (the job references it; GitHub creates an empty one on first run).
5. Merge to `main` once. The first `wrangler deploy` creates the Worker named in
   `wrangler.jsonc`; PR previews (`wrangler versions upload`) only work after that.

Nothing in the repo contains a secret. The workflows read them from `secrets.*` only.

## What runs

| Event                    | Workflow                | Result                                                                      |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------- |
| Push to `main`           | `deploy-cloudflare.yml` | Build, header and size gates, `wrangler deploy`, smoke test                 |
| Pull request (same repo) | `deploy-cloudflare.yml` | Preview version at alias `pr-<number>`, smoke test, URL commented on the PR |
| Push to `main`           | `deploy.yml`            | GitHub Pages fallback                                                       |
| Push / PR                | `ci.yml`                | Typecheck, lint, tests + coverage, axe, size, headers, Lighthouse, e2e      |

Fork PRs get no secrets, so they are built by CI but not deployed.

## Smoke test

`scripts/smoke-deploy.sh <url>` checks that `/` answers 200 (retrying while a deploy
propagates), that COOP, COEP and the CSP headers are present, that the app shell is served,
and that the manifest, `sw.js` and the engine WASM answer 200. Run it by hand against any
URL.

## Local check of the production headers

```bash
npm run build
node scripts/check-headers.mjs        # headers present, inline script hash matches the CSP
node scripts/serve-dist.mjs 4173      # dist/ with the real headers and compression
```

`npm run dev` and `npm run preview` send COOP/COEP from `vite.config.ts` but not the CSP, so
use `serve-dist.mjs` to reproduce a CSP problem.

## Changing the CSP

`public/_headers` documents each directive. Two things to remember:

- The inline theme script in `index.html` is allowed by hash. If you edit it,
  `scripts/check-headers.mjs` prints the new hash to paste into `_headers`.
- `connect-src` lists the exact external APIs (lichess.org, explorer.lichess.ovh,
  api.chess.com). It is deliberately not `https:`. The bring-your-own-key coach needs
  user-chosen endpoints, so widen `connect-src` in the PR that ships it, and say why.
