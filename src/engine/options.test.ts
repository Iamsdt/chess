import { describe, expect, it } from 'vitest'

import { makeEngineLine } from '@/domain'

import {
  formatGoCommand,
  formatSetOption,
  pickLineForPersonality,
  scoreToMoverCentipawns,
  strengthOptions,
} from './options'
import { type SearchRequest } from './protocol'
import { START_REQUEST } from './testing/requests'

describe('strengthOptions', () => {
  it('turns the limiter off at full strength', () => {
    expect(strengthOptions({ elo: null })).toEqual([
      { name: 'UCI_LimitStrength', value: 'false' },
      { name: 'Skill Level', value: '20' },
    ])
  })

  it('uses UCI_Elo inside the range the engine supports', () => {
    expect(strengthOptions({ elo: 1500 })).toEqual([
      { name: 'UCI_LimitStrength', value: 'true' },
      { name: 'UCI_Elo', value: '1500' },
      { name: 'Skill Level', value: '20' },
    ])
  })

  it('adds a Skill Level handicap below the engine floor of 1320', () => {
    expect(strengthOptions({ elo: 600 })).toEqual([
      { name: 'UCI_LimitStrength', value: 'true' },
      { name: 'UCI_Elo', value: '1320' },
      { name: 'Skill Level', value: '0' },
    ])
    expect(strengthOptions({ elo: 960 })).toMatchObject([
      {},
      {},
      { name: 'Skill Level', value: '5' },
    ])
  })

  it('clamps a rating the engine cannot honour', () => {
    expect(strengthOptions({ elo: 4000 })).toMatchObject([{}, { value: '3190' }, {}])
    expect(strengthOptions({ elo: 100 })).toMatchObject([{}, { value: '1320' }, { value: '0' }])
  })
})

describe('command formatting', () => {
  it('writes setoption in the form the engine parses', () => {
    expect(formatSetOption({ name: 'MultiPV', value: '3' })).toBe('setoption name MultiPV value 3')
  })

  it('writes every limit it was given', () => {
    const request: SearchRequest = { ...START_REQUEST, depth: 18, movetimeMs: 2000, nodes: 500 }
    expect(formatGoCommand(request)).toBe('go depth 18 movetime 2000 nodes 500')
    expect(formatGoCommand({ ...START_REQUEST, depth: 12 })).toBe('go depth 12')
  })
})

describe('scoreToMoverCentipawns', () => {
  it('orders mates above every centipawn score', () => {
    expect(scoreToMoverCentipawns({ kind: 'cp', value: 120 })).toBe(120)
    expect(scoreToMoverCentipawns({ kind: 'mate', moves: 3 })).toBeGreaterThan(90_000)
    expect(scoreToMoverCentipawns({ kind: 'mate', moves: -3 })).toBeLessThan(-90_000)
    expect(scoreToMoverCentipawns({ kind: 'mate', moves: 1 })).toBeGreaterThan(
      scoreToMoverCentipawns({ kind: 'mate', moves: 5 }),
    )
  })
})

describe('pickLineForPersonality', () => {
  const best = makeEngineLine({
    multipv: 1,
    score: { kind: 'cp', value: 30 },
    wdl: { win: 200, draw: 780, loss: 20 },
  })
  const sharp = makeEngineLine({
    multipv: 2,
    score: { kind: 'cp', value: 20 },
    wdl: { win: 400, draw: 400, loss: 200 },
  })
  const dull = makeEngineLine({
    multipv: 3,
    score: { kind: 'cp', value: 10 },
    wdl: { win: 150, draw: 840, loss: 10 },
  })

  it('plays the top line when solid', () => {
    expect(pickLineForPersonality([best, sharp, dull], 'solid')).toBe(best)
  })

  it('prefers the sharpest near-equal line when aggressive', () => {
    expect(pickLineForPersonality([best, sharp, dull], 'aggressive')).toBe(sharp)
  })

  it('prefers the least drawish near-equal line when tricky', () => {
    expect(pickLineForPersonality([best, sharp, dull], 'tricky')).toBe(sharp)
  })

  it('never plays a line that is simply worse', () => {
    const blunder = makeEngineLine({
      multipv: 2,
      score: { kind: 'cp', value: -400 },
      wdl: { win: 990, draw: 5, loss: 5 },
    })
    expect(pickLineForPersonality([best, blunder], 'aggressive')).toBe(best)
  })

  it('falls back to the least obvious sound line when there is no WDL', () => {
    const a = makeEngineLine({ multipv: 1, score: { kind: 'cp', value: 30 } })
    const b = makeEngineLine({ multipv: 2, score: { kind: 'cp', value: 25 } })
    expect(pickLineForPersonality([a, b], 'tricky')).toBe(b)
  })

  it('has nothing to choose in a finished position', () => {
    expect(pickLineForPersonality([], 'aggressive')).toBeUndefined()
  })
})
