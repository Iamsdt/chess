import { expect, test } from '@playwright/test'

/** S04 acceptance: the layout at the three widths the sprint plan names, plus the rail
 *  rule that gives a board screen its width back. */

const sidebar = 'complementary'

test.describe('shell layout', () => {
  test('1440 · sidebar, page and a docked Sage panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    await expect(page.getByRole(sidebar, { name: 'Sidebar' })).toBeVisible()
    await expect(page.getByRole(sidebar, { name: 'Chat with Sage' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ask Sage' })).toHaveCount(0)
    await expect(page.getByText('Your chess garden')).toBeVisible()

    // Docked, not floating: the panel sits beside the page rather than over it.
    const panel = await page.getByRole(sidebar, { name: 'Chat with Sage' }).boundingBox()
    const main = await page.locator('main').boundingBox()
    expect(panel).not.toBeNull()
    expect(main).not.toBeNull()
    expect(panel?.x ?? 0).toBeGreaterThanOrEqual((main?.x ?? 0) + (main?.width ?? 0) - 1)
  })

  test('1440 on a board screen · the nav collapses to the icon rail', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/analysis')

    await expect(page.getByRole(sidebar, { name: 'Sidebar' })).toBeVisible()
    await expect(page.getByText('Your chess garden')).toHaveCount(0)
  })

  test('1280 · the panel starts closed and opens over the page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 840 })
    await page.goto('/')

    await expect(page.getByRole(sidebar, { name: 'Chat with Sage' })).toHaveCount(0)
    const fab = page.getByRole('button', { name: 'Ask Sage' })
    await expect(fab).toBeVisible()

    await fab.click()
    const panel = page.getByRole(sidebar, { name: 'Chat with Sage' })
    await expect(panel).toBeVisible()

    // Floating: the panel is pinned to the right edge of the window.
    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeCloseTo(1280, -1)
  })

  test('390 · the sidebar gives way to the bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    await expect(page.getByRole(sidebar, { name: 'Sidebar' })).toHaveCount(0)

    const bar = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(bar).toBeVisible()
    await bar.getByRole('link', { name: 'Puzzles' }).click()
    await expect(page).toHaveURL('/puzzles')

    await bar.getByRole('button', { name: 'Sage' }).click()
    await expect(page.getByRole(sidebar, { name: 'Chat with Sage' })).toBeVisible()
  })

  test('the panel preference survives a reload from a docked width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    await page.getByRole('button', { name: 'Close chat' }).click()
    await expect(page.getByRole('button', { name: 'Ask Sage' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Ask Sage' })).toBeVisible()
    await expect(page.getByRole(sidebar, { name: 'Chat with Sage' })).toHaveCount(0)
  })

  test('a screen that asks for a quiet panel is obeyed', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/friends/live')

    await expect(page.getByRole(sidebar, { name: 'Chat with Sage' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Ask Sage' }).click()
    await expect(page.getByText(/Fair play: Sage is paused during live games/)).toBeVisible()
  })
})
