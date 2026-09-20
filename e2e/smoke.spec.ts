import { expect, test } from '@playwright/test'

test('app boots', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Chess King' })).toBeVisible()
  expect(errors).toEqual([])
})
