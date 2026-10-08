import { type PrecacheEntry, type PrecacheManifest } from '../precache'
import {
  chooseStrategy,
  type InstallRecord,
  META_CACHE,
  META_KEY,
  planInstall,
  precacheCacheName,
  RUNTIME_CACHE,
  SKIP_WAITING_MESSAGE,
  staleCacheNames,
  type Strategy,
  withIsolationHeaders,
} from '../sw-routing'

/**
 * The service worker. Built separately by the PWA plugin in `vite.config.ts`, which
 * substitutes the precache manifest for this one global — that is also what makes `sw.js`
 * byte-different on every deploy, and so what lets the browser notice an update.
 *
 * Updates are opt-in: a new worker installs and then waits. The page shows "update ready"
 * and sends SKIP_WAITING when the player agrees, so a reload never swaps code mid-game.
 */
declare const __PRECACHE_MANIFEST__: PrecacheManifest

const worker = self as unknown as ServiceWorkerGlobalScope
const manifest = __PRECACHE_MANIFEST__
const scope = new URL(worker.registration.scope)
const cacheName = precacheCacheName(manifest.version)
const resolve = (relative: string): string => new URL(relative, scope).href
const SHELL_URL = resolve('index.html')

async function readInstallRecord(): Promise<InstallRecord | null> {
  const meta = await caches.open(META_CACHE)
  const hit = await meta.match(META_KEY)
  if (hit === undefined) return null
  const record = (await hit.json()) as InstallRecord
  return record
}

async function writeInstallRecord(record: InstallRecord): Promise<void> {
  const meta = await caches.open(META_CACHE)
  await meta.put(META_KEY, Response.json(record))
}

async function precache(): Promise<void> {
  const cache = await caches.open(cacheName)
  const previous = await readInstallRecord()
  const plan = planInstall(manifest.entries, previous)
  const stored: Record<string, string> = {}

  const previousCache = previous === null ? undefined : await caches.open(previous.cacheName)
  const download = async (entry: PrecacheEntry): Promise<void> => {
    // `reload` skips the HTTP cache: a stale copy under a new revision would defeat the version.
    const response = await fetch(new Request(resolve(entry.url), { cache: 'reload' }))
    if (!response.ok) throw new Error(`${entry.url}: ${String(response.status)}`)
    await cache.put(resolve(entry.url), response)
    stored[entry.url] = entry.revision
  }

  for (const entry of plan.reuse) {
    const hit = await previousCache?.match(resolve(entry.url))
    if (hit === undefined) {
      await download(entry)
    } else {
      await cache.put(resolve(entry.url), hit)
      stored[entry.url] = entry.revision
    }
  }

  const core = plan.fetch.filter((entry) => entry.group === 'core')
  const heavy = plan.fetch.filter((entry) => entry.group === 'heavy')
  await Promise.all(core.map(download))
  // A failed heavy file is not recorded, so the next install retries it; meanwhile the
  // runtime rule caches it the first time it is used.
  await Promise.allSettled(heavy.map(download))

  await writeInstallRecord({ cacheName, revisions: stored })
}

async function activate(): Promise<void> {
  const names = await caches.keys()
  await Promise.all(staleCacheNames(names, manifest.version).map((name) => caches.delete(name)))
  await worker.clients.claim()
}

/**
 * `ignoreVary`: static hosts send `Vary: Origin`, and a page's module-script request carries
 * an `Origin` header the precache fetch did not, so a strict match would miss every chunk.
 */
const MATCH: CacheQueryOptions = { ignoreVary: true }

async function remember(request: Request, response: Response): Promise<void> {
  if (!response.ok || response.status !== 200) return
  const cache = await caches.open(RUNTIME_CACHE)
  await cache.put(request, response)
}

async function handle(
  strategy: Exclude<Strategy, 'bypass'>,
  request: Request,
  keepAlive: (work: Promise<unknown>) => void,
): Promise<Response> {
  if (strategy === 'navigate') {
    const shell = await caches.match(SHELL_URL, MATCH)
    return withIsolationHeaders(shell ?? (await fetch(request)))
  }

  if (strategy === 'network-first') {
    try {
      const fresh = await fetch(request)
      keepAlive(remember(request, fresh.clone()))
      return withIsolationHeaders(fresh)
    } catch {
      const cached = await caches.match(request, MATCH)
      return cached === undefined
        ? new Response('Offline', { status: 503, statusText: 'Offline' })
        : withIsolationHeaders(cached)
    }
  }

  const cached = await caches.match(request, MATCH)
  if (strategy === 'stale-while-revalidate') {
    const refresh = fetch(request).then(async (fresh) => {
      await remember(request, fresh.clone())
      return fresh
    })
    if (cached !== undefined) {
      keepAlive(refresh.catch(() => undefined))
      return cached
    }
    return refresh
  }

  // cache-first
  if (cached !== undefined) return withIsolationHeaders(cached)
  const fresh = await fetch(request)
  keepAlive(remember(request, fresh.clone()))
  return withIsolationHeaders(fresh)
}

worker.addEventListener('install', (event) => {
  event.waitUntil(precache())
})

worker.addEventListener('activate', (event) => {
  event.waitUntil(activate())
})

worker.addEventListener('message', (event) => {
  const data: unknown = event.data
  if (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === SKIP_WAITING_MESSAGE
  ) {
    void worker.skipWaiting()
  }
})

worker.addEventListener('fetch', (event) => {
  const { request } = event
  const strategy = chooseStrategy({
    url: new URL(request.url),
    method: request.method,
    mode: request.mode,
    hasRange: request.headers.has('range'),
    scope,
  })
  if (strategy === 'bypass') return
  event.respondWith(
    handle(strategy, request, (work) => {
      event.waitUntil(work)
    }),
  )
})
