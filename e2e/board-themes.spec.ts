import { expect, test, type Page } from '@playwright/test'

/**
 * Themes, covered by computed style rather than by pixel snapshot.
 *
 * Why not screenshots: a per-theme baseline is tied to one browser build, and a
 * baseline generated anywhere but CI's pinned Chromium fails the moment CI runs
 * it. Reading the tokens the board actually paints with answers the same
 * question — "does switching the board theme repaint the squares?" — identically
 * in every browser, and points straight at the token that broke.
 *
 * `e2e/design-tokens.spec.ts` already checks that `--vb-light`/`--vb-dark` differ
 * per theme. This spec covers the rest of the board's palette: the highlight, the
 * selection, the focus ring and the three arrow colours, every one of which is
 * consumed by `src/board/board.css` and by nothing else.
 */

/** Every token `src/board/board.css` reads, in the order the board uses them. */
const BOARD_TOKENS = [
  '--vb-light',
  '--vb-dark',
  '--vb-hl',
  '--vb-sel',
  '--vb-focus',
  '--vb-arrow',
  '--vb-arrow-alt',
  '--vb-arrow-ai',
] as const

const BOARD_THEMES = ['', 'walnut', 'slate', 'dusk', 'sand'] as const

async function boardPalette(page: Page, board: string): Promise<Record<string, string>> {
  return page.evaluate(
    ({ value, names }) => {
      if (value) document.documentElement.dataset.board = value
      else delete document.documentElement.dataset.board
      const styles = getComputedStyle(document.documentElement)
      return Object.fromEntries(names.map((name) => [name, styles.getPropertyValue(name).trim()]))
    },
    { value: board, names: [...BOARD_TOKENS] },
  )
}

test.describe('board palettes', () => {
  test('every board token resolves in every theme', async ({ page }) => {
    await page.goto('/dev/kitchen-sink')

    for (const board of BOARD_THEMES) {
      const palette = await boardPalette(page, board)
      const missing = Object.entries(palette)
        .filter(([, value]) => value === '')
        .map(([name]) => name)
      expect(missing, `board theme "${board || 'grove'}"`).toEqual([])
    }
  })

  test('the five board themes paint five different squares', async ({ page }) => {
    await page.goto('/dev/kitchen-sink')

    const squares = new Set<string>()
    for (const board of BOARD_THEMES) {
      const palette = await boardPalette(page, board)
      squares.add([palette['--vb-light'], palette['--vb-dark']].join('/'))
    }

    expect(squares.size).toBe(BOARD_THEMES.length)
  })

  test('dark mode repaints the squares and the best-move arrow', async ({ page }) => {
    await page.goto('/dev/kitchen-sink')
    const light = await boardPalette(page, '')

    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    const dark = await boardPalette(page, '')

    expect(dark['--vb-light']).not.toBe(light['--vb-light'])
    expect(dark['--vb-dark']).not.toBe(light['--vb-dark'])
    // The green arrow has to lift off a dark board, or the best move disappears.
    expect(dark['--vb-arrow']).not.toBe(light['--vb-arrow'])
  })
})
