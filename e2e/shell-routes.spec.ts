import { expect, test } from '@playwright/test'

/**
 * S04 acceptance: every prototype screen has a URL that loads and every sidebar entry
 * navigates. The table is written out rather than imported from `src/` so a route that
 * disappears fails here instead of silently shrinking the check.
 */
const ROUTES: readonly (readonly [path: string, heading: string])[] = [
  ['/', 'Today'],
  ['/play', 'New game'],
  ['/play/game', 'Sparring'],
  ['/puzzles', 'Puzzles'],
  ['/puzzles/solve', 'Puzzle'],
  ['/puzzles/rush', 'Puzzle Rush'],
  ['/puzzles/summary', 'Session complete'],
  ['/learn', 'Learn'],
  ['/learn/lesson', 'Lesson'],
  ['/drills/endgames', 'Endgame drills'],
  ['/drills/vision', 'Board vision'],
  ['/mistakes', 'Mistake Bank'],
  ['/games', 'My games'],
  ['/games/review', 'Game review'],
  ['/analysis', 'Analysis'],
  ['/openings', 'Openings'],
  ['/openings/drill', 'Opening drill'],
  ['/friends', 'Friends'],
  ['/friends/live', 'Live game'],
  ['/share', 'Shared challenge'],
  ['/progress', 'Growth'],
  ['/settings', 'Settings'],
  ['/onboarding', 'Welcome'],
  ['/dev/kitchen-sink', 'Kitchen sink'],
]

test.describe('route table', () => {
  for (const [path, heading] of ROUTES) {
    test(`${path} loads as "${heading}"`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))

      await page.goto(path)

      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(page).toHaveTitle(`${heading} · Chess King`)
      expect(errors).toEqual([])
    })
  }

  test('an unrouted URL answers with the 404 inside the shell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/no/such/screen')

    await expect(
      page.getByRole('heading', { level: 1, name: 'That page is not here' }),
    ).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Sidebar' })).toBeVisible()

    await page.getByRole('link', { name: 'Back to Today' }).click()
    await expect(page).toHaveURL('/')
  })

  test('the sidebar navigates and marks the screen it owns', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const sidebar = page.getByRole('complementary', { name: 'Sidebar' })
    await sidebar.getByRole('link', { name: /^Openings/ }).click()

    await expect(page).toHaveURL('/openings')
    await expect(sidebar.getByRole('link', { name: /^Openings/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('onboarding and the gallery keep the shell out of the way', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/onboarding')
    await expect(page.getByRole('complementary', { name: 'Sidebar' })).toHaveCount(0)

    await page.goto('/dev/kitchen-sink')
    await expect(page.getByRole('heading', { level: 1, name: 'Kitchen sink' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Sidebar' })).toHaveCount(0)
  })
})
