import { describe, expect, it } from 'vitest'

import type { Result } from '@/domain'

import { CHESSCOM_ORIGIN, LICHESS_ORIGIN, chesscomFeed, lichessFeed } from './providers'

import type { FeedChunk } from './import-service'
import type { FetchLike, ProviderDeps } from './providers'

/**
 * Lichess and Chess.com, against a stub.
 *
 * Nothing here touches the network: the suite must pass on a plane, and a test that
 * depended on a third party would fail for reasons that have nothing to do with this
 * code. What is being checked is the contract this app relies on — the URL shape, the
 * retry policy, and that every failure arrives as a value.
 */

interface Call {
  readonly url: string
}

function stubFetch(handler: (url: string, call: number) => Response | Promise<Response> | Error): {
  readonly fetch: FetchLike
  readonly calls: Call[]
} {
  const calls: Call[] = []
  const fetchImpl: FetchLike = async (url) => {
    calls.push({ url })
    const answer = await handler(url, calls.length)
    if (answer instanceof Error) throw answer
    return answer
  }
  return { fetch: fetchImpl, calls }
}

const slept: number[] = []
const deps = (fetchImpl: FetchLike): ProviderDeps => ({
  fetch: fetchImpl,
  sleep: (ms) => {
    slept.push(ms)
    return Promise.resolve()
  },
})

async function drain(feed: ReturnType<typeof lichessFeed>): Promise<Result<FeedChunk>[]> {
  const chunks: Result<FeedChunk>[] = []
  for await (const chunk of feed()) chunks.push(chunk)
  return chunks
}

const PGN = '[Event "One"]\n[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n'

describe('the Lichess feed', () => {
  it('asks for a PGN export of one user', async () => {
    const stub = stubFetch(() => new Response(PGN, { status: 200 }))
    const chunks = await drain(
      lichessFeed({ username: 'bishop bard', max: 50, rated: true, since: 1000 }, deps(stub.fetch)),
    )

    expect(stub.calls[0]?.url).toContain(`${LICHESS_ORIGIN}/api/games/user/bishop%20bard`)
    expect(stub.calls[0]?.url).toContain('max=50')
    expect(stub.calls[0]?.url).toContain('rated=true')
    expect(stub.calls[0]?.url).toContain('since=1000')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.ok).toBe(true)
  })

  it('names the account when there is no such user', async () => {
    const stub = stubFetch(() => new Response('', { status: 404 }))
    const chunks = await drain(lichessFeed({ username: 'nobody' }, deps(stub.fetch)))
    const first = chunks[0]
    expect(first?.ok).toBe(false)
    if (first === undefined || first.ok) return
    expect(first.error.code).toBe('not-found')
  })

  it('waits out a rate limit and tries again', async () => {
    slept.length = 0
    const stub = stubFetch((_url, call) =>
      call === 1
        ? new Response('', { status: 429, headers: { 'retry-after': '2' } })
        : new Response(PGN, { status: 200 }),
    )
    const chunks = await drain(lichessFeed({ username: 'bishop_bard' }, deps(stub.fetch)))
    expect(slept).toEqual([2000])
    expect(stub.calls).toHaveLength(2)
    expect(chunks[0]?.ok).toBe(true)
  })

  it('gives up with advice when the rate limit will not lift', async () => {
    slept.length = 0
    const stub = stubFetch(
      () => new Response('', { status: 429, headers: { 'retry-after': '30' } }),
    )
    const chunks = await drain(lichessFeed({ username: 'bishop_bard' }, deps(stub.fetch)))
    const first = chunks[0]
    expect(first?.ok).toBe(false)
    if (first === undefined || first.ok) return
    expect(first.error.code).toBe('network')
    expect(first.error.message).toContain('30 seconds')
  })

  it('reads a dead network as being offline', async () => {
    const stub = stubFetch(() => new TypeError('Failed to fetch'))
    const chunks = await drain(lichessFeed({ username: 'bishop_bard' }, deps(stub.fetch)))
    const first = chunks[0]
    expect(first?.ok).toBe(false)
    if (first === undefined || first.ok) return
    expect(first.error.code).toBe('network')
    expect(first.error.message).toContain('offline')
  })

  it('stops before the request when already cancelled', async () => {
    const stub = stubFetch(() => new Response(PGN, { status: 200 }))
    const controller = new AbortController()
    controller.abort()
    const chunks: Result<FeedChunk>[] = []
    for await (const chunk of lichessFeed({ username: 'x' }, deps(stub.fetch))(controller.signal)) {
      chunks.push(chunk)
    }
    expect(stub.calls).toHaveLength(0)
    const first = chunks[0]
    if (first === undefined || first.ok) {
      expect.fail('expected a cancelled result')
      return
    }
    expect(first.error.code).toBe('cancelled')
  })
})

describe('the Chess.com feed', () => {
  const archives = {
    archives: [
      'https://api.chess.com/pub/player/knightowl77/games/2024/01',
      'https://api.chess.com/pub/player/knightowl77/games/2024/02',
      'https://api.chess.com/pub/player/knightowl77/games/2024/03',
    ],
  }

  it('walks the monthly archives newest first', async () => {
    const stub = stubFetch((url) =>
      url.endsWith('/archives')
        ? new Response(JSON.stringify(archives), { status: 200 })
        : new Response(PGN, { status: 200 }),
    )
    const chunks: Result<FeedChunk>[] = []
    for await (const chunk of chesscomFeed(
      { username: 'KnightOwl77', months: 2 },
      deps(stub.fetch),
    )()) {
      chunks.push(chunk)
    }

    expect(stub.calls[0]?.url).toBe(`${CHESSCOM_ORIGIN}/pub/player/knightowl77/games/archives`)
    expect(stub.calls[1]?.url).toContain('2024/03/pgn')
    expect(stub.calls[2]?.url).toContain('2024/02/pgn')
    expect(chunks).toHaveLength(2)
    const first = chunks[0]
    expect(first?.ok).toBe(true)
    if (!first?.ok) return
    expect(first.value.label).toBe('2024-03 · KnightOwl77')
    expect(first.value.total).toBe(2)
  })

  it('refuses an archive list it cannot read', async () => {
    const stub = stubFetch(() => new Response('not json', { status: 200 }))
    const chunks: Result<FeedChunk>[] = []
    for await (const chunk of chesscomFeed({ username: 'x' }, deps(stub.fetch))()) {
      chunks.push(chunk)
    }
    const first = chunks[0]
    expect(first?.ok).toBe(false)
    if (first === undefined || first.ok) return
    expect(first.error.code).toBe('validation')
  })

  it('stops at the month it could not download', async () => {
    const stub = stubFetch((url) =>
      url.endsWith('/archives')
        ? new Response(JSON.stringify(archives), { status: 200 })
        : new Response('', { status: 403 }),
    )
    const chunks: Result<FeedChunk>[] = []
    for await (const chunk of chesscomFeed({ username: 'x' }, deps(stub.fetch))()) {
      chunks.push(chunk)
    }
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.ok).toBe(false)
  })
})
