import { describe, expect, it } from 'vitest'

import type { GameRow } from '@/data'
import { makeGameMeta, toGameId, toTimestamp } from '@/domain'

import {
  DEFAULT_FILTERS,
  matchesFilters,
  openingOptions,
  opponentOf,
  outcomeOf,
  rangeStart,
  sortRows,
  toGameFilter,
  yourAccuracy,
} from './library-filters'

import type { LibraryFilters } from './library-filters'

/**
 * The filter bar's meaning, without a DOM.
 *
 * "Won" is the interesting one: it is not a column in the database, it is a relationship
 * between the result and the side the user had, and getting it wrong would quietly
 * mislabel half the library.
 */

const DAY = 86_400_000
const NOW = Date.UTC(2024, 5, 15, 12)

function row(id: string, overrides: Partial<GameRow> = {}): GameRow {
  return { ...makeGameMeta({ id: toGameId(id), ...overrides }) }
}

describe('what "won" means', () => {
  it('reads the result through the side you played', () => {
    expect(outcomeOf({ result: '1-0', youPlay: 'white' })).toBe('won')
    expect(outcomeOf({ result: '1-0', youPlay: 'black' })).toBe('lost')
    expect(outcomeOf({ result: '0-1', youPlay: 'black' })).toBe('won')
    expect(outcomeOf({ result: '1/2-1/2', youPlay: 'white' })).toBe('drawn')
    expect(outcomeOf({ result: '*', youPlay: 'white' })).toBe('unfinished')
  })

  it('picks the other player and your own accuracy', () => {
    const game = row('g1', { youPlay: 'white', accuracy: { white: 84, black: 71 } })
    expect(opponentOf(game).name).toBe(game.black.name)
    expect(yourAccuracy(game)).toBe(84)
    expect(yourAccuracy({ ...game, youPlay: 'black' })).toBe(71)
    expect(yourAccuracy({ ...game, accuracy: undefined })).toBeUndefined()
  })
})

describe('filtering', () => {
  const engineWin = row('g1', { youPlay: 'white', result: '1-0' })
  const humanLoss = row('g2', {
    youPlay: 'black',
    result: '1-0',
    source: 'lichess',
    white: { kind: 'human', name: 'Rafi' },
    black: { kind: 'you', name: 'me' },
    opening: { eco: 'B22', name: 'Sicilian Defense', variation: 'Alapin' },
    accuracy: { white: 90, black: 61 },
  })

  const with_ = (overrides: Partial<LibraryFilters>): LibraryFilters => ({
    ...DEFAULT_FILTERS,
    ...overrides,
  })

  it('passes everything by default', () => {
    expect(matchesFilters(engineWin, DEFAULT_FILTERS)).toBe(true)
    expect(matchesFilters(humanLoss, DEFAULT_FILTERS)).toBe(true)
  })

  it('separates wins from losses', () => {
    expect(matchesFilters(engineWin, with_({ result: 'won' }))).toBe(true)
    expect(matchesFilters(humanLoss, with_({ result: 'won' }))).toBe(false)
    expect(matchesFilters(humanLoss, with_({ result: 'lost' }))).toBe(true)
  })

  it('tells engines, people and imports apart', () => {
    expect(matchesFilters(engineWin, with_({ opponent: 'engine' }))).toBe(true)
    expect(matchesFilters(humanLoss, with_({ opponent: 'engine' }))).toBe(false)
    expect(matchesFilters(humanLoss, with_({ opponent: 'human' }))).toBe(true)
    expect(matchesFilters(humanLoss, with_({ opponent: 'imported' }))).toBe(true)
    expect(matchesFilters(engineWin, with_({ opponent: 'imported' }))).toBe(false)
  })

  it('matches an opening by code and a player by substring', () => {
    expect(matchesFilters(humanLoss, with_({ eco: 'B22' }))).toBe(true)
    expect(matchesFilters(engineWin, with_({ eco: 'B22' }))).toBe(false)
    expect(matchesFilters(humanLoss, with_({ search: 'rafi' }))).toBe(true)
    expect(matchesFilters(humanLoss, with_({ search: 'alapin' }))).toBe(true)
    expect(matchesFilters(humanLoss, with_({ search: 'nobody' }))).toBe(false)
  })

  it('applies an accuracy floor to your own side only', () => {
    expect(matchesFilters(humanLoss, with_({ minAccuracy: 70 }))).toBe(false)
    expect(matchesFilters(humanLoss, with_({ minAccuracy: 60 }))).toBe(true)
  })

  it('turns a date range into an indexable window', () => {
    expect(toGameFilter('all', NOW)).toEqual({})
    expect(toGameFilter('7d', NOW).from).toBe(NOW - 7 * DAY)
    expect(rangeStart('year', NOW)).toBe(Date.UTC(2024, 0, 1))
  })
})

describe('sorting', () => {
  const rows = [
    row('a', { startedAt: toTimestamp(300), plyCount: 10, accuracy: { white: 50, black: 50 } }),
    row('b', { startedAt: toTimestamp(100), plyCount: 90, accuracy: { white: 95, black: 10 } }),
    row('c', { startedAt: toTimestamp(200), plyCount: 40, accuracy: undefined }),
  ]

  it('defaults to newest first', () => {
    expect(sortRows(rows, { column: 'date', direction: 'desc' }).map((game) => game.id)).toEqual([
      'a',
      'c',
      'b',
    ])
  })

  it('reverses on demand', () => {
    expect(sortRows(rows, { column: 'moves', direction: 'asc' }).map((game) => game.id)).toEqual([
      'a',
      'c',
      'b',
    ])
    expect(sortRows(rows, { column: 'moves', direction: 'desc' }).map((game) => game.id)).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('sorts a game with no accuracy last', () => {
    expect(sortRows(rows, { column: 'accuracy', direction: 'desc' }).at(-1)?.id).toBe('c')
  })

  it('never mutates the array it was given', () => {
    const before = rows.map((game) => game.id)
    sortRows(rows, { column: 'opponent', direction: 'asc' })
    expect(rows.map((game) => game.id)).toEqual(before)
  })
})

describe('the opening chips', () => {
  it('offers the most played openings, commonest first', () => {
    const rows = [
      row('a', { opening: { eco: 'C54', name: 'Italian Game' } }),
      row('b', { opening: { eco: 'C54', name: 'Italian Game' } }),
      row('c', { opening: { eco: 'B22', name: 'Sicilian Defense' } }),
      row('d', { opening: undefined }),
    ]
    expect(openingOptions(rows)).toEqual([
      { eco: 'C54', name: 'Italian Game', count: 2 },
      { eco: 'B22', name: 'Sicilian Defense', count: 1 },
    ])
  })
})
