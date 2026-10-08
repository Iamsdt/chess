import { describe, expect, it } from 'vitest'

/**
 * S02 · "Zero raw hex outside tokens", kept true.
 *
 * Colour belongs in `globals.css` as a Grove Bloom token, so a theme switch (light, dark,
 * a new board theme) restyles every screen at once. A literal like `bg-[#3b4a44]` in a
 * component silently ignores the dark theme, which is how these crept in. This fails on
 * the next one.
 */

const sources = import.meta.glob<string>(['/src/**/*.ts', '/src/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * Files allowed to hold a hex literal, and why. Shrink this list; never grow it.
 * Each of the screens below belongs to a sprint that has not been redesigned onto tokens yet.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  '/src/content/tutorial-pack.ts': 'data: the converted tutorials name arrow colours by hex',
  '/src/features/friends/live-game-screen.tsx': 'friends redesign pending',
  '/src/features/friends/friends-screen.tsx': 'friends redesign pending',
  '/src/features/share/shared-challenge-screen.tsx': 'share redesign pending',
}

/** `#` + 3, 4, 6 or 8 hex digits, not glued to a word (so `lila#11148` and `&#x27;` pass). */
const HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g

const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || path.includes('/testing/')

describe('design tokens', () => {
  it('finds the source files it is supposed to police', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100)
  })

  it('keeps raw hex colours out of source, outside the allowlist', () => {
    const offenders: string[] = []
    for (const [path, text] of Object.entries(sources)) {
      if (isTest(path) || path in ALLOWED) continue
      const lines = text.split('\n')
      for (const [index, line] of lines.entries()) {
        const found = line.match(HEX)
        if (found !== null) offenders.push(`${path}:${String(index + 1)} ${found.join(' ')}`)
      }
    }
    expect(offenders, 'Use a token from globals.css, or add one in both themes').toEqual([])
  })

  it('does not allowlist a file that is already clean', () => {
    const stale = Object.keys(ALLOWED).filter((path) => {
      const text = sources[path]
      return text === undefined || !new RegExp(HEX.source).test(text)
    })
    expect(stale).toEqual([])
  })
})
