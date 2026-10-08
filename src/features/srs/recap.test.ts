import { describe, expect, it } from 'vitest'

import { toUci } from '@/domain'

import { lineMistake } from './fixtures'
import { buildRecap } from './recap'

describe('buildRecap', () => {
  it('names the move played, the better move, and the line, from stored data alone', () => {
    const recap = buildRecap(lineMistake('a'))
    expect(recap.playedSan).toBe('Qe7')
    expect(recap.bestSan).toBe('Qf3+')
    expect(recap.line).toHaveLength(3)
    expect(recap.line[0]).toBe('Qf3+')
    expect(recap.skipped).toBe(false)
  })

  it('describes the swing from the player’s own side', () => {
    // 0.30 before; after the move the opponent saw +1.40, which is -1.40 for the player.
    const recap = buildRecap(
      lineMistake('a', {
        evalBefore: { kind: 'cp', value: 30 },
        evalAfter: { kind: 'cp', value: 140 },
      }),
    )
    expect(recap.evalNote).toBe(
      'Before your move the position was about +0.30 for you. After it, about -1.40.',
    )
  })

  it('leaves the engine reading out for a puzzle, which never had one', () => {
    expect(buildRecap(lineMistake('a', { source: 'puzzle' })).evalNote).toBeNull()
  })

  it('marks a skipped puzzle, where the played move is the best move', () => {
    const recap = buildRecap(
      lineMistake('a', {
        source: 'puzzle',
        playedUci: toUci('f6f3'),
        playedSan: lineMistake('a').bestSan,
      }),
    )
    expect(recap.skipped).toBe(true)
  })

  it('keeps the explanation and survives a line that does not replay', () => {
    const recap = buildRecap(lineMistake('a', { solution: [toUci('a1a2')] }))
    expect(recap.line).toEqual([])
    expect(recap.explanation).toBeTruthy()
  })
})
