import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

/**
 * S11 acceptance in a real browser.
 *
 * What only a browser can answer: whether Web Locks and `BroadcastChannel` are
 * really there, whether a job row really survives a reload, and what the queue and
 * its panel cost the main thread. The scheduling logic itself is covered by the
 * unit tests in `src/jobs`, which run it against fakes on fake timers.
 *
 * Note what this file does *not* do: run a job end to end. A job only runs when a
 * feature registers a handler for its type, and the first of those ships with S13
 * (review) and S20 (import). When one lands, the durability test below becomes
 * "enqueue, reload, watch it finish" instead of "enqueue, reload, still queued".
 */

const QUEUED_JOB_ID = 'e2e-job-1'

/** Write a job row the way a feature would, but without needing that feature. */
async function seedQueuedJob(page: Page, id: string): Promise<void> {
  await page.evaluate(async (jobId) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('chessking')
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(new Error('could not open chessking'))
      }
    })
    const at = Date.now()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('jobs', 'readwrite')
      tx.objectStore('jobs').put({
        id: jobId,
        type: 'analyse-game',
        payload: { gameId: 'e2e-game-1' },
        state: 'queued',
        priority: 'high',
        attempts: 0,
        maxAttempts: 3,
        progress: 0,
        lastError: null,
        createdAt: at,
        updatedAt: at,
        startedAt: null,
        finishedAt: null,
        nextRunAt: null,
        dedupeKey: 'analyse-game:e2e-game-1',
        lockOwner: null,
      })
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        reject(new Error('could not write the job row'))
      }
    })
  }, id)
}

test.describe('/dev/jobs', () => {
  test('boots clean and reports the host APIs the queue depends on', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/dev/jobs')

    await expect(page.getByRole('heading', { level: 1, name: 'Job queue' })).toBeVisible()
    // Chromium has both; the panel says so out loud because the fallbacks are weaker.
    await expect(page.getByText('available', { exact: true }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('pauses and resumes the scheduler', async ({ page }) => {
    await page.goto('/dev/jobs')

    await page.getByRole('button', { name: 'Pause' }).click()
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()

    await page.getByRole('button', { name: 'Resume' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  })

  test('a queued job is still queued after a reload', async ({ page }) => {
    await page.goto('/dev/jobs')
    await seedQueuedJob(page, QUEUED_JOB_ID)

    await page.reload()
    await expect(page.getByText('analyse-game').first()).toBeVisible()
    await expect(
      page.getByRole('progressbar', { name: 'analyse-game progress' }).first(),
    ).toBeVisible()
  })

  test('keeps the main thread free while the queue and the panel are live', async ({ page }) => {
    await page.goto('/dev/jobs')
    await seedQueuedJob(page, `${QUEUED_JOB_ID}-timing`)

    const longTasks = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const durations: number[] = []
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) durations.push(entry.duration)
          })
          observer.observe({ entryTypes: ['longtask'] })
          setTimeout(() => {
            observer.disconnect()
            resolve(durations)
          }, 3_000)
        }),
    )

    // Nothing the queue or the panel does may block a frame for a noticeable time.
    expect(Math.max(0, ...longTasks)).toBeLessThan(150)
  })
})
