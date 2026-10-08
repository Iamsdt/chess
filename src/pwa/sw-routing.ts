import { type PrecacheEntry } from './precache'

/**
 * The service worker's decisions, kept apart from its event wiring so they can be tested
 * without a worker: which strategy a request gets, what an install has to fetch, which
 * caches an activation deletes, and how a cached response keeps the page cross-origin
 * isolated.
 */

export const PRECACHE_PREFIX = 'ck-precache-'
export const RUNTIME_CACHE = 'ck-runtime-v1'
/** Holds `{ cacheName, revisions }` for the last good install, so unchanged files are reused. */
export const META_CACHE = 'ck-meta'
export const META_KEY = '/__ck_install__'
export const SKIP_WAITING_MESSAGE = 'SKIP_WAITING'

export const precacheCacheName = (version: string): string => `${PRECACHE_PREFIX}${version}`

export type Strategy =
  'bypass' | 'navigate' | 'cache-first' | 'stale-while-revalidate' | 'network-first'

export interface RouteInput {
  readonly url: URL
  readonly method: string
  readonly mode: RequestMode
  readonly hasRange: boolean
  /** The worker's scope as a URL, e.g. `https://chess.example/`. */
  readonly scope: URL
}

/** Font hosts the stylesheet pulls from; the only cross-origin responses worth keeping. */
const FONT_HOSTS: ReadonlySet<string> = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

/** Folders of static content a deploy ships; fetched once, then served from the device. */
const STATIC_PREFIXES = ['assets/', 'engine/', 'pieces/', 'tutorial/', 'quiz/', 'icons/']

/**
 * Chooses how to answer a request.
 *
 * Why API traffic is `bypass`: coach and import calls carry API keys and user content, so
 * they must never be stored by a worker, and a stale answer would be worse than none.
 */
export function chooseStrategy(input: RouteInput): Strategy {
  const { url, method, mode, hasRange, scope } = input
  if (method !== 'GET' || hasRange) return 'bypass'

  if (url.origin !== scope.origin)
    return FONT_HOSTS.has(url.hostname) ? 'stale-while-revalidate' : 'bypass'

  if (mode === 'navigate') return 'navigate'

  const relative = url.pathname.startsWith(scope.pathname)
    ? url.pathname.slice(scope.pathname.length)
    : url.pathname.replace(/^\//, '')
  if (relative === 'sw.js') return 'bypass'
  if (
    STATIC_PREFIXES.some((prefix) => relative.startsWith(prefix)) ||
    relative === 'manifest.webmanifest'
  ) {
    return 'cache-first'
  }
  return 'network-first'
}

export interface InstallRecord {
  readonly cacheName: string
  readonly revisions: Readonly<Record<string, string>>
}

export interface InstallPlan {
  /** Same revision as the last install: copy from the old cache instead of downloading. */
  readonly reuse: readonly PrecacheEntry[]
  readonly fetch: readonly PrecacheEntry[]
}

/** Splits entries into "already on the device, unchanged" and "needs the network". */
export function planInstall(
  entries: readonly PrecacheEntry[],
  previous: InstallRecord | null,
): InstallPlan {
  const reuse: PrecacheEntry[] = []
  const fetch: PrecacheEntry[] = []
  for (const entry of entries) {
    if (previous?.revisions[entry.url] === entry.revision) reuse.push(entry)
    else fetch.push(entry)
  }
  return { reuse, fetch }
}

/** Caches an activation deletes: older precache versions, never the engine's or runtime. */
export function staleCacheNames(names: readonly string[], currentVersion: string): string[] {
  const current = precacheCacheName(currentVersion)
  return names.filter((name) => name.startsWith(PRECACHE_PREFIX) && name !== current)
}

const ISOLATION_HEADERS: Readonly<Record<string, string>> = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

/**
 * Makes a same-origin response carry COOP/COEP.
 *
 * Why: multi-threaded Stockfish needs `SharedArrayBuffer`, which needs cross-origin
 * isolation, and that is decided by the headers on the *document*. A response replayed from
 * a cache keeps whatever headers it was stored with, which may predate the headers file or
 * come from a host that never set them. Stamping them here means offline never silently
 * downgrades to the single-threaded engine.
 */
export function withIsolationHeaders(response: Response): Response {
  if (response.type === 'opaque' || response.status === 0) return response
  const missing = Object.entries(ISOLATION_HEADERS).filter(
    ([name, value]) => response.headers.get(name) !== value,
  )
  if (missing.length === 0) return response

  const headers = new Headers(response.headers)
  for (const [name, value] of missing) headers.set(name, value)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
