import { expect, test } from '@playwright/test'

/**
 * The board's artwork is self-hosted so the app keeps working offline and inside
 * the service-worker precache (S26). A missing or misnamed file is invisible in
 * unit tests — jsdom never fetches an `<img>` — and shows up as an empty square
 * in the browser, so it is checked here against the real server.
 */

const SETS = ['california', 'staunty', 'maestro', 'alpha'] as const
const CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] as const

test.describe('piece sets', () => {
  for (const set of SETS) {
    test(`${set} serves all twelve pieces as SVG`, async ({ request }) => {
      const results = await Promise.all(
        CODES.map(async (code) => {
          const response = await request.get(`/pieces/${set}/${code}.svg`)
          return {
            code,
            status: response.status(),
            type: (response.headers()['content-type'] ?? '').split(';')[0],
            isSvg: (await response.text()).includes('<svg'),
          }
        }),
      )

      expect(results.filter((result) => result.status !== 200)).toEqual([])
      expect(results.filter((result) => result.type !== 'image/svg+xml')).toEqual([])
      expect(results.filter((result) => !result.isSvg)).toEqual([])
    })
  }
})
