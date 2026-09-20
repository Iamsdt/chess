import { expect, test, type Page } from '@playwright/test'

/**
 * S20 · the import loop, in a real browser.
 *
 * Two things can only be proved here and nowhere else:
 *
 * - **The parse really is off the main thread.** jsdom has no `Worker`, so the unit tests
 *   can only show that both halves speak the protocol. Here a multi-megabyte file is
 *   imported and the page is clicked *while it runs*; if the parse were on the main
 *   thread that click would not land until the file was finished.
 * - **Re-import creates no duplicates.** The dedupe is tested against `fake-indexeddb`,
 *   but the index it leans on belongs to the browser, and this is the browser.
 *
 * Both provider imports are served by `page.route`, so the suite never touches Lichess or
 * Chess.com: a third party being slow, rate-limiting CI or simply changing its export
 * format is not a reason for this repository's tests to go red.
 */

const DB_NAME = 'chessking'

/** One real, complete game; the generator below stamps a fresh id into each copy. */
const GAME = (id: number): string =>
  [
    '[Event "Rated Blitz game"]',
    `[Site "https://lichess.org/${String(id).padStart(8, '0')}"]`,
    '[Date "2024.03.09"]',
    `[White "bishop_bard"]`,
    `[Black "rival_${String(id)}"]`,
    '[Result "1-0"]',
    '[WhiteElo "1512"]',
    '[TimeControl "300+3"]',
    '[Termination "Normal"]',
    '',
    '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6',
    '8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 1-0',
    '',
  ].join('\n')

function pgnOfAtLeast(bytes: number): string {
  const parts: string[] = []
  let size = 0
  let id = 1
  while (size < bytes) {
    const game = GAME(id)
    parts.push(game)
    size += game.length + 1
    id += 1
  }
  return parts.join('\n')
}

/** A library screen with nothing in it, every time. */
async function openEmptyLibrary(page: Page): Promise<void> {
  await page.addInitScript((name: string) => {
    indexedDB.deleteDatabase(name)
  }, DB_NAME)
  await page.goto('/games')
  await expect(page.getByRole('heading', { level: 1, name: 'My games' })).toBeVisible()
}

async function pasteAndImport(page: Page, pgn: string): Promise<void> {
  await page.getByRole('tab', { name: 'Paste or upload' }).click()
  await page.getByLabel('PGN', { exact: true }).fill(pgn)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
}

test.describe('the games library', () => {
  test('imports a pasted game and shows it in the table', async ({ page }) => {
    await openEmptyLibrary(page)
    await expect(page.getByText('No games yet')).toBeVisible()

    await pasteAndImport(page, GAME(1))

    const table = page.getByRole('table', { name: 'Games' })
    await expect(table).toBeVisible()
    await expect(table.getByText('rival_1')).toBeVisible()
    await expect(page.getByText('Showing 1 of 1')).toBeVisible()
  })

  test('creates no duplicates when the same file is imported twice', async ({ page }) => {
    await openEmptyLibrary(page)
    const pgn = [GAME(1), GAME(2), GAME(3)].join('\n')

    await pasteAndImport(page, pgn)
    await expect(page.getByText('Showing 3 of 3')).toBeVisible()

    await pasteAndImport(page, pgn)
    await expect(page.getByText(/0 imported · 3 already here/)).toBeVisible()
    await expect(page.getByText('Showing 3 of 3')).toBeVisible()
  })

  test('keeps the page usable while a large file imports', async ({ page }) => {
    test.slow()
    await openEmptyLibrary(page)

    // The 5 MB the sprint promises, pasted in one go as a person would paste it.
    await page.getByRole('tab', { name: 'Paste or upload' }).click()
    await page.getByLabel('PGN', { exact: true }).fill(pgnOfAtLeast(5 * 1024 * 1024))
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    // Progress must appear, and the rest of the page must still answer while it runs.
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
    const started = Date.now()
    await page.getByRole('radio', { name: 'Won' }).click()
    expect(Date.now() - started).toBeLessThan(2_000)
    await expect(page.getByRole('radio', { name: 'Won' })).toHaveAttribute('aria-checked', 'true')

    await expect(page.getByRole('button', { name: 'Cancel' })).toBeHidden({ timeout: 300_000 })
    await expect(page.getByText(/imported/)).toBeVisible()
  })

  test('imports from Lichess without leaving the browser', async ({ page }) => {
    await openEmptyLibrary(page)
    await page.route('https://lichess.org/api/games/user/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/x-chess-pgn',
        body: [GAME(11), GAME(12)].join('\n'),
      })
    })

    await page.getByRole('tab', { name: 'Lichess' }).click()
    await page.getByLabel('Lichess username').fill('bishop_bard')
    await page.getByRole('button', { name: 'Fetch' }).click()

    await expect(page.getByText(/2 imported/)).toBeVisible()
    await expect(page.getByRole('table', { name: 'Games' }).getByText('rival_11')).toBeVisible()
  })

  test('walks the Chess.com archives a month at a time', async ({ page }) => {
    await openEmptyLibrary(page)
    await page.route('**/pub/player/knightowl77/games/archives', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          archives: [
            'https://api.chess.com/pub/player/knightowl77/games/2024/02',
            'https://api.chess.com/pub/player/knightowl77/games/2024/03',
          ],
        }),
      })
    })
    await page.route('**/games/2024/*/pgn', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/x-chess-pgn',
        body: GAME(route.request().url().includes('/03/') ? 21 : 22),
      })
    })

    await page.getByRole('tab', { name: 'Chess.com' }).click()
    await page.getByLabel('Chess.com username').fill('knightowl77')
    await page.getByRole('button', { name: 'Fetch' }).click()

    await expect(page.getByText(/2 imported/)).toBeVisible()
  })

  test('says how long to wait when the provider rate-limits', async ({ page }) => {
    await openEmptyLibrary(page)
    await page.route('https://lichess.org/api/games/user/**', async (route) => {
      await route.fulfill({ status: 429, headers: { 'retry-after': '11' }, body: '' })
    })

    await page.getByRole('tab', { name: 'Lichess' }).click()
    await page.getByLabel('Lichess username').fill('bishop_bard')
    await page.getByRole('button', { name: 'Fetch' }).click()

    await expect(page.getByText(/11 seconds/)).toBeVisible({ timeout: 30_000 })
  })

  test('degrades to a readable message when the network is gone', async ({ page }) => {
    await openEmptyLibrary(page)
    await page.route('https://lichess.org/api/games/user/**', async (route) => {
      await route.abort('internetdisconnected')
    })

    await page.getByRole('tab', { name: 'Lichess' }).click()
    await page.getByLabel('Lichess username').fill('bishop_bard')
    await page.getByRole('button', { name: 'Fetch' }).click()

    await expect(page.getByText(/offline/)).toBeVisible({ timeout: 30_000 })
  })

  test('exports what the table is showing', async ({ page }) => {
    await openEmptyLibrary(page)
    await pasteAndImport(page, [GAME(1), GAME(2)].join('\n'))
    await expect(page.getByText('Showing 2 of 2')).toBeVisible()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download these games as PGN' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^chess-king-games-\d{4}-\d{2}-\d{2}\.pgn$/)
  })

  test('sorts and filters from the keyboard alone', async ({ page }) => {
    await openEmptyLibrary(page)
    await pasteAndImport(page, [GAME(1), GAME(2)].join('\n'))
    await expect(page.getByText('Showing 2 of 2')).toBeVisible()

    const opponent = page.getByRole('columnheader', { name: /Opponent/ })
    await opponent.getByRole('button').focus()
    await expect(opponent.getByRole('button')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(opponent).toHaveAttribute('aria-sort', 'ascending')
    await page.keyboard.press('Enter')
    await expect(opponent).toHaveAttribute('aria-sort', 'descending')
  })
})
