import { describe, expect, it } from 'vitest'

import {
  chooseStrategy,
  planInstall,
  precacheCacheName,
  staleCacheNames,
  withIsolationHeaders,
  type RouteInput,
} from './sw-routing'

const scope = new URL('https://chess.test/')

function route(path: string, overrides: Partial<RouteInput> = {}): RouteInput {
  return {
    url: new URL(path, scope),
    method: 'GET',
    mode: 'cors',
    hasRange: false,
    scope,
    ...overrides,
  }
}

describe('chooseStrategy', () => {
  it('serves navigations from the shell', () => {
    expect(chooseStrategy(route('/play', { mode: 'navigate' }))).toBe('navigate')
  })

  it.each(['/assets/a.js', '/engine/stockfish-19-lite.wasm', '/pieces/x.svg', '/quiz/b.csv'])(
    'caches %s first',
    (path) => {
      expect(chooseStrategy(route(path))).toBe('cache-first')
    },
  )

  it('never touches the worker script, writes or range requests', () => {
    expect(chooseStrategy(route('/sw.js'))).toBe('bypass')
    expect(chooseStrategy(route('/assets/a.js', { method: 'POST' }))).toBe('bypass')
    expect(chooseStrategy(route('/engine/a.wasm', { hasRange: true }))).toBe('bypass')
  })

  it('bypasses API traffic but revalidates fonts', () => {
    expect(chooseStrategy(route('https://lichess.org/api/games'))).toBe('bypass')
    expect(chooseStrategy(route('https://api.anthropic.com/v1/messages'))).toBe('bypass')
    expect(chooseStrategy(route('https://fonts.gstatic.com/s/a.woff2'))).toBe(
      'stale-while-revalidate',
    )
  })

  it('tries the network first for other same-origin files', () => {
    expect(chooseStrategy(route('/vite.svg'))).toBe('network-first')
  })

  it('respects a sub-path scope', () => {
    const sub = new URL('https://chess.test/app/')
    const input: RouteInput = {
      url: new URL('https://chess.test/app/assets/a.js'),
      method: 'GET',
      mode: 'cors',
      hasRange: false,
      scope: sub,
    }
    expect(chooseStrategy(input)).toBe('cache-first')
  })
})

describe('planInstall', () => {
  const entries = [
    { url: 'a.js', revision: '1', group: 'core' as const },
    { url: 'b.js', revision: '2', group: 'core' as const },
  ]

  it('fetches everything on a first install', () => {
    expect(planInstall(entries, null)).toEqual({ reuse: [], fetch: entries })
  })

  it('reuses only unchanged revisions', () => {
    const plan = planInstall(entries, { cacheName: 'old', revisions: { 'a.js': '1', 'b.js': '9' } })
    expect(plan.reuse.map((entry) => entry.url)).toEqual(['a.js'])
    expect(plan.fetch.map((entry) => entry.url)).toEqual(['b.js'])
  })
})

describe('staleCacheNames', () => {
  it('drops older precaches and keeps the rest', () => {
    const names = [
      precacheCacheName('old'),
      precacheCacheName('new'),
      'ck-runtime-v1',
      'ck-meta',
      'other',
    ]
    expect(staleCacheNames(names, 'new')).toEqual([precacheCacheName('old')])
  })
})

describe('withIsolationHeaders', () => {
  it('stamps COOP and COEP on a response that lacks them', async () => {
    const out = withIsolationHeaders(
      new Response('x', { headers: { 'content-type': 'text/html' } }),
    )
    expect(out.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin')
    expect(out.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp')
    expect(out.headers.get('content-type')).toBe('text/html')
    expect(await out.text()).toBe('x')
  })

  it('returns an already isolated response untouched', () => {
    const response = new Response('x', {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    })
    expect(withIsolationHeaders(response)).toBe(response)
  })

  it('overrides a wrong value', () => {
    const out = withIsolationHeaders(
      new Response('x', { headers: { 'Cross-Origin-Embedder-Policy': 'unsafe-none' } }),
    )
    expect(out.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp')
  })
})
