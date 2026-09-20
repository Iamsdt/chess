import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
