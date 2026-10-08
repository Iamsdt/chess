/**
 * Size budget gate (§5): "route JS < 200 KB gzip (engine excluded)".
 *
 * That means what a visitor downloads before the first screen is usable — the entry chunk
 * plus everything it imports statically. It deliberately does NOT mean the sum of `dist/`:
 * a lazily-loaded route, the engine worker and the CSV worker are all fetched on demand,
 * and counting them would punish the code-splitting the budget exists to encourage.
 *
 * Reads Vite's build manifest so the initial graph is read from the bundler rather than
 * guessed from filenames. Run after `npm run build`.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGETS_KB = { js: 200, css: 60 }
/**
 * Per-route budget (S29): the JS a route adds on top of the shell, i.e. its own chunk and
 * the shared chunks only it pulls in. The shell itself is held to `BUDGETS_KB.js` above, so
 * a first visit to any route is bounded by the sum of the two.
 */
const ROUTE_BUDGET_KB = 200
/** Lazy entries that are routes. Workers, the engine and shell slots load on demand. */
const ROUTE_ENTRY = /^src\/features\//
const DIST = path.resolve('dist')
const MANIFEST = path.join(DIST, '.vite/manifest.json')

/** @type {Record<string, { file: string, isEntry?: boolean, isDynamicEntry?: boolean, imports?: string[], css?: string[] }>} */
let manifest
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
} catch {
  console.error(
    `No build manifest at ${path.relative(process.cwd(), MANIFEST)}. Run the build first.`,
  )
  process.exit(1)
}

const entries = Object.keys(manifest).filter((key) => manifest[key]?.isEntry)
if (entries.length === 0) {
  console.error('Build manifest names no entry chunk; cannot measure the initial download.')
  process.exit(1)
}

/** Walks static `imports` only — `dynamicImports` are, by definition, not initial. */
const initial = new Set()
const visit = (key) => {
  if (initial.has(key)) return
  const chunk = manifest[key]
  if (!chunk) return
  initial.add(key)
  for (const next of chunk.imports ?? []) visit(next)
}
for (const entry of entries) visit(entry)

const files = new Set()
for (const key of initial) {
  const chunk = manifest[key]
  if (!chunk) continue
  files.add(chunk.file)
  for (const css of chunk.css ?? []) files.add(css)
}

const totals = { js: 0, css: 0 }
for (const file of files) {
  const ext = path.extname(file).slice(1)
  if (!(ext in totals)) continue
  totals[ext] += gzipSync(readFileSync(path.join(DIST, file))).byteLength
}

const gzipKb = (file) => gzipSync(readFileSync(path.join(DIST, file))).byteLength / 1024

let failed = false

/**
 * Per route: every chunk the route's static import graph adds beyond the initial download. Engine chunks are excluded as the budget says, though in practice the
 * engine is a worker and never appears in a route's static graph.
 */
const routeKeys = Object.keys(manifest).filter(
  (key) => manifest[key]?.isDynamicEntry === true && ROUTE_ENTRY.test(key) && !initial.has(key),
)
const initialJs = [...files].filter((file) => file.endsWith('.js'))
const initialJsKb = initialJs.reduce((sum, file) => sum + gzipKb(file), 0)
for (const key of routeKeys) {
  const own = new Set()
  const walk = (next) => {
    if (initial.has(next) || own.has(next) || next.startsWith('src/engine/')) return
    const chunk = manifest[next]
    if (!chunk) return
    own.add(next)
    for (const dep of chunk.imports ?? []) walk(dep)
  }
  walk(key)
  const extraKb = [...own].reduce((sum, k) => sum + gzipKb(manifest[k].file), 0)
  const ok = extraKb <= ROUTE_BUDGET_KB
  if (!ok) failed = true
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ROUTE ${key.padEnd(34)} ${extraKb.toFixed(1)} KB gzip / ${ROUTE_BUDGET_KB} KB budget` +
      `  (first visit ${(initialJsKb + extraKb).toFixed(1)} KB with the shell)`,
  )
}

for (const [ext, budgetKb] of Object.entries(BUDGETS_KB)) {
  const actualKb = totals[ext] / 1024
  const ok = actualKb <= budgetKb
  if (!ok) failed = true
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${ext.toUpperCase().padEnd(4)} ${actualKb.toFixed(1)} KB gzip / ${budgetKb} KB budget` +
      `  (${String(initial.size)} initial chunk${initial.size === 1 ? '' : 's'})`,
  )
}

if (failed) {
  console.error('\nInitial download exceeds its budget. Split the route, defer the import,')
  console.error('or raise the budget deliberately — do not widen what the gate measures.')
  process.exit(1)
}
