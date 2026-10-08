import { expect, test } from '@playwright/test'

/**
 * S23's destructive flow: clearing everything needs the typed word, takes the saved
 * settings with it, and drops the person back at first-run setup on a clean slate.
 */

test('clear all asks for DELETE, wipes the settings and reloads to onboarding', async ({
  page,
}) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: '30 min' }).click()
  await expect(page.getByRole('button', { name: '30 min' })).toHaveClass(/is-active/)

  // The save is asynchronous; a reload proves it reached the database.
  await page.reload()
  await expect(page.getByRole('button', { name: '30 min' })).toHaveClass(/is-active/)

  await page.getByRole('button', { name: 'Clear all data' }).click()
  const dialog = page.getByRole('dialog', { name: 'Clear everything on this device?' })
  const confirm = dialog.getByRole('button', { name: 'Clear all data' })
  await expect(confirm).toBeDisabled()

  await dialog.getByLabel('Type DELETE to confirm').fill('delete')
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE')
  await expect(confirm).toBeEnabled()
  await confirm.click()

  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible()

  // Nothing survived: the goal is back at its default, and the browser keys are gone.
  expect(await page.evaluate(() => localStorage.getItem('ck-setup-prompted'))).toBeNull()
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: '15 min' })).toHaveClass(/is-active/)
})

test('cancelling the dialog keeps everything', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: '5 min' }).click()
  await page.getByRole('button', { name: 'Clear all data' }).click()
  await page
    .getByRole('dialog', { name: 'Clear everything on this device?' })
    .getByRole('button', { name: 'Cancel' })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: '5 min' })).toHaveClass(/is-active/)
})
