import { describe, expect, it } from 'vitest'

import { createGame, applyMove } from '@/chess'
import type { Fen } from '@/domain'

import { computeCoverage } from './gaps'
import { ecoDistribution, type MoveDistribution, type OpponentMove } from './popularity'
import { emptyTree, testContext } from './test-helpers'
import { addLine, type RepertoireTree } from './tree'

function reply(fen: Fen, uci: string, popularity: number): OpponentMove {
  const started = createGame(fen)
  if (!started.ok) throw new Error('bad fen')
  const played = applyMove(started.value, uci)
  if (!played.ok) throw new Error(`illegal ${uci}`)
  const made = played.value.history.at(-1)
  if (made === undefined) throw new Error('no move')
  return { san: made.san, uci, popularity, fenAfter: played.value.fen }
}

/** A fixture explorer: what a club player's opponents play, to the percent. */
function fixtureDistribution(): MoveDistribution {
  const table = new Map<string, readonly [string, number][]>([
    [
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -',
      [
        ['e7e5', 45],
        ['c7c5', 30],
        ['e7e6', 15],
        ['c7c6', 7],
        ['a7a6', 3],
      ],
    ],
  ])
  return (fen) => {
    const key = fen.split(' ').slice(0, 4).join(' ')
    const rows = table.get(key)
    return rows === undefined ? [] : rows.map(([uci, share]) => reply(fen, uci, share))
  }
}

function tree(...lines: string[]): RepertoireTree {
  let current = emptyTree('white')
  for (const line of lines) {
    const edit = addLine(current, current.rootId, line.split(' '), testContext())
    if (!edit.ok) throw new Error(edit.error.message)
    current = edit.value.tree
  }
  return current
}

describe('computeCoverage on a fixture', () => {
  it('reports each popular unanswered reply, most important first, and ignores noise', () => {
    // Prepared: 1.e4 e5 2.Nf3 and 1.e4 c5 2.Nf3. Missing: 1...e6 (15%) and 1...c6 (7%, noise).
    const report = computeCoverage(tree('e4 e5 Nf3', 'e4 c5 Nf3'), fixtureDistribution())
    expect(report.gaps.map((gap) => [gap.san, gap.popularity, gap.kind, gap.path])).toEqual([
      ['e6', 15, 'missing-reply', '1.e4'],
    ])
    expect(report.coveragePercent).toBe(83)
    expect(report.checkedPositions).toBeGreaterThan(0)
    expect(report.lines).toBe(2)
  })

  it('lowering the threshold surfaces the smaller reply too', () => {
    const report = computeCoverage(tree('e4 e5 Nf3', 'e4 c5 Nf3'), fixtureDistribution(), {
      threshold: 5,
    })
    expect(report.gaps.map((gap) => gap.san)).toEqual(['e6', 'c6'])
  })

  it('reports a reply that was added but never answered', () => {
    const report = computeCoverage(tree('e4 e5 Nf3', 'e4 c5 Nf3', 'e4 e6'), fixtureDistribution())
    const gap = report.gaps.find((entry) => entry.san === 'e6')
    expect(gap?.kind).toBe('no-answer')
  })

  it('is fully covered once every popular reply has an answer', () => {
    const prepared = tree('e4 e5 Nf3', 'e4 c5 Nf3', 'e4 e6 d4')
    const report = computeCoverage(prepared, fixtureDistribution())
    expect(report.gaps).toEqual([])
    expect(report.coveragePercent).toBe(100)
  })

  it('counts a reply as covered when another move order already answers that position', () => {
    // 1.Nf3 Nc6 2.e4 has no 2...e5 child, but 1.e4 e5 2.Nf3 Nc6 reaches that position
    // and has a prepared 3.Bc4.
    const prepared = tree('e4 e5 Nf3 Nc6 Bc4', 'Nf3 Nc6 e4')
    const afterE4 = 'r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' as Fen
    const distribution: MoveDistribution = (fen) => {
      if (fen.split(' ').slice(0, 4).join(' ') === afterE4.split(' ').slice(0, 4).join(' ')) {
        return [reply(fen, 'e7e5', 60)]
      }
      return []
    }
    const report = computeCoverage(prepared, distribution)
    expect(report.gaps).toEqual([])
  })

  it('has nothing to say outside the distribution, rather than inventing gaps', () => {
    const report = computeCoverage(tree('d4 d5 c4'), fixtureDistribution())
    expect(report.gaps).toEqual([])
    expect(report.coveragePercent).toBe(100)
  })
})

describe('ecoDistribution', () => {
  it('weights named replies and keeps the main replies on top, summing near 100', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' as Fen
    const moves = ecoDistribution(fen)
    expect(moves.length).toBeGreaterThan(3)
    expect(moves.map((move) => move.san)).toContain('c5')
    expect(moves.map((move) => move.san)).toContain('e5')
    const sum = moves.reduce((total, move) => total + move.popularity, 0)
    expect(sum).toBeGreaterThanOrEqual(95)
    expect(sum).toBeLessThanOrEqual(105)
  })

  it('is empty once the position leaves the book', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' as Fen
    const started = createGame(fen)
    if (!started.ok) throw new Error('fen')
    const odd = applyMove(started.value, 'a2a3')
    if (!odd.ok) throw new Error('move')
    const deeper = applyMove(odd.value, 'h7h6')
    if (!deeper.ok) throw new Error('move')
    const further = applyMove(deeper.value, 'a3a4')
    if (!further.ok) throw new Error('move')
    expect(ecoDistribution(further.value.fen)).toEqual([])
  })
})
