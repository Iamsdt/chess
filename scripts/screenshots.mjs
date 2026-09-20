/**
 * Produces the review artefacts the sprint plan asks for in §6.4 — every screen in light
 * and dark at 1440 and 390 — so a reviewer can compare against `prototype/` side by side.
 *
 * These are artefacts, not assertions: they are regenerated on demand and never diffed by
 * CI, so the browser build does not have to match the one CI pins. Run after `npm run build`.
 *
 *   npm run screenshots                 # Playwright's bundled Chromium
 *   PW_CHANNEL=chrome npm run screenshots   # an already-installed Chrome
 */
import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'

/* This file runs in Node, but the `page.evaluate` callback below is serialised and run
   inside the browser, where `document` exists. */
/* global document */

const HOST = '127.0.0.1'
const PORT = '4178'
const BASE_URL = `http://${HOST}:${PORT}`
const OUT_DIR = path.resolve('docs/screenshots')

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
]
const THEMES = ['light', 'dark']
/**
 * A representative screen per layout rather than all 24 routes: one page screen, one board
 * screen and one chat-closed screen exercise every frame the shell has, and the reviewer
 * compares each against the matching file in `prototype/`.
 */
const ROUTES = [
  { name: 'today', path: '/' },
  { name: 'play-setup', path: '/play' },
  { name: 'puzzles', path: '/puzzles' },
  { name: 'puzzle-solve', path: '/puzzles/solve' },
  { name: 'learn', path: '/learn' },
  { name: 'mistakes', path: '/mistakes' },
  { name: 'games', path: '/games' },
  { name: 'review', path: '/games/review' },
  { name: 'analysis', path: '/analysis' },
  { name: 'progress', path: '/progress' },
  { name: 'settings', path: '/settings' },
  { name: 'onboarding', path: '/onboarding' },
  { name: 'kitchen-sink', path: '/dev/kitchen-sink' },
]

/** Resolves once the preview server answers, so we never screenshot a blank page. */
async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Preview server never came up at ${url}`)
}

const preview = spawn(
  'npm',
  ['run', 'preview', '--', '--host', HOST, '--port', PORT, '--strictPort'],
  { stdio: 'ignore' },
)

let browser
try {
  await waitForServer(BASE_URL)

  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const channel = process.env.PW_CHANNEL
  browser = await chromium.launch(channel ? { channel } : {})

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
        colorScheme: theme,
      })
      // The app reads its own persisted choice, so seed it rather than clicking through.
      await context.addInitScript((value) => {
        localStorage.setItem('ck-theme', value)
      }, theme)

      const page = await context.newPage()
      for (const route of ROUTES) {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' })
        // Webfonts swap in late; a screenshot taken before they land is misleading.
        await page.evaluate(() => document.fonts.ready)

        const file = path.join(OUT_DIR, `${route.name}-${theme}-${viewport.name}.png`)
        await page.screenshot({ path: file, fullPage: true })
        console.log(`wrote ${path.relative(process.cwd(), file)}`)
      }
      await context.close()
    }
  }
} finally {
  await browser?.close()
  preview.kill()
}
