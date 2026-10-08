/**
 * Which files the service worker keeps on the device, and under what version.
 *
 * Why this is a pure function over a file list: the build plugin only has to walk `dist/`
 * and hash bytes, while the rules — what is worth precaching, what must succeed, what may
 * fail — are decided here where a unit test can pin them. It must stay free of DOM and
 * Node imports because `vite.config.ts` and the build both import it.
 */

/** A built file: its path relative to the output directory (POSIX) and a content hash. */
export interface BuildFile {
  readonly path: string
  readonly revision: string
}

/** The subset of Vite's `manifest.json` chunk record the precache list reads. */
export interface ViteManifestChunk {
  readonly file: string
  readonly css?: readonly string[]
  readonly assets?: readonly string[]
}

/**
 * `core` entries must all be cached or the install fails — the app cannot run offline
 * without them. `heavy` entries (engine binaries, puzzle CSVs) are tolerated: a flaky
 * connection must not stop the shell installing, and runtime caching fills them later.
 */
export type PrecacheGroup = 'core' | 'heavy'

export interface PrecacheEntry {
  /** Relative to the service worker's scope, so a sub-path deploy keeps working. */
  readonly url: string
  readonly revision: string
  readonly group: PrecacheGroup
}

export interface PrecacheManifest {
  /** Changes whenever any entry does; it names the cache and makes `sw.js` byte-different. */
  readonly version: string
  readonly entries: readonly PrecacheEntry[]
}

/** What a deploy ships that is worth keeping offline. Everything else stays network-only. */
const INCLUDE: readonly RegExp[] = [
  /^index\.html$/,
  /^assets\/.+/,
  /^engine\/.+/,
  /^pieces\/.+/,
  /^tutorial\/.+/,
  /^quiz\/.+/,
  /^icons\/.+/,
  /^manifest\.webmanifest$/,
]

/** Never precached: debugging aids, licence text, retired builds and the worker itself. */
const EXCLUDE: readonly RegExp[] = [
  /\.map$/,
  /^\.vite\//,
  /^engine\/Copying\.txt$/,
  /^sw\.js$/,
  /^quiz-old\//,
]

const HEAVY: readonly RegExp[] = [/^engine\//, /^quiz\/.+\.csv$/]

export function isPrecached(path: string): boolean {
  return INCLUDE.some((rule) => rule.test(path)) && !EXCLUDE.some((rule) => rule.test(path))
}

/** cyrb53: a small, dependency-free 53-bit hash — plenty to tell two deploys apart. */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * Builds the precache list from the build output.
 *
 * The Vite manifest is the authority for what the bundler emitted (every chunk, its CSS and
 * its assets, lazy ones included — an offline route is a route whose chunk is on disk). A
 * manifest file missing from the output is a broken build and throws, rather than shipping
 * a worker whose install can never succeed.
 */
export function createPrecacheManifest(
  files: readonly BuildFile[],
  viteManifest: Readonly<Record<string, ViteManifestChunk>> = {},
): PrecacheManifest {
  const revisions = new Map(files.map((file) => [file.path, file.revision]))

  const wanted = new Set<string>()
  for (const file of files) if (isPrecached(file.path)) wanted.add(file.path)

  for (const chunk of Object.values(viteManifest)) {
    for (const path of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
      if (!revisions.has(path))
        throw new Error(`Vite manifest names ${path}, which is not in the build output`)
      if (!EXCLUDE.some((rule) => rule.test(path))) wanted.add(path)
    }
  }

  const entries = [...wanted]
    .sort((a, b) => a.localeCompare(b))
    .map((path): PrecacheEntry => {
      const revision = revisions.get(path)
      if (revision === undefined) throw new Error(`No revision for ${path}`)
      return {
        url: path,
        revision,
        group: HEAVY.some((rule) => rule.test(path)) ? 'heavy' : 'core',
      }
    })

  const version = hashString(entries.map((entry) => `${entry.url}@${entry.revision}`).join('\n'))
  return { version, entries }
}
