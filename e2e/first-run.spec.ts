import { expect, test } from '@playwright/test'

/** A browser that has never seen the app is sent to setup once, and never again. */

test.use({ storageState: { cookies: [], origins: [] } })

test('a brand-new browser lands on setup, and leaving it is respected', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible()

  await page.goto('/puzzles')
  await expect(page).toHaveURL(/\/puzzles$/)
})

test('a shared link opens as linked on a first visit', async ({ page }) => {
  await page.goto('/share')
  await expect(page).toHaveURL(/\/share$/)
})

test('finishing setup lands on Today with the name that was given', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('What should we call you?').fill('Ada')
  await page.getByRole('button', { name: 'Step 4: AI coach' }).click()
  await page.getByRole('button', { name: /Start playing/i }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ada')
})
