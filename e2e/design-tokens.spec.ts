import { expect, test, type Page } from '@playwright/test'

/**
 * The regression net behind "kitchen-sink matches the prototype". A renamed token in
 * `:root` that is not renamed in the `@theme inline` bridge leaves the Tailwind utility
 * resolving to nothing — the element silently loses its colour, and nothing else fails.
 * Pixel baselines cannot catch that on a route this long without being flaky; a
 * computed-style read can, and it gives the same answer in every browser.
 */
test.describe('Grove Bloom tokens', () => {
  /** Reads the bridge the way Tailwind does: `--color-x` must resolve through to a value. */
  async function bridgedTokens(page: Page): Promise<Record<string, string>> {
    const entries = await page.evaluate((): [string, string][] => {
      const styles = getComputedStyle(document.documentElement)
      const names: string[] = []

      // Tailwind emits its theme inside `@layer`, so the declarations live one or more
      // grouping rules down — a top-level-only walk finds nothing.
      const walk = (rules: CSSRuleList): void => {
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) names.push(...rule.style)
          else if (rule instanceof CSSGroupingRule) walk(rule.cssRules)
        }
      }

      for (const sheet of document.styleSheets) {
        try {
          walk(sheet.cssRules)
        } catch {
          // Cross-origin webfont sheet.
        }
      }

      return [...new Set(names.filter((name) => name.startsWith('--color-')))]
        .sort()
        .map((name) => [name, styles.getPropertyValue(name).trim()])
    })

    return Object.fromEntries(entries)
  }

  /** Names whose bridge resolved to nothing — an unresolvable `var()` computes to ''. */
  function unresolved(tokens: Record<string, string>): string[] {
    return Object.entries(tokens)
      .filter(([, value]) => value === '')
      .map(([name]) => name)
  }

  test('every bridged --color-* resolves in light', async ({ page }) => {
    await page.goto('/dev/kitchen-sink')

    const tokens = await bridgedTokens(page)

    expect(Object.keys(tokens).length).toBeGreaterThan(30)
    expect(unresolved(tokens)).toEqual([])
  })

  test('the dark class actually repaints the palette', async ({ page }) => {
    await page.goto('/dev/kitchen-sink')
    const light = await bridgedTokens(page)

    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    const dark = await bridgedTokens(page)

    expect(unresolved(dark)).toEqual([])
    // Backgrounds and text must invert; if `.dark` stopped applying, these would match.
    expect(dark['--color-background']).not.toBe(light['--color-background'])
    expect(dark['--color-foreground']).not.toBe(light['--color-foreground'])
  })

  test('each board theme repaints the squares', async ({ page }) => {
    await page.goto('/dev/kitchen-sink')

    const squaresFor = async (board: string): Promise<string> =>
      page.evaluate((value) => {
        if (value) document.documentElement.dataset.board = value
        else delete document.documentElement.dataset.board
        const styles = getComputedStyle(document.documentElement)
        return [
          styles.getPropertyValue('--vb-light').trim(),
          styles.getPropertyValue('--vb-dark').trim(),
        ].join('/')
      }, board)

    const seen = new Set([await squaresFor('')])
    for (const board of ['walnut', 'slate', 'dusk', 'sand']) {
      const squares = await squaresFor(board)
      expect(squares).not.toBe('/')
      seen.add(squares)
    }

    // Five distinct palettes: grove (the unset default) plus the four named boards.
    expect(seen.size).toBe(5)
  })
})
