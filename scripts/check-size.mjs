/**
 * Size budget gate (§5). Fails the build when the entry JS outgrows its budget,
 * so a heavy dependency is caught in the PR that adds it rather than at release.
 * Engine WASM and puzzle CSVs are static assets, not app code, so they are excluded.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGETS_KB = { js: 200, css: 60 }
const ASSET_DIR = path.resolve('dist/assets')

const totals = { js: 0, css: 0 }
for (const file of readdirSync(ASSET_DIR)) {
  const ext = path.extname(file).slice(1)
  if (!(ext in totals)) continue
  totals[ext] += gzipSync(readFileSync(path.join(ASSET_DIR, file))).byteLength
}

let failed = false
for (const [ext, budgetKb] of Object.entries(BUDGETS_KB)) {
  const actualKb = totals[ext] / 1024
  const ok = actualKb <= budgetKb
  if (!ok) failed = true
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${ext.toUpperCase().padEnd(4)} ${actualKb.toFixed(1)} KB gzip / ${budgetKb} KB budget`,
  )
}

if (failed) {
  console.error('\nBundle size budget exceeded. Trim the import or raise the budget deliberately.')
  process.exit(1)
}
