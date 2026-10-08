import { describe, expect, it } from 'vitest'

import { createGame, legalMoves } from '@/chess'
import { toFen } from '@/domain'

import { CHECK_POSITIONS, checkingMoves, findCheck, shuffledPositions } from './find-checks'

describe('find all checks', () => {
  it.each(CHECK_POSITIONS.map((position) => [position.id, position] as const))(
    '%s is a legal position with checks and non-checks to tell apart',
    (_id, position) => {
      const game = createGame(position.fen)
      expect(game.ok).toBe(true)
      if (!game.ok) return
      const checks = checkingMoves(position.fen)
      expect(checks.length).toBeGreaterThan(0)
      expect(checks.length).toBeLessThan(legalMoves(game.value).length)
    },
  )

  it('finds exactly the checks in a known position', () => {
    // After 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6??: Qxf7# is mate, Qxe5+ and Bxf7+ are checks.
    const fen = toFen('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4')
    const sans = checkingMoves(fen).map((move) => move.san)
    expect(sans.sort()).toEqual(['Bxf7+', 'Qxe5+', 'Qxf7#'])
  })

  it('counts a discovered or mating check, not just the moved piece’s own', () => {
    const fen = toFen('r3k2r/ppp2ppp/2n5/3q4/3P4/2N1B3/PPP1QPPP/R3K2R w KQkq - 0 1')
    expect(
      checkingMoves(fen)
        .map((move) => move.san)
        .sort(),
    ).toEqual(['Bc1+', 'Bd2+', 'Bf4+', 'Bg5+', 'Bh6+'])
  })

  it('answers from Black’s side too', () => {
    const black = CHECK_POSITIONS.find((position) => position.id === 'black-to-move')
    expect(
      black &&
        checkingMoves(black.fen)
          .map((move) => move.san)
          .sort(),
    ).toEqual(['Qxg2+', 'Re1+'])
  })

  it('matches a board move to a check by its squares', () => {
    const fen = toFen('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4')
    const checks = checkingMoves(fen)
    expect(findCheck(checks, 'h5', 'f7')?.san).toBe('Qxf7#')
    expect(findCheck(checks, 'h5', 'h6')).toBeUndefined()
  })

  it('shuffles without losing or duplicating a position', () => {
    let seed = 3
    const random = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }
    const order = shuffledPositions(random)
    expect(order.map((position) => position.id).sort()).toEqual(
      CHECK_POSITIONS.map((position) => position.id).sort(),
    )
  })
})
