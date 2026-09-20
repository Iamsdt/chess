import { describe, expect, it } from 'vitest'

import {
  FIXTURE_NOW,
  fixtureTimeAfter,
  makeGame,
  makeGameMeta,
  makeMoveRecord,
  makePuzzle,
  makeSettings,
  withOverrides,
} from './fixtures'
import { toGameId } from './ids'
import { toSan } from './primitives'

describe('fixture factories', () => {
  it('return the same value every call, so golden diffs stay quiet', () => {
    expect(makeGame()).toEqual(makeGame())
    expect(makePuzzle()).toEqual(makePuzzle())
    expect(makeSettings()).toEqual(makeSettings())
  })

  it('return a fresh object each call, so one test cannot poison another', () => {
    const first = makePuzzle()
    const second = makePuzzle()
    expect(first).not.toBe(second)
    first.tags.push('mutated')
    expect(second.tags).not.toContain('mutated')
  })

  it('apply overrides on top of the base value', () => {
    const meta = makeGameMeta({ result: '0-1', youPlay: 'black' })
    expect(meta.result).toBe('0-1')
    expect(meta.youPlay).toBe('black')
    expect(meta.id).toBe(makeGameMeta().id)
  })

  it('accept a branded override without a cast', () => {
    const move = makeMoveRecord({ gameId: toGameId('other-game'), san: toSan('Bxf7+') })
    expect(move.gameId).toBe('other-game')
    expect(move.san).toBe('Bxf7+')
  })

  it('shifts the clock through one helper', () => {
    expect(fixtureTimeAfter(10)).toBe(FIXTURE_NOW + 600_000)
  })

  it('leaves the base untouched when no overrides are given', () => {
    const base = { a: 1, b: 'two' }
    expect(withOverrides(base)).toBe(base)
    expect(withOverrides(base, { a: 3 })).toEqual({ a: 3, b: 'two' })
  })
})
