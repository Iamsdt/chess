import { expect, test, type Page } from '@playwright/test'

/**
 * S12's merge gate: **a game survives a reload**.
 *
 * Everything the board shows is rebuilt from IndexedDB on mount, so this is the
 * one test that proves the autosave and the resume agree. It deliberately asserts
 * only on the moves the *player* made: Stockfish is a real WASM engine here and
 * may well have answered by the time the assertion runs, or not have answered yet.
 */

async function startUntimedGameAsWhite(page: Page): Promise<void> {
  await page.goto('/play')
  await expect(page.getByRole('heading', { level: 1, name: 'New game' })).toBeVisible()
  await page.getByRole('radio', { name: /^White/ }).check()
  await page.getByRole('radio', { name: 'Untimed' }).check()
  await page.getByRole('button', { name: /Start game/ }).click()
  await expect(page.getByRole('grid', { name: 'Sparring board' })).toBeVisible()
}

/** Click-to-move: the board selects on the first square and moves on the second. */
async function play(page: Page, from: string, to: string): Promise<void> {
  await page.locator(`[data-square="${from}"]`).click()
  await page.locator(`[data-square="${to}"]`).click()
}

test.describe('resuming a game', () => {
  test('a move made before a reload is still there after it', async ({ page }) => {
    await startUntimedGameAsWhite(page)

    await play(page, 'e2', 'e4')
    const moves = page.getByRole('list', { name: 'Moves played' })
    await expect(moves).toContainText('e4')

    await page.reload()

    await expect(page.getByRole('heading', { level: 1, name: 'Sparring' })).toBeVisible()
    await expect(page.getByRole('grid', { name: 'Sparring board' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Moves played' })).toContainText('e4')
    await expect(page.getByText('No game in progress')).toHaveCount(0)
  })

  test('the opponent and the settings come back with the game', async ({ page }) => {
    await page.goto('/play')
    await page.getByRole('slider', { name: 'Opponent rating' }).fill('900')
    await page.getByRole('radio', { name: /^White/ }).check()
    await page.getByRole('radio', { name: 'Untimed' }).check()
    await page.getByRole('radio', { name: /Tricky/ }).check()
    await page.getByRole('button', { name: /Start game/ }).click()
    await expect(page.getByRole('grid', { name: 'Sparring board' })).toBeVisible()

    await page.reload()

    await expect(page.getByText('Stockfish 900')).toBeVisible()
    await expect(page.getByText('tricky personality')).toBeVisible()
  })

  test('a finished game is not offered for resuming', async ({ page }) => {
    await startUntimedGameAsWhite(page)

    await page.getByRole('button', { name: /Resign/ }).click()
    await page.getByRole('button', { name: 'Resign and review' }).click()
    await expect(page.getByRole('heading', { name: 'Stockfish won' })).toBeVisible()

    await page.goto('/play/game')
    await expect(page.getByText('No game in progress')).toBeVisible()
  })

  test('a take-back rewinds the move list and lets the move be replayed', async ({ page }) => {
    await startUntimedGameAsWhite(page)

    await play(page, 'e2', 'e4')
    const moves = page.getByRole('list', { name: 'Moves played' })
    await expect(moves).toContainText('e4')

    await page.getByRole('button', { name: 'Take back' }).click()
    await expect(page.getByText('No moves yet. The game starts when you play one.')).toBeVisible()

    await play(page, 'd2', 'd4')
    await expect(page.getByRole('list', { name: 'Moves played' })).toContainText('d4')

    await page.reload()
    await expect(page.getByRole('list', { name: 'Moves played' })).toContainText('d4')
  })
})
