import { domainError, err, ok, type Result } from '@/domain'

import { type EngineBuildId, engineScriptUrl, engineWasmUrl } from './capabilities'

/**
 * Keeping the engine binaries available offline.
 *
 * The lite builds carry their NNUE inside the `.wasm`, so there is no separate
 * network asset to manage — "NNUE asset loading" for this build is really "make
 * sure the 1.6 MB binary is on the device before the player needs it".
 *
 * This puts both files in a named Cache, which is the half that belongs to the
 * engine. Serving them back from that cache is the service worker's `fetch`
 * handler, which S26 owns: it should read `ENGINE_CACHE_NAME` and answer from it
 * before touching the network.
 */

/** The cache S26's service worker must consult for `/engine/*`. */
export const ENGINE_CACHE_NAME = 'chessking-engine-v1'

export function engineAssetUrls(build: EngineBuildId, baseUrl: string): readonly string[] {
  return [engineScriptUrl(build, baseUrl), engineWasmUrl(build, baseUrl)]
}

/**
 * Download the build's loader and WASM into the cache, skipping what is there.
 *
 * Call it when the app is idle — before the player opens a game, not while they
 * are waiting for a move.
 */
export async function primeEngineAssets(
  build: EngineBuildId,
  baseUrl: string,
): Promise<Result<readonly string[]>> {
  if (typeof caches === 'undefined') {
    return err(domainError('unsupported', 'This browser has no Cache API'))
  }

  const urls = engineAssetUrls(build, baseUrl)
  try {
    const cache = await caches.open(ENGINE_CACHE_NAME)
    for (const url of urls) {
      const hit = await cache.match(url)
      if (hit === undefined) await cache.add(url)
    }
    return ok(urls)
  } catch (cause) {
    return err(
      domainError('io', 'The engine could not be cached for offline use', {
        where: 'engine: primeEngineAssets',
        cause,
      }),
    )
  }
}
