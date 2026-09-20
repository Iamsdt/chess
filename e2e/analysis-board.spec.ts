import { expect, test, type Page } from '@playwright/test'

/**
 * S19 acceptance, driven the way a player drives it.
 *
 * The two merge gates are here: the engine stops the moment the screen is left,
 * and the variation tree is still there after a reload. The explorer is exercised
 * with the network refused, because "graceful offline" is the only part of it this
 * suite is allowed to depend on — a spec that called lichess.org for real would
 * fail in CI the first time the site was slow.
 */

const ITALIAN = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7'

/** The board square, wherever the board component puts it. */
const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`).first()

async function gotoAnalysis(page: Page): Promise<void> {
  await page.goto('/analysis')
  await expect(page.getByRole('heading', { level: 1, name: 'Analysis' })).toBeVisible()
}

/** Start every run from a board nobody has left a tree on. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    indexedDB.deleteDatabase('chessking')
  })
})

test.describe('analysis board', () => {
  test('plays moves onto the board and into the move list', async ({ page }) => {
    await gotoAnalysis(page)

    await square(page, 'e2').click()
    await square(page, 'e4').click()
    await expect(page.getByRole('button', { name: '1. e4' })).toBeVisible()

    await square(page, 'e7').click()
    await square(page, 'e5').click()
    await expect(page.getByRole('button', { name: '1… e5' })).toBeVisible()
  })

  test('keeps the variation tree across a reload', async ({ page }) => {
    await gotoAnalysis(page)

    await square(page, 'e2').click()
    await square(page, 'e4').click()
    await square(page, 'e7').click()
    await square(page, 'e5').click()
    await expect(page.getByRole('button', { name: '1… e5' })).toBeVisible()

    // The tree is saved on a short debounce, so give it a beat before reloading.
    await page.waitForTimeout(800)
    await page.reload()

    await expect(page.getByRole('heading', { level: 1, name: 'Analysis' })).toBeVisible()
    await expect(page.getByRole('button', { name: '1. e4' })).toBeVisible()
    await expect(page.getByRole('button', { name: '1… e5' })).toBeVisible()
  })

  test('branches, promotes and deletes a side line', async ({ page }) => {
    await gotoAnalysis(page)

    await square(page, 'e2').click()
    await square(page, 'e4').click()
    await square(page, 'e7').click()
    await square(page, 'e5').click()

    await page.getByRole('button', { name: '1. e4' }).click()
    await square(page, 'c7').click()
    await square(page, 'c5').click()
    await expect(page.getByRole('button', { name: '1… c5' })).toBeVisible()

    await page.getByRole('button', { name: 'Make main line' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('button', { name: '1… c5' })).toBeHidden()
    await expect(page.getByRole('button', { name: '1… e5' })).toBeVisible()
  })

  test('stops the engine when the screen is left', async ({ page }) => {
    await gotoAnalysis(page)
    // The engine needs cross-origin isolation for the threaded build; either way it
    // must have started before leaving can be said to have stopped anything.
    await expect(page.getByRole('meter', { name: 'Evaluation' })).toBeVisible()

    await page.getByRole('link', { name: /^Puzzles/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Puzzles' })).toBeVisible()

    // Nothing from the analysis screen may still be painting after the route changed.
    await expect(page.getByRole('meter', { name: 'Evaluation' })).toHaveCount(0)
  })

  test('sets up a position by hand and loads it', async ({ page }) => {
    await gotoAnalysis(page)

    await page.getByRole('button', { name: 'Set up' }).click()
    const dialog = page.getByRole('dialog', { name: 'Set up a position' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('FEN').fill(ITALIAN)
    await expect(dialog.getByRole('status')).toContainText('Legal position')
    await dialog.getByRole('button', { name: 'Load position' }).click()

    await expect(dialog).toBeHidden()
    await page.getByRole('tab', { name: 'FEN / PGN' }).click()
    await expect(page.getByLabel('FEN')).toHaveValue(ITALIAN)
  })

  test('refuses an impossible position and says why', async ({ page }) => {
    await gotoAnalysis(page)

    await page.getByRole('button', { name: 'Set up' }).click()
    const dialog = page.getByRole('dialog', { name: 'Set up a position' })
    await dialog.getByRole('button', { name: 'Clear' }).click()

    await expect(dialog.getByRole('status')).toContainText('White needs a king.')
    await expect(dialog.getByRole('button', { name: 'Load position' })).toBeDisabled()
  })

  test('loads a PGN with its variations', async ({ page }) => {
    await gotoAnalysis(page)

    await page.getByRole('tab', { name: 'FEN / PGN' }).click()
    await page.getByLabel('PGN').fill('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 *')
    await page.getByRole('button', { name: 'Load PGN' }).click()

    await page.getByRole('tab', { name: 'Moves' }).click()
    await expect(page.getByRole('button', { name: '1… e5' })).toBeVisible()
    await expect(page.getByRole('button', { name: '1… c5' })).toBeVisible()
    await expect(page.getByRole('button', { name: '2… Nc6' })).toBeVisible()
  })

  test('walks the line with the keyboard', async ({ page }) => {
    await gotoAnalysis(page)

    await page.getByRole('tab', { name: 'FEN / PGN' }).click()
    await page.getByLabel('PGN').fill('1. e4 e5 2. Nf3 *')
    await page.getByRole('button', { name: 'Load PGN' }).click()
    await page.getByRole('tab', { name: 'Moves' }).click()

    await page.getByRole('button', { name: 'Last move' }).click()
    await expect(page.getByRole('button', { name: '2. Nf3' })).toHaveAttribute(
      'aria-current',
      'true',
    )

    await page.locator('body').press('ArrowLeft')
    await expect(page.getByRole('button', { name: '1… e5' })).toHaveAttribute(
      'aria-current',
      'true',
    )

    await page.locator('body').press('Home')
    await expect(page.getByRole('button', { name: 'Start position' })).toBeVisible()
  })

  test('leaves the explorer switched off until it is asked for', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('lichess')) requests.push(request.url())
    })

    await gotoAnalysis(page)
    await page.getByRole('tab', { name: 'Explorer' }).click()

    await expect(page.getByText(/Lichess masters database/)).toBeVisible()
    await expect(page.getByText(/sends the position on the board/)).toBeVisible()
    expect(requests).toEqual([])
  })

  test('says it is offline rather than breaking when the lookup fails', async ({ page }) => {
    await page.route('**/explorer.lichess.ovh/**', (route) => route.abort('failed'))

    await gotoAnalysis(page)
    await page.getByRole('tab', { name: 'Explorer' }).click()
    await page.getByRole('switch', { name: 'Look this position up online' }).click()

    await expect(page.getByText(/Analysis works offline/)).toBeVisible()
    // The board is untouched by a failed lookup.
    await expect(page.getByRole('meter', { name: 'Evaluation' })).toBeVisible()
  })
})
