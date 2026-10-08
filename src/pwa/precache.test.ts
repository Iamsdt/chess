import { describe, expect, it } from 'vitest'

import { createPrecacheManifest, hashString, isPrecached, type BuildFile } from './precache'

const file = (path: string, revision = 'r1'): BuildFile => ({ path, revision })

describe('isPrecached', () => {
  it.each([
    'index.html',
    'assets/index-abc.js',
    'engine/stockfish-19-lite.wasm',
    'pieces/cburnett/wK.svg',
    'quiz/band-1.csv',
    'manifest.webmanifest',
  ])('keeps %s', (path) => {
    expect(isPrecached(path)).toBe(true)
  })

  it.each([
    'sw.js',
    'assets/index-abc.js.map',
    'engine/Copying.txt',
    'quiz-old/a.csv',
    '.vite/manifest.json',
    '_headers',
  ])('skips %s', (path) => {
    expect(isPrecached(path)).toBe(false)
  })
})

describe('createPrecacheManifest', () => {
  const files = [
    file('index.html'),
    file('assets/app.js'),
    file('assets/lazy.js'),
    file('assets/lazy.css'),
    file('assets/app.js.map'),
    file('engine/stockfish-19-lite.wasm'),
    file('quiz/band-1.csv'),
    file('sw.js'),
  ]

  it('sorts entries and splits core from heavy', () => {
    const { entries } = createPrecacheManifest(files)
    expect(entries.map((entry) => entry.url)).toEqual([
      'assets/app.js',
      'assets/lazy.css',
      'assets/lazy.js',
      'engine/stockfish-19-lite.wasm',
      'index.html',
      'quiz/band-1.csv',
    ])
    expect(entries.filter((entry) => entry.group === 'heavy').map((entry) => entry.url)).toEqual([
      'engine/stockfish-19-lite.wasm',
      'quiz/band-1.csv',
    ])
  })

  it('adds files only the Vite manifest names', () => {
    const { entries } = createPrecacheManifest([file('index.html'), file('chunks/x.js')], {
      'src/x.ts': { file: 'chunks/x.js' },
    })
    expect(entries.map((entry) => entry.url)).toContain('chunks/x.js')
  })

  it('throws when the manifest names a file the build lacks', () => {
    expect(() =>
      createPrecacheManifest([file('index.html')], { a: { file: 'assets/gone.js' } }),
    ).toThrow(/assets\/gone\.js/)
  })

  it('changes version with any revision, and not with order', () => {
    const base = createPrecacheManifest(files).version
    const changed = createPrecacheManifest(
      files.map((f) => (f.path === 'assets/app.js' ? file(f.path, 'r2') : f)),
    ).version
    expect(changed).not.toBe(base)
    expect(createPrecacheManifest([...files].reverse()).version).toBe(base)
  })

  it('ignores files that are not shipped to the cache', () => {
    const base = createPrecacheManifest(files).version
    expect(createPrecacheManifest([...files, file('sw.js', 'other')]).version).toBe(base)
  })
})

describe('hashString', () => {
  it('is stable and discriminating', () => {
    expect(hashString('a')).toBe(hashString('a'))
    expect(hashString('a')).not.toBe(hashString('b'))
  })
})
