/**
 * Keeps `public/_headers` honest after a build: every inline <script> in dist/index.html
 * must be allowed by the CSP's `script-src` hash list, and the isolation headers must be
 * present. Run after `npm run build`.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve('dist')
const read = (name) => {
  try {
    return readFileSync(path.join(DIST, name), 'utf8')
  } catch {
    console.error(`dist/${name} is missing. Run the build first.`)
    process.exit(1)
  }
}

const headers = read('_headers')
const html = read('index.html')
const failures = []

for (const required of [
  'Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Embedder-Policy: require-corp',
  "frame-ancestors 'none'",
]) {
  if (!headers.includes(required)) failures.push(`_headers lacks "${required}"`)
}

for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
  const hash = `sha256-${createHash('sha256')
    .update(match[1] ?? '')
    .digest('base64')}`
  if (!headers.includes(`'${hash}'`)) {
    failures.push(`inline script in index.html is not allowed by the CSP; add '${hash}'`)
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL  ${failure}`)
  process.exit(1)
}
console.log('PASS  _headers: isolation headers present, inline scripts hash-allowed')
