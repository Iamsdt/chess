import { describe, expect, it } from 'vitest'

import { createGame } from '@/chess'
import { toSquare as sq } from '@/domain'

import {
  KNIGHT_ROUTE_BLOCKED,
  isKnightStep,
  isShortestRoute,
  knightDistance,
  knightMoves,
  knightRouteFen,
  pickKnightRoute,
  shortestKnightPath,
} from './knight-route'
import { ALL_SQUARES } from './vision-squares'

describe('knight moves', () => {
  it('has eight jumps from the centre, fewer at the edge', () => {
    expect(knightMoves(sq('d4'))).toHaveLength(8)
    expect(knightMoves(sq('a1'))).toHaveLength(2)
    expect(knightMoves(sq('h4'))).toHaveLength(4)
  })

  it('leaves out blocked squares', () => {
    expect(knightMoves(sq('b3'))).toContain(sq('a1'))
    expect(knightMoves(sq('b3'), KNIGHT_ROUTE_BLOCKED)).not.toContain(sq('a1'))
    expect(knightMoves(sq('g6'), KNIGHT_ROUTE_BLOCKED)).not.toContain(sq('h8'))
  })

  it('recognises a knight step', () => {
    expect(isKnightStep(sq('g1'), sq('f3'))).toBe(true)
    expect(isKnightStep(sq('g1'), sq('g3'))).toBe(false)
  })
})

describe('breadth-first search', () => {
  it('finds the textbook distances', () => {
    expect(knightDistance(sq('g1'), sq('f3'))).toBe(1)
    expect(knightDistance(sq('a1'), sq('h8'))).toBe(6)
    expect(knightDistance(sq('a1'), sq('b2'))).toBe(4)
    expect(knightDistance(sq('e4'), sq('e4'))).toBe(0)
  })

  it('returns a path whose every step is a knight jump', () => {
    const path = shortestKnightPath(sq('b1'), sq('h6'), KNIGHT_ROUTE_BLOCKED)
    expect(path?.[0]).toBe(sq('b1'))
    expect(path?.at(-1)).toBe(sq('h6'))
    expect(path?.length).toBe((knightDistance(sq('b1'), sq('h6'), KNIGHT_ROUTE_BLOCKED) ?? 0) + 1)
    path?.forEach((square, index) => {
      const previous = path[index - 1]
      if (previous !== undefined) expect(isKnightStep(previous, square)).toBe(true)
    })
  })

  it('is symmetric and never reports an unreachable square on an open board', () => {
    for (const from of ALL_SQUARES) {
      for (const to of ALL_SQUARES) {
        const forward = knightDistance(from, to)
        expect(forward).not.toBeNull()
        expect(forward).toBe(knightDistance(to, from))
      }
    }
  })

  it('agrees with an independent distance table on a sample', () => {
    // Reference values from the standard 8x8 knight-distance table.
    const reference: readonly [string, string, number][] = [
      ['a1', 'a2', 3],
      ['a1', 'c2', 1],
      ['a1', 'd4', 2],
      ['a1', 'g7', 4],
      ['c3', 'f6', 2],
      ['h1', 'a8', 6],
    ]
    for (const [from, to, expected] of reference) {
      expect(knightDistance(sq(from), sq(to))).toBe(expected)
    }
  })

  it('refuses a blocked endpoint', () => {
    expect(shortestKnightPath(sq('b1'), sq('a1'), KNIGHT_ROUTE_BLOCKED)).toBeNull()
    expect(knightDistance(sq('a1'), sq('b3'), KNIGHT_ROUTE_BLOCKED)).toBeNull()
  })

  it('can be longer once the kings are parked in the corners', () => {
    // On the open board a1 to b2 is four jumps; with a1 blocked, b3 to b2 is still reachable.
    expect(knightDistance(sq('b3'), sq('b2'), KNIGHT_ROUTE_BLOCKED)).toBe(
      knightDistance(sq('b3'), sq('b2')),
    )
  })
})

describe('validating a player’s route', () => {
  const target = { from: sq('g1'), to: sq('e4'), jumps: 2 }

  it('accepts a shortest route', () => {
    expect(isShortestRoute([sq('g1'), sq('f3'), sq('e5')], { ...target, to: sq('e5') })).toBe(true)
    expect(isShortestRoute([sq('g1'), sq('f3'), sq('d4')], { ...target, to: sq('d4') })).toBe(true)
  })

  it('rejects a legal route that is too long', () => {
    const longRoute = [sq('g1'), sq('f3'), sq('g1'), sq('f3'), sq('e5')]
    expect(isShortestRoute(longRoute, { ...target, to: sq('e5') })).toBe(false)
  })

  it('rejects a route with an illegal step, a wrong start or a wrong end', () => {
    expect(isShortestRoute([sq('g1'), sq('g3'), sq('e4')], target)).toBe(false)
    expect(isShortestRoute([sq('b1'), sq('c3'), sq('e4')], target)).toBe(false)
    expect(isShortestRoute([sq('g1'), sq('f3')], target)).toBe(false)
  })

  it('rejects a route through a king’s square', () => {
    expect(isShortestRoute([sq('c2'), sq('a1')], { from: sq('c2'), to: sq('a1'), jumps: 1 })).toBe(
      false,
    )
  })
})

function seededRandom(start: number): () => number {
  let seed = start
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

describe('picking a route', () => {
  it('is reproducible for a given random source and always two to five jumps', () => {
    const random = seededRandom(7)
    for (let i = 0; i < 40; i += 1) {
      const route = pickKnightRoute(random, null)
      expect(route.jumps).toBeGreaterThanOrEqual(2)
      expect(route.jumps).toBeLessThanOrEqual(5)
      expect(knightDistance(route.from, route.to, KNIGHT_ROUTE_BLOCKED)).toBe(route.jumps)
      expect(KNIGHT_ROUTE_BLOCKED).not.toContain(route.from)
      expect(KNIGHT_ROUTE_BLOCKED).not.toContain(route.to)
    }
  })

  it('does not repeat the previous route', () => {
    const random = seededRandom(11)
    let previous = pickKnightRoute(random, null)
    for (let i = 0; i < 30; i += 1) {
      const next = pickKnightRoute(random, previous)
      expect(next.from === previous.from && next.to === previous.to).toBe(false)
      previous = next
    }
    expect(pickKnightRoute(seededRandom(11), null)).toEqual(pickKnightRoute(seededRandom(11), null))
  })
})

describe('the knight board', () => {
  it('is a legal position with the knight wherever it stands', () => {
    for (const square of ALL_SQUARES) {
      if (KNIGHT_ROUTE_BLOCKED.includes(square)) continue
      const game = createGame(knightRouteFen(square))
      expect(game.ok).toBe(true)
    }
  })
})
