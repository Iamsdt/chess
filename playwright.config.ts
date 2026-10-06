import { defineConfig, devices } from '@playwright/test'

const HOST = '127.0.0.1'
const PORT = '4173'
const baseURL = `http://${HOST}:${PORT}`

/**
 * Lets a contributor reuse an already-installed browser (`PW_CHANNEL=chrome`) instead of
 * downloading Playwright's bundled one. CI leaves it unset so every run — and every
 * screenshot baseline — comes from the pinned Chromium build.
 */
const channel = process.env.PW_CHANNEL
const channelOption = channel ? { channel } : {}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // exactOptionalPropertyTypes: omit the key rather than pass `undefined`.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Every spec starts as a returning visitor: a brand-new browser is sent to first-run
    // setup once, which is covered by its own spec rather than by every other one.
    storageState: {
      cookies: [],
      origins: [{ origin: baseURL, localStorage: [{ name: 'ck-setup-prompted', value: '1' }] }],
    },
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        ...channelOption,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      // Phones are turned away by the desktop-only gate, so the smallest width the app
      // supports is a tablet. Touch and a mobile user agent stay on, as they would be.
      name: 'tablet',
      use: { ...devices['Pixel 7'], ...channelOption, viewport: { width: 820, height: 1180 } },
    },
  ],
  webServer: {
    // Bind the host explicitly: `vite preview` defaults to `localhost`, which resolves to
    // `::1` alone on some machines, so polling `127.0.0.1` would hang until the timeout.
    command: `npm run preview -- --host ${HOST} --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
