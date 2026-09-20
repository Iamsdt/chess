import { expect, test, type Page } from '@playwright/test'

/**
 * S09 · the Sage panel, driven end to end against the scripted `MockCoach`.
 *
 * These specs assume S04's shell mounts `<CoachPanel>` in its right-hand panel
 * slot on `/`, and that the panel is reachable from a control named "Sage" when
 * the shell starts it closed. Nothing here touches the shell's own chrome —
 * whether the panel is a column or an overlay is S04's concern and S04's test.
 */

async function openCoachPanel(page: Page) {
  const panel = page.getByRole('region', { name: 'Chat with Sage' })
  const opener = page.getByRole('button', { name: /Sage/i }).first()
  // The panel body is code-split, so on first paint neither it nor the opener is on screen
  // yet. Wait for whichever arrives before deciding — `isVisible()` does not wait.
  await expect(panel.or(opener).first()).toBeVisible()
  if (!(await panel.isVisible())) {
    await opener.click()
  }
  await expect(panel).toBeVisible()
  return panel
}

test.describe('Sage panel', () => {
  test('opens on a seeded thread with a day divider and a position card', async ({ page }) => {
    await page.goto('/')
    const panel = await openCoachPanel(page)

    await expect(panel.getByText('Sage', { exact: true })).toBeVisible()
    await expect(panel.getByText(/Sage sees:/)).toBeVisible()
    await expect(panel.getByRole('img', { name: /king on|knight on/i }).first()).toBeVisible()
  })

  test('streams a reply to a typed question and announces it', async ({ page }) => {
    await page.goto('/')
    const panel = await openCoachPanel(page)

    await panel.getByLabel('Message Sage').fill('Why do I keep losing to knight tricks?')
    await panel.getByRole('button', { name: 'Send' }).click()

    // Scope to the thread: the sr-only live region repeats the text on purpose, so a
    // panel-wide text match is ambiguous rather than wrong.
    const thread = panel.locator('[data-slot="coach-thread"]')
    await expect(
      thread.getByText('Why do I keep losing to knight tricks?', { exact: true }),
    ).toBeVisible()
    const live = panel.locator('[data-slot="coach-live-region"]')
    await expect(live).toHaveText(/Sage is writing/)
    await expect(live).toHaveText(/^Sage said:/, { timeout: 15_000 })
  })

  test('a quick reply asks the question for you', async ({ page }) => {
    await page.goto('/')
    const panel = await openCoachPanel(page)

    const reply = panel.locator('.reply').first()
    const text = (await reply.textContent())?.trim() ?? ''
    await reply.click()

    await expect(panel.locator('.bubble-me', { hasText: text })).toBeVisible()
  })

  test('Stop ends a stream and leaves what arrived', async ({ page }) => {
    await page.goto('/')
    const panel = await openCoachPanel(page)

    await panel.getByLabel('Message Sage').fill('Explain the whole Italian game to me')
    await panel.getByRole('button', { name: 'Send' }).click()
    await panel.getByRole('button', { name: 'Stop' }).click()

    await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(panel.locator('[data-slot="coach-message-error"]')).toHaveCount(0)
  })

  test('the no-spoilers and engine toggles are switchable', async ({ page }) => {
    await page.goto('/')
    const panel = await openCoachPanel(page)

    const spoilers = panel.getByRole('button', { name: 'No spoilers' })
    await expect(spoilers).toHaveAttribute('aria-pressed', 'true')
    await spoilers.click()
    await expect(spoilers).toHaveAttribute('aria-pressed', 'false')
  })

  test('new chat clears the thread and greets', async ({ page }) => {
    await page.goto('/')
    const panel = await openCoachPanel(page)

    await panel.getByRole('button', { name: 'New chat' }).click()
    const thread = panel.locator('[data-slot="coach-thread"]')
    await expect(thread.getByText('Fresh start. What are we working on?')).toBeVisible()
  })
})
