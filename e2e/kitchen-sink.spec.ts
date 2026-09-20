import { expect, test } from '@playwright/test'

/** S02 acceptance, without pixel baselines: the design-system route boots clean and its
 *  theme and board controls really do rewrite the `<html>` element. */
test.describe('/dev/kitchen-sink', () => {
  test('renders both theme columns without page errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/dev/kitchen-sink')

    await expect(page.getByRole('heading', { level: 1, name: 'Kitchen sink' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sharpen your eye' })).toHaveCount(2)
    await expect(page.locator('.light')).toBeVisible()
    await expect(page.locator('main > div.mx-auto > div.dark')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('theme control persists to ck-theme and toggles the dark class', async ({ page }) => {
    await page.goto('/dev/kitchen-sink')

    await page.getByRole('button', { name: 'dark', exact: true }).click()
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    expect(await page.evaluate(() => localStorage.getItem('ck-theme'))).toBe('dark')

    await page.getByRole('button', { name: 'light', exact: true }).click()
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
    expect(await page.evaluate(() => localStorage.getItem('ck-theme'))).toBe('light')
  })

  test('board control writes data-board and ck-board', async ({ page }) => {
    await page.goto('/dev/kitchen-sink')

    await page.getByRole('button', { name: 'walnut', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-board', 'walnut')
    expect(await page.evaluate(() => localStorage.getItem('ck-board'))).toBe('walnut')

    await page.getByRole('button', { name: 'grove', exact: true }).click()
    await expect(page.locator('html')).not.toHaveAttribute('data-board', /.*/)
  })
})
