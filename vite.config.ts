import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { build as viteBuild, defineConfig, type Plugin } from 'vite'

import { createPrecacheManifest, type BuildFile, type ViteManifestChunk } from './src/pwa/precache'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

function listFiles(directory: string, root: string = directory): BuildFile[] {
  return readdirSync(directory).flatMap((name): BuildFile[] => {
    const full = path.join(directory, name)
    if (statSync(full).isDirectory()) return listFiles(full, root)
    const revision = createHash('sha1').update(readFileSync(full)).digest('hex').slice(0, 16)
    return [{ path: path.relative(root, full).split(path.sep).join('/'), revision }]
  })
}

/**
 * Emits `sw.js` after the app build: walks `dist/`, turns Vite's manifest plus the public
 * files into the precache list (`src/pwa/precache.ts`), and bundles the worker with that
 * list baked in. Doing it in `closeBundle` means every hashed chunk already exists.
 */
function serviceWorkerPlugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'chess-king:service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      const viteManifest = JSON.parse(
        readFileSync(path.join(outDir, '.vite/manifest.json'), 'utf8'),
      ) as Record<string, ViteManifestChunk>
      const manifest = createPrecacheManifest(listFiles(outDir), viteManifest)
      await viteBuild({
        configFile: false,
        publicDir: false,
        logLevel: 'warn',
        define: { __PRECACHE_MANIFEST__: JSON.stringify(manifest) },
        build: {
          outDir,
          emptyOutDir: false,
          copyPublicDir: false,
          sourcemap: false,
          target: 'es2022',
          lib: {
            entry: path.resolve(rootDir, 'src/pwa/sw/service-worker.ts'),
            formats: ['iife'],
            name: 'ChessKingServiceWorker',
            fileName: () => 'sw.js',
          },
        },
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorkerPlugin()],
  resolve: {
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  // Cross-origin isolation, which `SharedArrayBuffer` — and so multi-threaded Stockfish
  // — requires. Preview needs it too, or the e2e run silently tests the fallback engine.
  server: { port: 5173, headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  build: {
    target: 'es2022',
    sourcemap: true,
    // The size gate needs the module graph to tell an initial chunk from a lazy one.
    manifest: true,
  },
})
