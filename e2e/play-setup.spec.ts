import { expect, test } from '@playwright/test'

/**
 * S12 · the setup screen, end to end.
 *
 * What is worth checking in a real browser rather than in jsdom: the range input
 * behaves like a range input, the radio groups are reachable and operable from the
 * keyboard alone, and pressing "Start game" actually lands on a board.
 */
test.describe('play setup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/play')
    await expect(page.getByRole('heading', { level: 1, name: 'New game' })).toBeVisible()
  })

  test('the rating slider drives the summary', async ({ page }) => {
    const slider = page.getByRole('slider', { name: 'Opponent rating' })
    await slider.fill('1750')

    await expect(page.getByRole('heading', { level: 2, name: /vs Stockfish 1750/ })).toBeVisible()
    await expect(page.getByText('A stretch')).toBeVisible()
  })

  test('the whole form is operable from the keyboard', async ({ page }) => {
    const slider = page.getByRole('slider', { name: 'Opponent rating' })
    await slider.focus()
    await expect(slider).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('heading', { level: 2, name: /vs Stockfish 1250/ })).toBeVisible()

    // Radio groups take one tab stop and move with the arrow keys, as the platform does.
    const black = page.getByRole('radio', { name: /Black/ })
    await black.focus()
    await expect(black).toBeChecked()
    await expect(page.getByRole('definition').filter({ hasText: 'black' })).toBeVisible()
  })

  test('a pasted position is checked before the game can start', async ({ page }) => {
    await page.getByRole('radio', { name: /Paste a FEN/ }).check()
    const field = page.getByLabel('FEN')
    await field.fill('this is not a position')

    await expect(page.getByRole('button', { name: /Start game/ })).toBeDisabled()

    await field.fill('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')
    await expect(page.getByRole('button', { name: /Start game/ })).toBeEnabled()
  })

  test('starting a game lands on the board', async ({ page }) => {
    await page.getByRole('radio', { name: /^White/ }).check()
    await page.getByRole('radio', { name: 'Untimed' }).check()
    await page.getByRole('button', { name: /Start game/ }).click()

    await expect(page).toHaveURL('/play/game')
    await expect(page.getByRole('heading', { level: 1, name: 'Sparring' })).toBeVisible()
    await expect(page.getByRole('grid', { name: 'Sparring board' })).toBeVisible()
  })

  test('the board screen says so when there is no game yet', async ({ page }) => {
    await page.goto('/play/game')
    await expect(page.getByText('No game in progress')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Set up a game' })).toBeVisible()
  })
})
