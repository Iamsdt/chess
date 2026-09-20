import { describe, expect, it } from 'vitest'

import { MOVE_QUALITIES, toFen, toUci, type EngineScore, type MoveQuality } from '@/domain'

import { classifyMove, classifyMoveDetailed, countMoveQualities } from './classify'

const cp = (value: number): EngineScore => ({ kind: 'cp', value })
const mate = (moves: number): EngineScore => ({ kind: 'mate', moves })

/**
 * Both scores are from the side to move in their own position, which is what an engine
 * reports: `after` is therefore from the *opponent's* point of view, and a good move for
 * White makes it more negative.
 */
function classifyWhite(before: number, after: number, extra = {}): MoveQuality {
  return classifyMove({
    mover: 'white',
    scoreBefore: cp(before),
    scoreAfter: cp(-after),
    playedUci: toUci('e2e4'),
    ...extra,
  })
}

describe('the measuring stick', () => {
  it('reports the win percentages it judged from', () => {
    const detail = classifyMoveDetailed({
      mover: 'white',
      scoreBefore: cp(0),
      scoreAfter: cp(0),
      playedUci: toUci('e2e4'),
    })
    expect(detail.winPercentBefore).toBe(50)
    expect(detail.winPercentAfter).toBe(50)
    expect(detail.winPercentLost).toBe(0)
  })

  it('flips the after-score, because the opponent is to move there', () => {
    // White goes from level to a rook down: catastrophic.
    expect(classifyWhite(0, -500)).toBe('blunder')
    // The same numbers without the flip would look like a gain.
    expect(classifyWhite(0, 500)).toBe('excellent')
  })

  it('judges Black by the same rule, from Black’s side', () => {
    const quality = classifyMove({
      mover: 'black',
      scoreBefore: cp(0),
      scoreAfter: cp(500),
      playedUci: toUci('e7e5'),
    })
    expect(quality).toBe('blunder')
  })

  it('measures in win percentage, not centipawns', () => {
    // Two hundred centipawns given away at the balance point is a blunder …
    expect(classifyWhite(0, -200)).toBe('blunder')
    // … and the same two hundred given away from a won game barely registers.
    expect(classifyWhite(900, 700)).toBe('good')
  })
})

describe('the punishing verdicts', () => {
  it.each([
    ['excellent', 0, -10],
    ['good', 0, -35],
    ['inaccuracy', 0, -80],
    ['mistake', 0, -140],
    ['blunder', 0, -250],
  ])('calls a move %s at the right size of error', (expected, before, after) => {
    expect(classifyWhite(before, after)).toBe(expected)
  })

  it('uses the same boundaries Lichess publishes: 5, 10 and 15 win percent', () => {
    const at = (afterFromWhite: number): { quality: MoveQuality; lost: number } => {
      const detail = classifyMoveDetailed({
        mover: 'white',
        scoreBefore: cp(0),
        scoreAfter: cp(-afterFromWhite),
        playedUci: toUci('e2e4'),
      })
      return { quality: detail.quality, lost: detail.winPercentLost }
    }

    const inaccuracy = at(-80)
    expect(inaccuracy.quality).toBe('inaccuracy')
    expect(inaccuracy.lost).toBeGreaterThan(5)
    expect(inaccuracy.lost).toBeLessThanOrEqual(10)

    const mistake = at(-140)
    expect(mistake.quality).toBe('mistake')
    expect(mistake.lost).toBeGreaterThan(10)
    expect(mistake.lost).toBeLessThanOrEqual(15)

    const blunder = at(-250)
    expect(blunder.quality).toBe('blunder')
    expect(blunder.lost).toBeGreaterThan(15)
  })
})

describe('miss', () => {
  it('names a won game thrown away, rather than calling it a blunder', () => {
    // From "mate is on" to "roughly level".
    const quality = classifyMove({
      mover: 'white',
      scoreBefore: mate(2),
      scoreAfter: cp(0),
      playedUci: toUci('e2e4'),
    })
    expect(quality).toBe('miss')
  })

  it('takes a decisive advantage thrown away too', () => {
    expect(classifyWhite(900, 0)).toBe('miss')
  })

  it('does not fire when the game was never won', () => {
    expect(classifyWhite(100, -400)).toBe('blunder')
  })

  it('does not fire when the win survives the move', () => {
    // Mate in 2 becomes mate in 5: still winning, so nothing was missed.
    const quality = classifyMove({
      mover: 'white',
      scoreBefore: mate(2),
      scoreAfter: mate(-5),
      playedUci: toUci('e2e4'),
    })
    expect(quality).toBe('excellent')
  })
})

describe('book', () => {
  it('outranks everything, because theory played the move', () => {
    expect(classifyWhite(0, -600, { isBook: true })).toBe('book')
    expect(classifyWhite(0, 0, { isBook: true })).toBe('book')
  })
})

describe('best, great and brilliant', () => {
  it('calls the engine’s own choice best', () => {
    expect(classifyWhite(20, 20, { bestUci: toUci('e2e4') })).toBe('best')
  })

  it('calls a good move that was not the engine’s choice excellent', () => {
    expect(classifyWhite(20, 20, { bestUci: toUci('d2d4') })).toBe('excellent')
  })

  it('calls the only move great', () => {
    const quality = classifyWhite(20, 20, {
      bestUci: toUci('e2e4'),
      // Second best loses far more than the ten-percent margin.
      secondBestScore: cp(-500),
    })
    expect(quality).toBe('great')
  })

  it('does not call a move great when there were other good ones', () => {
    expect(classifyWhite(20, 20, { bestUci: toUci('e2e4'), secondBestScore: cp(10) })).toBe('best')
  })

  it('calls a sound sacrifice brilliant', () => {
    // The Greek gift: Bxh7+ gives up a bishop for a pawn and keeps the evaluation.
    const quality = classifyMove({
      mover: 'white',
      scoreBefore: cp(60),
      scoreAfter: cp(-60),
      playedUci: toUci('d3h7'),
      fenBefore: toFen('rnbq1rk1/ppp1bppp/4pn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQK2R w KQ - 0 1'),
    })
    expect(quality).toBe('brilliant')
  })

  it('does not call a quiet good move brilliant', () => {
    const quality = classifyMove({
      mover: 'white',
      scoreBefore: cp(60),
      scoreAfter: cp(-60),
      playedUci: toUci('e2e4'),
      fenBefore: toFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    })
    expect(quality).not.toBe('brilliant')
  })

  it('does not call a sacrifice brilliant in an already won game', () => {
    const quality = classifyMove({
      mover: 'white',
      scoreBefore: cp(1200),
      scoreAfter: cp(-1200),
      playedUci: toUci('d3h7'),
      fenBefore: toFen('rnbq1rk1/ppp1bppp/4pn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQK2R w KQ - 0 1'),
    })
    expect(quality).not.toBe('brilliant')
  })

  it('never awards brilliance without the position to prove it with', () => {
    const detail = classifyMoveDetailed({
      mover: 'white',
      scoreBefore: cp(60),
      scoreAfter: cp(-60),
      playedUci: toUci('d3h7'),
    })
    expect(detail.quality).not.toBe('brilliant')
    expect(detail.exchangeCentipawns).toBeUndefined()
  })

  it('reports the material it found given up', () => {
    const detail = classifyMoveDetailed({
      mover: 'white',
      scoreBefore: cp(60),
      scoreAfter: cp(-60),
      playedUci: toUci('d3h7'),
      fenBefore: toFen('rnbq1rk1/ppp1bppp/4pn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQK2R w KQ - 0 1'),
    })
    expect(detail.exchangeCentipawns).toBe(-200)
  })
})

describe('countMoveQualities', () => {
  it('returns a full record per side, with zeroes rather than gaps', () => {
    const counts = countMoveQualities([
      { color: 'white', quality: 'best' },
      { color: 'white', quality: 'blunder' },
      { color: 'black', quality: 'book' },
    ])
    expect(Object.keys(counts.white).sort()).toEqual([...MOVE_QUALITIES].sort())
    expect(counts.white.best).toBe(1)
    expect(counts.white.blunder).toBe(1)
    expect(counts.white.book).toBe(0)
    expect(counts.black.book).toBe(1)
  })

  it('counts nothing for an empty game', () => {
    const counts = countMoveQualities([])
    expect(Object.values(counts.white).every((value) => value === 0)).toBe(true)
  })
})
