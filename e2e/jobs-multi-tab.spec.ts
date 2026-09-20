import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

/**
 * The two host guarantees the "two tabs never double-process" rule rests on, checked
 * against a real browser rather than the fakes the unit tests use.
 *
 * `src/jobs/multi-tab.test.ts` proves the queue *uses* these correctly — it claims
 * under the lock and fans out over the channel. This file proves the browser really
 * behaves the way those fakes pretend: a lock has exactly one holder across tabs,
 * and a message reaches the other tab. Between them the claim is covered end to end.
 */

/** The name the queue derives from a job type; it must match `LOCK_PREFIX` in `queue.ts`. */
const LOCK_NAME = 'chess-king:job:analyse-game'
const CHANNEL_NAME = 'chess-king:jobs'
const HOLD_MS = 2_000

/** Ask for the lock without waiting, exactly as the queue's `acquire` does. */
function tryLock(target: Page, holdMs: number): Promise<boolean> {
  return target.evaluate(
    ([name, hold]) =>
      new Promise<boolean>((resolve) => {
        void navigator.locks.request(name, { ifAvailable: true }, (lock) => {
          resolve(lock !== null)
          if (lock === null) return Promise.resolve()
          return new Promise<void>((done) => {
            setTimeout(done, hold)
          })
        })
      }),
    [LOCK_NAME, holdMs] as [string, number],
  )
}

test.describe('two tabs', () => {
  test('only one tab holds a job type lock, and the other gets its turn after', async ({
    page,
  }) => {
    await page.goto('/dev/jobs')
    const other = await page.context().newPage()
    await other.goto('/dev/jobs')

    expect(await tryLock(page, HOLD_MS)).toBe(true)
    expect(await tryLock(other, 0)).toBe(false)

    // The holder lets go after HOLD_MS; nothing is starved for longer than that.
    await expect.poll(() => tryLock(other, 0), { timeout: HOLD_MS * 3 }).toBe(true)

    await other.close()
  })

  test('a progress broadcast reaches the other tab', async ({ page }) => {
    await page.goto('/dev/jobs')
    const other = await page.context().newPage()
    await other.goto('/dev/jobs')

    await other.evaluate((name) => {
      window.sessionStorage.setItem('e2e-jobs-seen', '')
      const channel = new BroadcastChannel(name)
      channel.addEventListener('message', (event: MessageEvent<unknown>) => {
        window.sessionStorage.setItem('e2e-jobs-seen', JSON.stringify(event.data))
      })
    }, CHANNEL_NAME)

    await page.evaluate((name) => {
      const channel = new BroadcastChannel(name)
      channel.postMessage({
        kind: 'progress',
        origin: 'e2e-tab',
        id: 'e2e-job-1',
        type: 'analyse-game',
        state: 'running',
        progress: 0.5,
        label: 'move 20 of 40',
      })
      channel.close()
    }, CHANNEL_NAME)

    await expect
      .poll(() => other.evaluate(() => window.sessionStorage.getItem('e2e-jobs-seen') ?? ''))
      .toContain('move 20 of 40')

    await other.close()
  })
})
