import { expect, test, type Page } from '@playwright/test'

/**
 * Pixel snapshots of the board in every board theme.
 *
 * `board-themes.spec.ts` checks the palette tokens by computed style, which is browser
 * independent and points at the token that broke. This spec covers what that cannot: that
 * the squares, the pieces on them and the highlights really are painted together, in each
 * theme and in dark mode. Baselines belong to the pinned Chromium that CI installs; when
 * a deliberate change is made, regenerate them with
 * `npx playwright test e2e/board-screenshots.spec.ts --update-snapshots` and review the
 * images in the diff.
 */

const BOARD_THEMES = ['grove', 'walnut', 'slate', 'dusk', 'sand'] as const

/** One viewport is enough: the board is square and scales, and a baseline per project doubles the images for nothing. */
function onlyOnDesktop(): void {
  test.skip(test.info().project.name !== 'desktop', 'board snapshots are taken on desktop only')
}

/** Waits until every piece image has decoded; a half-loaded board would be a flaky baseline. */
async function boardReady(page: Page) {
  const board = page.locator('.vb').first()
  await expect(board).toBeVisible()
  await expect
    .poll(() =>
      board.evaluate((element) =>
        Array.from(element.querySelectorAll('img')).every(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true)
  return board
}

test.describe('board snapshots', () => {
  for (const theme of BOARD_THEMES) {
    test(`${theme} board, light`, async ({ page }) => {
      onlyOnDesktop()
      await page.addInitScript((value) => {
        localStorage.setItem('ck-board', value)
        localStorage.setItem('ck-theme', 'light')
      }, theme)
      await page.goto('/analysis')
      const board = await boardReady(page)
      await expect(board).toHaveScreenshot(`board-${theme}-light.png`, {
        animations: 'disabled',
        caret: 'hide',
      })
    })
  }

  test('grove board, dark', async ({ page }) => {
    onlyOnDesktop()
    await page.addInitScript(() => {
      localStorage.setItem('ck-theme', 'dark')
    })
    await page.goto('/analysis')
    const board = await boardReady(page)
    await expect(board).toHaveScreenshot('board-grove-dark.png', {
      animations: 'disabled',
      caret: 'hide',
    })
  })
})
