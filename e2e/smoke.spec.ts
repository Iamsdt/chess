import { expect, test } from '@playwright/test'

test('app boots', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')

  // `/` is the Today screen inside the shell. "Chess King" is deliberately not a heading:
  // it is the document-title suffix and the sidebar brand link, and the sidebar is replaced
  // by the bottom bar at 390 — so assert the title, which holds at every width.
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(page).toHaveTitle(/Chess King/)
  expect(errors).toEqual([])
})
