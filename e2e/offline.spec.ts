import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/**
 * S26's merge gate: after one visit, airplane mode still allows play, puzzles and analysis.
 *
 * The service worker only registers in the production build, which is what the preview
 * server serves. The suite-wide `serviceWorkers: 'block'` exists so other specs can mock
 * the network, so this file opts back in. Desktop only: the worker is the same on every
 * viewport and one project keeps the cache state of each test unambiguous.
 */
test.use({ serviceWorkers: 'allow' })
// One worker, in order: the update test rewrites `sw.js` on disk, which must not race the rest.
test.describe.configure({ mode: 'serial' })
test.skip(({ isMobile }) => isMobile, 'The service worker is viewport independent')

/** Resolves once a worker controls the page, i.e. the shell is cached and served from it. */
async function waitForControl(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (navigator.serviceWorker.controller === null) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          resolve()
        })
      })
    }
  })
  // The engine and puzzle CSVs are the slow part of the install; wait for the record.
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const meta = await caches.open('ck-meta')
        return (await meta.match('/__ck_install__')) !== undefined
      }),
    )
    .toBe(true)
}

async function goOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true)
}

test.describe('offline', () => {
  test('play, puzzles and analysis load with the network gone', async ({ page, context }) => {
    await waitForControl(page)
    await goOffline(context)

    await page.goto('/play')
    await expect(page.getByRole('heading', { level: 1, name: 'New game' })).toBeVisible()
    await page.getByRole('radio', { name: /^White/ }).check({ force: true })
    await page.getByRole('radio', { name: 'Untimed' }).check({ force: true })
    await page.getByRole('button', { name: /Start game/ }).click()
    await expect(page.getByRole('grid', { name: 'Sparring board' })).toBeVisible()
    await page.locator('[data-square="e2"]').click()
    await page.locator('[data-square="e4"]').click()
    await expect(page.getByRole('list', { name: 'Moves played' })).toContainText('e4')

    await page.goto('/puzzles')
    await expect(page.getByRole('heading', { level: 1, name: 'Puzzles' })).toBeVisible()

    await page.goto('/analysis')
    await expect(page.getByRole('heading', { level: 1, name: 'Analysis' })).toBeVisible()
    await expect(page.locator('[data-square="e4"]').first()).toBeVisible()
  })

  test('the offline pill appears and clears with the connection', async ({ page, context }) => {
    await waitForControl(page)
    await page.goto('/analysis')
    await expect(page.getByRole('heading', { level: 1, name: 'Analysis' })).toBeVisible()
    await expect(page.getByText(/Offline: play, puzzles/)).toHaveCount(0)

    await goOffline(context)
    await expect(page.getByText(/Offline: play, puzzles/)).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByText(/Offline: play, puzzles/)).toHaveCount(0)
  })

  test('cached documents keep cross-origin isolation, so threaded Stockfish survives', async ({
    page,
    context,
  }) => {
    await waitForControl(page)
    await goOffline(context)
    await page.goto('/analysis')
    await expect(page.getByRole('heading', { level: 1, name: 'Analysis' })).toBeVisible()
    expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
  })
})

test.describe('update flow', () => {
  test('a changed worker waits, shows "update ready", and reloads only when accepted', async ({
    page,
  }) => {
    await waitForControl(page)

    // Ship a byte-different worker, as a new deploy would. `context.route` does not see
    // service-worker script fetches, so the preview server's file is changed instead.
    const workerFile = path.resolve(process.env.PW_DIST ?? 'dist', 'sw.js')
    const original = await readFile(workerFile, 'utf8')
    try {
      await writeFile(workerFile, `${original}\n// next deploy`)
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready
        await registration.update()
      })

      await expect(page.getByText('A new version is ready')).toBeVisible()
      // The new worker waits; the page is untouched until the player agrees.
      await page.evaluate(() => {
        Object.assign(window, { updateMarker: true })
      })
      expect(
        await page.evaluate(async () => (await navigator.serviceWorker.ready).waiting !== null),
      ).toBe(true)
      expect(await page.evaluate(() => 'updateMarker' in window)).toBe(true)

      await Promise.all([
        page.waitForEvent('load'),
        page.getByRole('button', { name: 'Reload' }).click(),
      ])
      expect(await page.evaluate(() => 'updateMarker' in window)).toBe(false)
      await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
    } finally {
      await writeFile(workerFile, original)
    }
  })
})
