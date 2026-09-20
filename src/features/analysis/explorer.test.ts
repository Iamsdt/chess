import { describe, expect, it, vi } from 'vitest'

import { START_FEN } from '@/domain'

import { EXPLORER_SOURCE_LABEL, LICHESS_MASTERS_URL, lookupExplorer } from './explorer'

/** One master position, in the shape the Lichess explorer actually answers with. */
const MASTERS_RESPONSE = {
  white: 1000,
  draws: 1000,
  black: 1000,
  moves: [
    { uci: 'e2e4', san: 'e4', white: 360, draws: 390, black: 250, averageRating: 2521 },
    { uci: 'd2d4', san: 'd4', white: 1, draws: 1, black: 1 },
  ],
  opening: { eco: 'B00', name: "King's Pawn Game" },
  topGames: [],
}

function respondWith(body: unknown, status = 200) {
  return vi.fn<typeof globalThis.fetch>(async () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

describe('lookupExplorer offline', () => {
  it('never reaches for the network when the device says it is offline', async () => {
    const fetchImpl = vi.fn()
    const result = await lookupExplorer(START_FEN, {
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
      isOnline: () => false,
    })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('network')
    expect(result.error.message).toContain('offline')
    expect(result.error.where).toBe(EXPLORER_SOURCE_LABEL)
  })

  it('reports a failed request as something the player can ignore', async () => {
    const fetchImpl = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))
    const result = await lookupExplorer(START_FEN, {
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
      isOnline: () => true,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('network')
    expect(result.error.message).toContain('Analysis works offline')
  })

  it('calls a cancelled lookup cancelled, not broken', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn(async () => Promise.reject(new DOMException('Aborted', 'AbortError')))
    const result = await lookupExplorer(START_FEN, {
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
      isOnline: () => true,
      signal: controller.signal,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('cancelled')
  })
})

describe('lookupExplorer online', () => {
  it('sends the position and nothing else', async () => {
    const fetchImpl = respondWith(MASTERS_RESPONSE)
    await lookupExplorer(START_FEN, { fetchImpl, isOnline: () => true })

    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe(`${LICHESS_MASTERS_URL}?fen=${encodeURIComponent(START_FEN)}`)
    expect(url).not.toContain('&')
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
  })

  it('turns the counts into percentages that add up', async () => {
    const result = await lookupExplorer(START_FEN, {
      fetchImpl: respondWith(MASTERS_RESPONSE),
      isOnline: () => true,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.totalGames).toBe(3000)
    expect(result.value.openingName).toBe("King's Pawn Game")

    const first = result.value.moves[0]
    expect(first).toMatchObject({ san: 'e4', games: 1000, whitePercent: 36, drawPercent: 39 })
    if (first === undefined) return
    expect(first.whitePercent + first.drawPercent + first.blackPercent).toBe(100)
  })

  it('treats an error status as a failed lookup', async () => {
    const result = await lookupExplorer(START_FEN, {
      fetchImpl: respondWith({}, 429),
      isOnline: () => true,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('429')
  })

  it('refuses a payload that is not the shape it promised', async () => {
    const result = await lookupExplorer(START_FEN, {
      fetchImpl: respondWith({ white: 1, draws: 1, black: 1, moves: [{ uci: 'nonsense' }] }),
      isOnline: () => true,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('validation')
  })

  it('survives an answer that is not JSON at all', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.resolve(new Response('<html>nope</html>', { status: 200 })),
    ) as unknown as typeof globalThis.fetch
    const result = await lookupExplorer(START_FEN, { fetchImpl, isOnline: () => true })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('network')
  })
})
