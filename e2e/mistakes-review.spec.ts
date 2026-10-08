import { expect, test, type Page } from '@playwright/test'

/**
 * S15's merge gate: **a mistake comes back, is replayed on the real board, and is
 * rescheduled**. The bank is seeded straight into IndexedDB so the spec depends on neither
 * the engine nor an imported puzzle set; what it proves is the review loop itself.
 *
 * The position is a back-rank mate in one (Rd8#), so a single click-to-move pair is the
 * whole line and the spec never races a scripted reply.
 */

const FEN = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'

async function seedBank(page: Page): Promise<void> {
  // The app creates the database on first load; seeding writes into its own stores.
  await page.goto('/mistakes')
  await expect(page.getByRole('heading', { level: 1, name: 'Mistake Bank' })).toBeVisible()
  await page.evaluate(async (fen) => {
    const now = Date.now()
    const open = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('chessking')
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(new Error('could not open the app database'))
      }
    })
    const tx = open.transaction(['mistakes', 'srsCards'], 'readwrite')
    tx.objectStore('mistakes').put({
      id: 'mistake_e2e',
      createdAt: now,
      updatedAt: now,
      source: 'game-review',
      moveNumber: 24,
      fen,
      yourColor: 'white',
      playedSan: 'Kf1',
      playedUci: 'g1f1',
      bestSan: 'Rd8#',
      bestUci: 'd1d8',
      solution: ['d1d8'],
      quality: 'miss',
      evalBefore: { kind: 'mate', moves: 1 },
      evalAfter: { kind: 'cp', value: -900 },
      themes: ['backRankMate'],
      explanation: "Black's king has no escape square. Rd8# ends it right away.",
      originLabel: 'vs Rafi · move 24',
      srsCardId: 'card_e2e',
    })
    tx.objectStore('srsCards').put({
      id: 'card_e2e',
      subject: { kind: 'mistake', mistakeId: 'mistake_e2e' },
      state: 'new',
      due: now - 60_000,
      lastReviewedAt: null,
      stability: 0,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      learningStep: null,
      consecutiveCorrect: 0,
      masteredAt: null,
      createdAt: now,
      updatedAt: now,
    })
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => {
        resolve()
      }
      tx.onerror = () => {
        reject(new Error('seeding failed'))
      }
    })
    open.close()
  }, FEN)
  await page.reload()
}

async function move(page: Page, from: string, to: string): Promise<void> {
  // Scoped to the cells: a selected piece also gets a dot overlay carrying the same attribute.
  const cell = (square: string) =>
    page
      .getByRole('grid', { name: 'Review board' })
      .locator(`[role="gridcell"][data-square="${square}"]`)
  await cell(from).click()
  await cell(to).click()
}

test.describe('the mistake review loop', () => {
  test('finding the move shows the idea and moves the position out of today', async ({ page }) => {
    await seedBank(page)
    await expect(page.getByRole('heading', { level: 2, name: /1\s*due today/ })).toBeVisible()

    await page.getByRole('button', { name: /Start review/ }).click()
    await expect(page.getByRole('grid', { name: 'Review board' })).toBeVisible()

    await move(page, 'd1', 'd8')
    await expect(page.getByText("That's the idea", { exact: true })).toBeVisible()
    await expect(page.getByText('Rd8#', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: /See how it went/ }).click()
    await expect(page.getByText(/1 of 1 recalled/)).toBeVisible()
    await page.getByRole('button', { name: 'Back to the bank' }).click()

    // A recalled new card is in its learning steps, so nothing is due right now.
    await expect(page.getByRole('heading', { level: 2, name: /0\s*due today/ })).toBeVisible()
  })

  test('a wrong move explains the idea you missed, calmly', async ({ page }) => {
    await seedBank(page)
    await page.getByRole('button', { name: /Start review/ }).click()
    await expect(page.getByRole('grid', { name: 'Review board' })).toBeVisible()

    await move(page, 'g1', 'f1')
    await expect(page.getByText('The idea you missed')).toBeVisible()
    await expect(page.getByText('Kf1', { exact: true })).toBeVisible()
    await expect(page.getByText(/no escape square/)).toBeVisible()
    await expect(page.getByText(/Back again in a few minutes/)).toBeVisible()
  })

  test('a reload mid-session leaves the bank intact and the card still schedulable', async ({
    page,
  }) => {
    await seedBank(page)
    await page.getByRole('button', { name: /Start review/ }).click()
    await expect(page.getByRole('grid', { name: 'Review board' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 2, name: /1\s*due today/ })).toBeVisible()
  })
})
