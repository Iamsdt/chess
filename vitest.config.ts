import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src-old/**', 'e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/**/index.ts'],
      // S29 gate: the pure-logic layers every feature stands on. Each floor sits just under
      // the measured value (domain 91/90/74/86, chess 94/97/97/85, engine 84/88/82/79 for
      // statements/lines/functions/branches) so a real regression trips it and noise does
      // not. Raise them when coverage rises; never lower one to make a PR pass.
      thresholds: {
        'src/domain/**': { statements: 88, lines: 87, functions: 70, branches: 83 },
        'src/chess/**': { statements: 91, lines: 94, functions: 94, branches: 82 },
        'src/engine/**': { statements: 81, lines: 85, functions: 79, branches: 75 },
      },
    },
  },
})
