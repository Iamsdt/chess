import { describe, expect, it } from 'vitest'

import { actionHref, readActionHref } from './action-href'

describe('action hrefs', () => {
  it('round-trips a path and its parameters, dropping undefined ones', () => {
    const href = actionHref('/puzzles/solve', { theme: 'back rank', goal: 5, skipped: undefined })
    const target = readActionHref(href)
    expect(target?.path).toBe('/puzzles/solve')
    expect(target?.params.get('theme')).toBe('back rank')
    expect(target?.params.get('goal')).toBe('5')
    expect(target?.params.has('skipped')).toBe(false)
  })

  it('refuses paths outside the allow-list and missing hrefs', () => {
    expect(readActionHref('/settings')).toBeUndefined()
    expect(readActionHref('https://example.com/drills/vision')).toBeUndefined()
    expect(readActionHref(undefined)).toBeUndefined()
  })
})
