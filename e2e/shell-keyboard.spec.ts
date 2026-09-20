import { expect, test, type Page } from '@playwright/test'

/** S04 acceptance: the whole shell is reachable from the keyboard — `/` for Sage, `g`
 *  chords for navigation, ⌘K for the palette, Escape to dismiss. */
/**
 * The shortcut layer registers its `document` listener in an effect, so a key pressed
 * between `goto` and React's first commit is simply lost. Wait for the shell to be on
 * screen before typing — otherwise these tests race the mount and fail intermittently.
 */
async function gotoShell(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

test.describe('keyboard layer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 840 })
  })

  test('"/" opens the Sage panel and lands in the composer', async ({ page }) => {
    await gotoShell(page, '/')
    await expect(page.getByRole('complementary', { name: 'Chat with Sage' })).toHaveCount(0)

    await page.keyboard.press('/')

    await expect(page.getByRole('complementary', { name: 'Chat with Sage' })).toBeVisible()
    await expect(page.getByLabel('Message Sage')).toBeFocused()
  })

  test('"/" is just a slash while the composer has the caret', async ({ page }) => {
    await gotoShell(page, '/')
    await page.keyboard.press('/')

    await page.getByLabel('Message Sage').fill('1')
    await page.keyboard.press('/')
    await page.keyboard.type('2')

    await expect(page.getByLabel('Message Sage')).toHaveValue('1/2')
  })

  test('Escape closes the floating panel and hands focus back', async ({ page }) => {
    await gotoShell(page, '/')
    await page.getByRole('button', { name: 'Ask Sage' }).click()
    await expect(page.getByRole('complementary', { name: 'Chat with Sage' })).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('complementary', { name: 'Chat with Sage' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ask Sage' })).toBeFocused()
  })

  test('the "g" chord jumps between screens', async ({ page }) => {
    await gotoShell(page, '/')

    await page.keyboard.press('g')
    await page.keyboard.press('z')
    await expect(page).toHaveURL('/puzzles')

    await page.keyboard.press('g')
    await page.keyboard.press('m')
    await expect(page).toHaveURL('/mistakes')
  })

  test('a "g" with no destination is forgotten', async ({ page }) => {
    await gotoShell(page, '/')

    await page.keyboard.press('g')
    await page.keyboard.press('q')
    await page.keyboard.press('z')

    await expect(page).toHaveURL('/')
  })

  test('⌘K opens the palette and navigates from it', async ({ page }) => {
    await gotoShell(page, '/')

    await page.keyboard.press('ControlOrMeta+k')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()

    await page.keyboard.type('openin')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL('/openings')
    await expect(palette).toHaveCount(0)
  })

  test('the header Search button opens the same palette', async ({ page }) => {
    await gotoShell(page, '/')

    await page.getByRole('button', { name: /^Search/ }).click()
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0)
  })

  test('the whole frame is reachable by Tab', async ({ page }) => {
    await gotoShell(page, '/')

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Chess King home' })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: /^Today/ })).toBeFocused()
  })
})
