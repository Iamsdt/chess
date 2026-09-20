import { expect, test } from '@playwright/test'

/**
 * S09 · the panel's contents at phone width.
 *
 * The overlay behaviour itself — scrim, focus trap, escape to close — belongs to
 * S04's shell. What is checked here is that everything inside the panel stays
 * usable once it is only 390px wide: nothing overflows sideways, the composer is
 * reachable, and a reply still arrives.
 */

test.use({ viewport: { width: 390, height: 844 } })

test('the panel is usable at 390px', async ({ page }) => {
  await page.goto('/')

  const panel = page.getByRole('region', { name: 'Chat with Sage' })
  if (!(await panel.isVisible())) {
    await page.getByRole('button', { name: /Sage/i }).first().click()
  }
  await expect(panel).toBeVisible()

  const box = await panel.boundingBox()
  expect(box?.width ?? 0).toBeLessThanOrEqual(390)

  const composer = panel.getByLabel('Message Sage')
  await composer.fill('What should I work on?')
  await panel.getByRole('button', { name: 'Send' }).click()

  await expect(panel.locator('[data-slot="coach-live-region"]')).toHaveText(/^Sage said:/, {
    timeout: 15_000,
  })

  // No sideways scroll inside the thread: bubbles and cards must wrap, not spill.
  const thread = panel.locator('[data-slot="coach-thread"]')
  const overflow = await thread.evaluate((node) => node.scrollWidth - node.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
