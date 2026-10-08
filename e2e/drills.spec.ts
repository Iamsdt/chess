import { expect, test, type Page } from '@playwright/test'

/**
 * S18 · endgame and vision drills, end to end.
 *
 * What is worth checking in a real browser rather than in jsdom: the real Stockfish
 * answers a move, a finished drill's result survives a reload, and a timed round ends
 * on the clock and keeps its score.
 */

const square = (page: Page, name: string) => page.locator(`.vb-sq[data-square="${name}"]`)

async function move(page: Page, from: string, to: string) {
  await square(page, from).click()
  await square(page, to).click()
}

test.describe('endgame drills', () => {
  test('the engine defends, and a finished drill keeps its record across a reload', async ({
    page,
  }) => {
    await page.goto('/drills/endgames')
    await expect(page.getByRole('heading', { level: 1, name: 'Endgame drills' })).toBeVisible()
    await expect(page.getByText('0 of 7 mastered')).toBeVisible()
    await expect(page.getByText('Not tried · par 4')).toBeVisible()

    await page.getByRole('button', { name: /Rule of the square/ }).click()

    // The pawn cannot be caught, whatever the engine does, so the line is the same
    // every run even though the black king's route is the engine's choice.
    await move(page, 'd4', 'd5')
    await expect(page.getByText(/^1\.d5 K[a-h][1-8]/)).toBeVisible()
    await move(page, 'd5', 'd6')
    await expect(page.getByText(/^1\.d5 K[a-h][1-8] 2\.d6 K[a-h][1-8]/)).toBeVisible()
    await move(page, 'd6', 'd7')
    await expect(page.getByText(/3\.d7 K[a-h][1-8]/)).toBeVisible()
    await move(page, 'd7', 'd8')
    await page.getByRole('button', { name: 'queen' }).click()

    const details = page.getByRole('complementary', { name: 'Drill details' })
    await expect(details.getByText('Drill complete · 3 of 3 stars')).toBeVisible()
    await expect(page.getByText('Best 4 · par 4')).toBeVisible()
    await expect(page.getByText('1 of 7 mastered')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Best 4 · par 4')).toBeVisible()
    await expect(page.getByText('1 of 7 mastered')).toBeVisible()
  })

  test('a move is answered by the engine and can be taken back', async ({ page }) => {
    await page.goto('/drills/endgames')
    await page.getByRole('button', { name: /K\+Q vs K/ }).click()
    await expect(page.getByText('No moves yet')).toBeVisible()

    await move(page, 'e2', 'e4')
    await expect(page.getByText(/^1\.Qe4 K[a-h][1-8]/)).toBeVisible()

    await page.getByRole('button', { name: /Take back/ }).click()
    await expect(page.getByText('No moves yet')).toBeVisible()
  })

  test('giving the queen away fails the drill', async ({ page }) => {
    await page.goto('/drills/endgames')
    await page.getByRole('button', { name: /K\+Q vs K/ }).click()

    await move(page, 'e2', 'e5')
    const details = page.getByRole('complementary', { name: 'Drill details' })
    await expect(details.getByText('Drill failed')).toBeVisible()
    await expect(page.getByText('Not won yet · 1 try')).toBeVisible()
  })
})

test.describe('vision drills', () => {
  test.beforeEach(async ({ page }) => {
    // Half-way through every list: the first square is e1, the first knight route b1 to b2.
    await page.addInitScript(() => {
      Math.random = () => 0.5
    })
  })

  test('a timed round scores, ends on the clock and keeps the best', async ({ page }) => {
    await page.clock.install()
    await page.goto('/drills/vision')
    await expect(page.getByRole('heading', { level: 1, name: 'Board vision' })).toBeVisible()
    await expect(page.getByText(/No score yet/)).toBeVisible()

    await page.getByRole('button', { name: /Start the minute/ }).click()
    await page.getByRole('button', { name: 'e', exact: true }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await expect(page.getByText('Square 2')).toBeVisible()

    await page.clock.fastForward('01:01')
    await expect(page.getByText("Time's up")).toBeVisible()

    await page.reload()
    await expect(page.getByText(/Your best:/)).toContainText('1')
  })

  test('the knight route is judged against the shortest path', async ({ page }) => {
    await page.goto('/drills/vision')
    await page.getByRole('button', { name: /Knight route/ }).click()
    await page.getByRole('button', { name: /Start the round/ }).click()
    await expect(page.getByText('b1 to b2')).toBeVisible()

    await move(page, 'b1', 'a3')
    await move(page, 'a3', 'c4')
    await move(page, 'c4', 'b2')
    await expect(page.getByText('b1→b2 in 3')).toBeVisible()
  })

  test('checks, knight and blindfold are all reachable from the cards', async ({ page }) => {
    await page.goto('/drills/vision')
    await page.getByRole('button', { name: /Find all checks/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find all checks')
    await page.getByRole('button', { name: /Blindfold move/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Blindfold move')
    await page.getByRole('button', { name: /Start the round/ }).click()
    await expect(page.getByText('Board hidden')).toBeVisible()
  })
})
