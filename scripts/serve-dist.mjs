/**
 * Serves `dist/` the way the production host does: the `/*` block of `dist/_headers`
 * (COOP/COEP/CSP) on every response, brotli/gzip compression, SPA fallback to index.html.
 *
 * Why not `vite preview`: it sends no compression, so Lighthouse would time 600 KB of raw
 * JavaScript over a throttled link and report a loading time no visitor sees. Using the real
 * headers also means the Lighthouse run fails on a CSP violation that breaks the page.
 *
 * Usage: node scripts/serve-dist.mjs [port]   (after `npm run build`)
 */
import { readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const DIST = path.resolve('dist')
const PORT = Number(process.argv[2] ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.csv': 'text/csv; charset=utf-8',
  '.wasm': 'application/wasm',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.csv'])

/** Headers from the first `/*` block of `_headers`. */
function globalHeaders() {
  const lines = readFileSync(path.join(DIST, '_headers'), 'utf8').split('\n')
  const headers = {}
  for (const line of lines.slice(lines.indexOf('/*') + 1)) {
    if (!line.startsWith('  ')) break
    const [name, ...value] = line.trim().split(': ')
    if (name) headers[name] = value.join(': ')
  }
  return headers
}

const headers = globalHeaders()
/** @type {Map<string, Buffer>} */
const cache = new Map()

function resolveFile(urlPath) {
  const candidate = path.join(DIST, path.normalize(decodeURIComponent(urlPath)))
  if (!candidate.startsWith(DIST)) return path.join(DIST, 'index.html')
  try {
    if (statSync(candidate).isFile()) return candidate
  } catch {
    // Unknown path: a client-side route, so hand back the shell.
  }
  return path.join(DIST, 'index.html')
}

createServer((request, response) => {
  const file = resolveFile((request.url ?? '/').split('?')[0] ?? '/')
  const ext = path.extname(file)
  let body = readFileSync(file)
  const out = { ...headers, 'Content-Type': TYPES[ext] ?? 'application/octet-stream' }
  if (COMPRESSIBLE.has(ext)) {
    const accept = String(request.headers['accept-encoding'] ?? '')
    const encoding = accept.includes('br') ? 'br' : accept.includes('gzip') ? 'gzip' : null
    if (encoding !== null) {
      const key = `${encoding}:${file}`
      let packed = cache.get(key)
      if (packed === undefined) {
        packed = encoding === 'br' ? brotliCompressSync(body) : gzipSync(body)
        cache.set(key, packed)
      }
      body = packed
      out['Content-Encoding'] = encoding
      out['Vary'] = 'Accept-Encoding'
    }
  }
  response.writeHead(200, out)
  response.end(body)
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Serving dist/ on http://127.0.0.1:${String(PORT)} (Local)`)
})
