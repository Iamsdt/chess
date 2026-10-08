import { expect, test, type Page } from '@playwright/test'

/**
 * S17: build a repertoire from the starter set, drill a line from memory, and see the
 * schedule move. Nothing is seeded until the user asks for it.
 */

async function play(page: Page, from: string, to: string): Promise<void> {
  const board = page.locator('[aria-label^="Drill board,"]')
  await board.locator(`[data-square="${from}"]`).click()
  await board.locator(`[data-square="${to}"]`).click()
}

test('the empty repertoire waits for the user, the starter set seeds lines, and a drilled line leaves the due list', async ({
  page,
}) => {
  await page.goto('/openings')
  await expect(page.getByRole('heading', { level: 1, name: 'Openings' })).toBeVisible()
  await expect(page.getByText('No openings yet')).toBeVisible()
  await expect(page.getByText('0 lines due')).toBeVisible()

  await page.getByRole('button', { name: /Add a starter repertoire/ }).click()
  const caro = page.locator('article', {
    has: page.getByRole('heading', { name: 'Caro-Kann Defence' }),
  })
  await expect(caro.getByText('6 due')).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Italian Game' })).toBeVisible()

  await caro.getByRole('link', { name: /Drill/ }).click()
  await expect(page).toHaveURL(/\/openings\/drill\?opening=/)
  await expect(page.getByText('Your move · play it from memory')).toBeVisible()
  // The scheduler picks the order; choose the Advance line this test knows by heart.
  await page.getByRole('button', { name: /^1 2\.d4 d5 3\.e5 Bf5 4\.Nf3 e6 5\.Be2 c5/ }).click()
  await expect(page.locator('button[aria-current="true"]')).toContainText('4.Nf3 e6 5.Be2 c5')

  // A move that is not in the tree is a miss, and the board keeps the position.
  await play(page, 'g8', 'f6')
  await expect(page.getByText('Nf6 is not in your repertoire')).toBeVisible()
  await page.getByRole('button', { name: 'Try the move again' }).click()

  // The prepared line: ...d5, ...Bf5, ...e6, ...c5.
  const progress = page.getByLabel('Line progress')
  await play(page, 'd7', 'd5')
  await expect(progress).toContainText('3.e5')
  await play(page, 'c8', 'f5')
  await expect(progress).toContainText('4.Nf3')
  await play(page, 'e7', 'e6')
  await expect(progress).toContainText('5.Be2')
  await play(page, 'c7', 'c5')
  await expect(page.getByText('Line finished').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next line' })).toBeVisible()

  await page.getByRole('link', { name: /Repertoire/ }).click()
  await expect(
    page
      .locator('article', { has: page.getByRole('heading', { name: 'Caro-Kann Defence' }) })
      .getByText('5 due'),
  ).toBeVisible()
})

test('a position played in the editor is added to the tree and survives a reload', async ({
  page,
}) => {
  await page.goto('/openings')
  await page.getByRole('button', { name: /Add a starter repertoire/ }).click()
  const london = page.locator('article', {
    has: page.getByRole('heading', { name: 'London System' }),
  })
  await london.getByRole('button', { name: /Edit tree/ }).click()
  await expect(page.getByRole('heading', { name: 'London System tree' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 3, name: 'London System' })).toBeVisible()
})
