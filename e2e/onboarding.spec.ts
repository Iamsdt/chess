import { expect, test } from '@playwright/test'

/**
 * S25: a fresh browser reaches a usable Today screen in under a minute, with no dead ends.
 * Every test starts as a first-time visitor, so the first-run guard is part of the path.
 */

test.use({ storageState: { cookies: [], origins: [] } })

const BUDGET_MS = 60_000

test('four steps, a theme and a skipped coach reach Today within the minute', async ({ page }) => {
  const started = Date.now()
  await page.goto('/')
  await expect(page).toHaveURL(/\/onboarding$/)

  // 1. Level
  await page.getByLabel('What should we call you?').fill('Ada')
  await page.getByRole('radio', { name: /Club player/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()

  // 2. Goals
  await page.getByRole('button', { name: /Continue/ }).click()

  // 3. Daily time and board
  await page.getByRole('button', { name: /Continue/ }).click()

  // 4. Coach, skipped
  await expect(
    page.getByRole('heading', { level: 2, name: 'Want Sage, your AI coach?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: /Skip — everything works without it/ }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ada')
  expect(Date.now() - started).toBeLessThan(BUDGET_MS)

  // Setup is not offered again.
  await page.reload()
  await expect(page).toHaveURL(/\/$/)
})

test('Skip setup works from the first screen and leaves a usable app', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip setup' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/puzzles')
  await expect(page).toHaveURL(/\/puzzles$/)
})

test('placement can be skipped at any point and still ends on Today', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(/Not sure\? Take a 5-puzzle placement/).check()
  await page.getByRole('button', { name: 'Step 4: AI coach' }).click()
  await page.getByRole('button', { name: /Start playing/i }).click()

  // Either the puzzles are on this device and placement shows, or it says so and moves on.
  const skip = page.getByRole('button', { name: /Skip placement|Continue to Today/ })
  await skip.click()
  await expect(page).toHaveURL(/\/$/)
})

test('setup can be replayed from Settings and keeps the saved name', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('What should we call you?').fill('Grace')
  await page.getByRole('button', { name: 'Step 4: AI coach' }).click()
  await page.getByRole('button', { name: /Start playing/i }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/settings')
  await page.getByRole('link', { name: /Replay first-run setup/ }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByLabel('What should we call you?')).toHaveValue('Grace')
})
